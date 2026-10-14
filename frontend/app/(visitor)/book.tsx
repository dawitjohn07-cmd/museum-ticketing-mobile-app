import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBooking, getCategories, getMyBookings } from '../../src/lib/api/services';
import { ApiTimeoutError, getApiErrorMessageForDisplay } from '../../src/lib/api/client';
import { useRequireAuth } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { useTheme } from '../../src/lib/theme/useTheme';
import { CategoryPicker, itemsFrom, totalOf } from '../../src/components/CategoryPicker';
import { MonthCalendar } from '../../src/components/MonthCalendar';
import { Banner, Body, BrandHeader, Button, Card, Heading, Kicker, Screen } from '../../src/components/ui';
import { formatDate } from '../../src/lib/dates';
import { fonts } from '../../src/theme';

type Step = 'tickets' | 'date' | 'review';

export default function BookVisitScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
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

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(visitor)/home' as never));

  if (authLoading || !user || !user.email_verified_at) {
    return <Screen scroll={false}><View style={s.center}><ActivityIndicator size="large" color={colors.lime} /></View></Screen>;
  }

  const names = Object.entries(quantities).map(([id, n]) => {
    const c = categories.find((x) => x.id === id);
    return `${locale === 'am' && c?.name_am ? c.name_am : c?.name_en} ×${n}`;
  });

  return (
    <Screen stickyHeader={<><BrandHeader onBack={goBack} /><Kicker>{`ARCHIVE / BOOKING · ${step === 'tickets' ? '1' : step === 'date' ? '2' : '3'}/3`}</Kicker></>}>
      <Heading size={42}>{t('book_a_visit')}</Heading>
      <Body style={{ marginBottom: 18 }}>{step === 'tickets' ? t('browse_tickets') : step === 'date' ? t('date') : t('payment')}</Body>
      {error ? <Banner text={error} /> : null}

      {step === 'tickets' && (
        cats.isLoading ? <ActivityIndicator color={colors.lime} /> :
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
          <Button label={t('back')} variant="ghost" onPress={() => setStep('tickets')} />
        </>
      )}

      {step === 'review' && (
        <>
          <Card>
            <Text style={[s.k, { color: colors.lime }]}>{t('date')}</Text>
            <Text style={[s.v, { color: colors.text }]}>{formatDate(visitDate, locale)}</Text>
            {names.map((n) => (<Text key={n} style={[s.item, { color: colors.text }]}>{n}</Text>))}
            <View style={[s.line, { backgroundColor: colors.line }]} />
            <Text style={[s.total, { color: colors.lime }]}>{t('total')}: {total} ETB</Text>
            <Body style={{ marginTop: 8 }}>{t('payment_required_description')}</Body>
          </Card>
          <Button label={t('confirm')} loading={create.isPending} onPress={() => { setError(''); create.mutate(); }} />
          <Button label={t('back')} variant="ghost" disabled={create.isPending} onPress={() => setStep('date')} />
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  k: { fontWeight: '800', fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
  v: { fontFamily: fonts.serif, fontSize: 22, marginTop: 4, marginBottom: 12 },
  item: { fontSize: 15, marginBottom: 6 },
  line: { height: 1, marginVertical: 10 },
  total: { fontWeight: '900', fontSize: 20 },
});
