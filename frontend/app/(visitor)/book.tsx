import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBooking, getCategories, getMyBookings } from '../../src/lib/api/services';
import { ApiTimeoutError, getApiErrorMessageForDisplay } from '../../src/lib/api/client';
import { useRequireAuth } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { CategoryPicker, itemsFrom, totalOf } from '../../src/components/CategoryPicker';
import { MonthCalendar } from '../../src/components/MonthCalendar';
import { Banner, Button } from '../../src/components/ui';
import { formatDate } from '../../src/lib/dates';
import { colors } from '../../src/theme';

type Step = 'tickets' | 'date' | 'review';

export default function BookVisitScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const qc = useQueryClient();
  const { isLoading: authLoading, user } = useRequireAuth({ requireEmail: true });
  const [step, setStep] = useState<Step>('tickets');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [visitDate, setVisitDate] = useState('');
  const [error, setError] = useState('');

  const cats = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const categories = cats.data ?? [];
  const count = Object.values(quantities).reduce((a, b) => a + b, 0);
  const total = totalOf(quantities, categories);

  const create = useMutation({
    mutationFn: () => createBooking({ visitDate, bookingType: 'individual', items: itemsFrom(quantities) }),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['myBookings'] });
      router.replace(`/(visitor)/booking/${b.id}` as never);
    },
    onError: async (e) => {
      // The server creates the Chapa session inside this request. On a timeout the
      // booking may already exist: look for it instead of inviting a duplicate.
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
      setError(getApiErrorMessageForDisplay(e));
    },
  });

  if (authLoading || !user || !user.email_verified_at) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.forestBright} /></View>;
  }

  const names = Object.entries(quantities).map(([id, n]) => {
    const c = categories.find((x) => x.id === id);
    return `${locale === 'am' && c?.name_am ? c.name_am : c?.name_en} ×${n}`;
  });

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{t('book_a_visit')}</Text>
        <Text style={s.step}>{step === 'tickets' ? `1/3 · ${t('browse_tickets')}` : step === 'date' ? `2/3 · ${t('date')}` : `3/3 · ${t('payment')}`}</Text>
        {error ? <Banner text={error} /> : null}

        {step === 'tickets' && (
          cats.isLoading ? <ActivityIndicator color={colors.forestBright} /> :
          cats.isError ? <Banner text={t('categories_load_failed')} /> :
          categories.length === 0 ? <Banner kind="info" text={t('no_categories_available')} /> : (
            <>
              <CategoryPicker categories={categories} quantities={quantities} onChange={setQuantities} />
              <Button label={`${t('continue')}${count ? ` · ${total} ETB` : ''}`} disabled={count === 0} onPress={() => setStep('date')} />
            </>
          )
        )}

        {step === 'date' && (
          <>
            <MonthCalendar value={visitDate} onChange={setVisitDate} />
            <Button label={t('continue')} disabled={!visitDate} onPress={() => setStep('review')} />
            <Button label={t('back')} variant="secondary" onPress={() => setStep('tickets')} />
          </>
        )}

        {step === 'review' && (
          <>
            <View style={s.card}>
              <Text style={s.row}>{t('date')}: <Text style={s.bold}>{formatDate(visitDate, locale)}</Text></Text>
              {names.map((n) => (<Text key={n} style={s.row}>{n}</Text>))}
              <Text style={[s.row, s.total]}>{t('total')}: {total} ETB</Text>
              <Text style={s.hint}>{t('payment_required_description')}</Text>
            </View>
            <Button label={t('confirm')} loading={create.isPending} onPress={() => { setError(''); create.mutate(); }} />
            <Button label={t('back')} variant="secondary" disabled={create.isPending} onPress={() => setStep('date')} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '900', color: colors.ink },
  step: { color: colors.inkSoft, marginTop: 4, marginBottom: 16, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  row: { color: colors.ink, marginBottom: 6, fontSize: 15 },
  bold: { fontWeight: '800' },
  total: { fontWeight: '900', fontSize: 18, marginTop: 8 },
  hint: { color: colors.inkSoft, marginTop: 8, lineHeight: 20 },
});
