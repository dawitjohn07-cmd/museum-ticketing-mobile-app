import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, ApiTimeoutError, getApiErrorMessageForDisplay } from '../../src/lib/api/client';
import { createBooking, getCategories, getMyBookings, lookupInstitutionByTin } from '../../src/lib/api/services';
import { useRequireAuth } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { CategoryPicker, itemsFrom, totalOf } from '../../src/components/CategoryPicker';
import { MonthCalendar } from '../../src/components/MonthCalendar';
import { Banner, Button, Field } from '../../src/components/ui';
import { formatDate } from '../../src/lib/dates';
import { colors } from '../../src/theme';

const PHONE_RE = /^(\+251|0)?[7-9][0-9]{8}$/;

// Group / school visit: a booking with bookingType 'group' via POST /bookings/ (same as the website).
export default function GroupVisitScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const qc = useQueryClient();
  const { isLoading: authLoading, user } = useRequireAuth({ requireEmail: true });
  const [groupName, setGroupName] = useState('');
  const [groupTin, setGroupTin] = useState('');
  const [phone, setPhone] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [visitDate, setVisitDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [matched, setMatched] = useState(false);
  const autofilled = useRef('');

  const cats = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const categories = cats.data ?? [];
  const cleanedTin = groupTin.replace(/[\s-]/g, '');

  // TIN autofill (GET /institutions/?tin=) once 10 digits are typed.
  useEffect(() => {
    setMatched(false);
    if (!/^\d{10}$/.test(cleanedTin)) return;
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const inst = await lookupInstitutionByTin(cleanedTin);
        if (!alive || !inst) return;
        setMatched(true);
        const name = locale === 'am' && inst.nameAm ? inst.nameAm : inst.name;
        setGroupName((cur) => {
          if (cur.trim() === '' || cur === autofilled.current) { autofilled.current = name; return name; }
          return cur;
        });
      } catch { /* lookup is a convenience only */ }
    }, 400);
    return () => { alive = false; clearTimeout(timer); };
  }, [cleanedTin, locale]);

  const create = useMutation({
    mutationFn: () => createBooking({
      visitDate, bookingType: 'group', items: itemsFrom(quantities),
      groupName: groupName.trim(), groupTin: cleanedTin, groupContactPhone: phone.trim() || null,
    }),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['myBookings'] });
      router.replace(`/(visitor)/booking/${b.id}` as never);
    },
    onError: async (e) => {
      if (e instanceof ApiTimeoutError) {
        try {
          const list = await getMyBookings({ limit: 5, offset: 0 });
          const found = list.data.find((b) => b.status === 'awaiting_payment' && b.visitDate === visitDate && b.bookingType === 'group' && Date.now() - new Date(b.createdAt).getTime() < 5 * 60_000);
          if (found) { router.replace(`/(visitor)/booking/${found.id}` as never); return; }
        } catch { /* fall through */ }
        setError(t('booking_check_timeout'));
        return;
      }
      if (e instanceof ApiError && e.fieldErrors) setErrors(e.fieldErrors);
      setError(getApiErrorMessageForDisplay(e) || t('group_request_failed'));
    },
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (!groupName.trim()) next.groupName = t('group_name_required');
    else if (groupName.trim().length > 100) next.groupName = t('group_name_required');
    if (!/^\d{10}$/.test(cleanedTin)) next.groupTin = t('group_tin_invalid');
    if (phone.trim() && !PHONE_RE.test(phone.trim().replace(/[\s-]/g, ''))) next.groupContactPhone = t('invalid_phone');
    if (Object.keys(quantities).length === 0) next.items = t('select_ticket_category');
    if (!visitDate) next.visitDate = t('select_date_required');
    setErrors(next);
    setError('');
    if (Object.keys(next).length) return;
    create.mutate();
  };

  if (authLoading || !user || !user.email_verified_at) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.forestBright} /></View>;
  }
  const total = totalOf(quantities, categories);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{t('group_visit_request')}</Text>
        <Text style={s.sub}>{t('group_visit_description')}</Text>
        {error ? <Banner text={error} /> : null}

        <Field label={t('group_tin')} value={groupTin} onChangeText={setGroupTin} keyboardType="number-pad" maxLength={14} error={errors.groupTin} placeholder="0000000000" />
        <Text style={s.help}>{t('group_tin_help')}</Text>
        {matched ? <Text style={s.ok}>{t('institution_matched')}</Text> : null}
        <Field label={t('group_name')} value={groupName} onChangeText={setGroupName} maxLength={100} error={errors.groupName} />
        <Field label={t('group_contact_phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={errors.groupContactPhone} placeholder="0912345678" />

        <Text style={s.section}>{t('group_size_by_category')}</Text>
        {cats.isLoading ? <ActivityIndicator color={colors.forestBright} /> :
          cats.isError ? <Banner text={t('categories_load_failed')} /> :
          <CategoryPicker categories={categories} quantities={quantities} onChange={setQuantities} />}
        {errors.items ? <Text style={s.err}>{errors.items}</Text> : null}

        <Text style={s.section}>{t('date')}{visitDate ? ` · ${formatDate(visitDate, locale)}` : ''}</Text>
        <MonthCalendar value={visitDate} onChange={setVisitDate} />
        {errors.visitDate ? <Text style={s.err}>{errors.visitDate}</Text> : null}

        <Text style={s.total}>{t('total')}: {total} ETB</Text>
        <Button label={t('confirm')} loading={create.isPending} onPress={submit} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: '900', color: colors.ink },
  sub: { color: colors.inkSoft, marginVertical: 10, lineHeight: 21 },
  help: { color: colors.inkSoft, fontSize: 12, marginTop: -8, marginBottom: 12 },
  ok: { color: '#1B5E20', fontWeight: '700', marginBottom: 10 },
  section: { fontWeight: '900', color: colors.ink, fontSize: 16, marginTop: 10, marginBottom: 8 },
  err: { color: colors.danger, marginTop: 4 },
  total: { fontWeight: '900', fontSize: 18, marginTop: 16, color: colors.ink },
});
