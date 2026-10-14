import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, ApiTimeoutError, getApiErrorMessageForDisplay } from '../../src/lib/api/client';
import { createBooking, getCategories, getMyBookings, lookupInstitutionByTin } from '../../src/lib/api/services';
import { useRequireAuth } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { useTheme } from '../../src/lib/theme/useTheme';
import { CategoryPicker, itemsFrom, totalOf } from '../../src/components/CategoryPicker';
import { MonthCalendar } from '../../src/components/MonthCalendar';
import { Banner, Body, BrandHeader, Button, Field, Heading, Kicker, Screen } from '../../src/components/ui';
import { formatDate } from '../../src/lib/dates';
import { fonts } from '../../src/theme';

const PHONE_RE = /^(\+251|0)?[7-9][0-9]{8}$/;

export default function GroupVisitScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
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
          const found = list.data.find(
            (b) => b.status === 'awaiting_payment' && b.visitDate === visitDate && Date.now() - new Date(b.createdAt).getTime() < 5 * 60_000
          );
          if (found) { qc.invalidateQueries({ queryKey: ['myBookings'] }); router.replace(`/(visitor)/booking/${found.id}` as never); return; }
        } catch { /* fall through */ }
        setError(t('booking_check_timeout'));
        return;
      }
      if (e instanceof ApiError && e.fieldErrors) setErrors(e.fieldErrors);
      setError(getApiErrorMessageForDisplay(e));
    },
  });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(visitor)/home' as never));

  if (authLoading || !user || !user.email_verified_at) {
    return <Screen scroll={false}><View style={s.center}><ActivityIndicator size="large" color={colors.lime} /></View></Screen>;
  }

  const count = Object.values(quantities).reduce((a, b) => a + b, 0);
  const submit = () => {
    setError('');
    const fe: Record<string, string> = {};
    if (!/^\d{10}$/.test(cleanedTin)) fe.groupTin = t('invalid_tin');
    if (!groupName.trim()) fe.groupName = t('group_name_required');
    const p = phone.trim().replace(/[\s-]/g, '');
    if (p && !PHONE_RE.test(p)) fe.groupContactPhone = t('invalid_phone');
    if (count === 0) fe.items = t('select_at_least_one_ticket');
    if (!visitDate) fe.visitDate = t('select_visit_date');
    setErrors(fe);
    if (Object.keys(fe).length > 0) return;
    create.mutate();
  };

  const total = totalOf(quantities, categories);

  return (
    <Screen stickyHeader={<><BrandHeader onBack={goBack} /><Kicker>ARCHIVE / GROUP VISIT</Kicker></>}>
      <Heading size={40}>{t('group_visit_request')}</Heading>
      <Body style={{ marginBottom: 18 }}>{t('group_visit_description')}</Body>
      {error ? <Banner text={error} /> : null}

      <Field label={t('group_tin')} value={groupTin} onChangeText={setGroupTin} keyboardType="number-pad" maxLength={14} error={errors.groupTin} placeholder="0000000000" />
      <Text style={[s.help, { color: colors.muted }]}>{t('group_tin_help')}</Text>
      {matched ? <Text style={[s.ok, { color: colors.lime }]}>✓ {t('institution_matched')}</Text> : null}
      <Field label={t('group_name')} value={groupName} onChangeText={setGroupName} maxLength={100} error={errors.groupName} />
      <Field label={t('group_contact_phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={errors.groupContactPhone} placeholder="0912345678" />

      <Text style={[s.section, { color: colors.text }]}>{t('group_size_by_category')}</Text>
      {cats.isLoading ? <ActivityIndicator color={colors.lime} /> :
        cats.isError ? <Banner text={t('categories_load_failed')} /> :
        <CategoryPicker categories={categories} quantities={quantities} onChange={setQuantities} />}
      {errors.items ? <Text style={s.err}>{errors.items}</Text> : null}

      <Text style={[s.section, { color: colors.text }]}>{t('date')}{visitDate ? ` · ${formatDate(visitDate, locale)}` : ''}</Text>
      <MonthCalendar value={visitDate} onChange={setVisitDate} />
      {errors.visitDate ? <Text style={s.err}>{errors.visitDate}</Text> : null}

      <Text style={[s.total, { color: colors.lime }]}>{t('total')}: {total} ETB</Text>
      <Button label={t('confirm')} loading={create.isPending} onPress={submit} />
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  help: { fontSize: 12, marginTop: -8, marginBottom: 12 },
  ok: { fontWeight: '700', marginBottom: 10 },
  section: { fontFamily: fonts.serif, fontSize: 22, marginTop: 12, marginBottom: 10 },
  err: { color: '#FF7B68', marginTop: 4, marginBottom: 6 },
  total: { fontWeight: '900', fontSize: 20, marginTop: 14 },
});
