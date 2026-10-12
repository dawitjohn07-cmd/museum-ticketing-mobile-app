import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react-native';
import { getMyBookings, getMyRefunds, type Booking } from '../../src/lib/api/services';
import { getApiErrorMessageForDisplay } from '../../src/lib/api/client';
import { useRequireAuth } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { Banner, Button, StatusBadge } from '../../src/components/ui';
import { formatDate } from '../../src/lib/dates';
import { colors, radii, shadows } from '../../src/theme';

type Filter = 'all' | 'pending' | 'visited' | 'cancelled';
const PAGE = 20;

export default function MyBookingsScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();
  const [filter, setFilter] = useState<Filter>('all');

  const q = useInfiniteQuery({
    queryKey: ['myBookings', 'list'],
    enabled: isAuthenticated,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getMyBookings({ limit: PAGE, offset: pageParam }),
    getNextPageParam: (last) => (last.meta.offset + last.meta.limit < last.meta.total ? last.meta.offset + last.meta.limit : undefined),
  });
  const refunds = useQuery({ queryKey: ['myRefunds'], queryFn: () => getMyRefunds(), enabled: isAuthenticated });
  const refundByBooking = useMemo(() => new Map((refunds.data?.data ?? []).map((r) => [r.bookingId, r])), [refunds.data]);

  const all = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.data), [q.data]);
  const shown = all.filter((b) =>
    filter === 'all' ? true :
    filter === 'cancelled' ? b.status === 'cancelled' || b.status === 'refunded' :
    b.status === filter);

  if (authLoading || !isAuthenticated) return <View style={s.center}><ActivityIndicator color={colors.forestBright} /></View>;

  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: t('all') }, { key: 'pending', label: t('upcoming') },
    { key: 'visited', label: t('visited') }, { key: 'cancelled', label: t('cancelled') },
  ];

  const renderItem = ({ item: b }: { item: Booking }) => {
    const refund = refundByBooking.get(b.id);
    return (
      <Pressable style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]} onPress={() => router.push(`/(visitor)/booking/${b.id}` as never)}>
        <View style={s.cardHead}><StatusBadge status={b.status} /><ChevronRight size={20} color="#BDBDBD" /></View>
        <Text style={s.ref}>{b.reference}{b.bookingType === 'group' && b.groupName ? ` · ${b.groupName}` : ''}</Text>
        <Text style={s.date}>{formatDate(b.visitDate, locale)}</Text>
        {b.status === 'cancelled' && (
          <Text style={s.refund}>
            {!refund ? t('no_refund_record') : refund.status === 'completed' ? t('refund_completed') : refund.status === 'failed' ? t('refund_failed') : t('refund_processing')}
          </Text>
        )}
        <View style={s.divider} />
        <View style={s.foot}>
          <Text style={s.items} numberOfLines={2}>
            {b.items.map((i) => `${locale === 'am' && i.categoryNameAm ? i.categoryNameAm : i.categoryNameEn} ×${i.quantity}`).join(', ')}
          </Text>
          <Text style={s.total}>{b.totalAmountEtb} ETB</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <View style={s.chips}>
        {chips.map((c) => (
          <Pressable key={c.key} onPress={() => setFilter(c.key)} style={[s.chip, filter === c.key && s.chipOn]}>
            <Text style={[s.chipText, filter === c.key && { color: '#fff' }]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      {q.isLoading ? <ActivityIndicator size="large" color={colors.forestBright} style={{ marginTop: 40 }} /> :
        q.isError ? (
          <View style={s.pad}>
            <Banner text={getApiErrorMessageForDisplay(q.error) || t('failed_to_load_bookings')} />
            <Button label={t('retry')} onPress={() => q.refetch()} />
          </View>
        ) : (
          <FlatList
            data={shown}
            keyExtractor={(b) => b.id}
            renderItem={renderItem}
            contentContainerStyle={s.list}
            refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => { q.refetch(); refunds.refetch(); }} tintColor={colors.forestBright} />}
            ListEmptyComponent={<View style={s.empty}><Text style={s.emptyT}>{t('no_bookings_yet')}</Text><Text style={s.emptyS}>{t('book_visit_to_start')}</Text></View>}
            ListFooterComponent={q.hasNextPage ? <Button label={t('load_more')} variant="secondary" loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} /> : null}
          />
        )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, paddingBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.mist },
  chipOn: { backgroundColor: colors.forestBright },
  chipText: { fontWeight: '800', color: colors.forest },
  list: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: radii.md, padding: 16, marginBottom: 12, ...shadows.card },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontSize: 18, fontWeight: '900', color: colors.ink, marginTop: 10 },
  date: { color: colors.inkSoft, marginTop: 2 },
  refund: { color: colors.inkSoft, marginTop: 4, fontSize: 13 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  items: { flex: 1, color: colors.inkSoft },
  total: { fontWeight: '900', color: colors.ink },
  empty: { alignItems: 'center', marginTop: 60, padding: 20 },
  emptyT: { fontWeight: '900', fontSize: 18, color: colors.ink },
  emptyS: { color: colors.inkSoft, marginTop: 6, textAlign: 'center' },
});
