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
import { Banner, Body, BrandHeader, Button, Chip, Glow, Heading, Kicker, StatusBadge } from '../../src/components/ui';
import { useTheme } from '../../src/lib/theme/useTheme';
import { formatDate } from '../../src/lib/dates';
import { fonts, radii } from '../../src/theme';

type Filter = 'all' | 'pending' | 'visited' | 'cancelled';
const PAGE = 20;

export default function MyBookingsScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();
  const { colors } = useTheme();
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

  const bg = (child: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: 24, paddingTop: 4 }}><BrandHeader /></View>
        {child}
      </SafeAreaView>
    </View>
  );

  if (authLoading || !isAuthenticated) return bg(<View style={s.center}><ActivityIndicator color={colors.lime} /></View>);

  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: t('all') }, { key: 'pending', label: t('upcoming') },
    { key: 'visited', label: t('visited') }, { key: 'cancelled', label: t('cancelled') },
  ];

  const header = (
    <View>
      <Kicker>ARCHIVE ID / BOOKINGS</Kicker>
      <Heading size={48}>{t('my_bookings')}</Heading>
      <View style={s.chips}>{chips.map((c) => (<Chip key={c.key} label={c.label} active={filter === c.key} onPress={() => setFilter(c.key)} />))}</View>
    </View>
  );

  const renderItem = ({ item: b }: { item: Booking }) => {
    const refund = refundByBooking.get(b.id);
    return (
      <Pressable
        style={({ pressed }) => [
          s.card,
          { backgroundColor: colors.card, borderColor: colors.line },
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => router.push(`/(visitor)/booking/${b.id}` as never)}
      >
        <View style={s.cardHead}><StatusBadge status={b.status} /><ChevronRight size={20} color={colors.lime} /></View>
        <Text style={[s.ref, { color: colors.text }]}>{b.reference}{b.bookingType === 'group' && b.groupName ? ` · ${b.groupName}` : ''}</Text>
        <Text style={[s.date, { color: colors.muted }]}>{formatDate(b.visitDate, locale)}</Text>
        {b.status === 'cancelled' && (
          <Text style={[s.refund, { color: colors.muted }]}>
            {!refund ? t('no_refund_record') : refund.status === 'completed' ? t('refund_completed') : refund.status === 'failed' ? t('refund_failed') : t('refund_processing')}
          </Text>
        )}
        <View style={[s.divider, { backgroundColor: colors.line }]} />
        <View style={s.foot}>
          <Text style={[s.items, { color: colors.muted }]} numberOfLines={2}>
            {b.items.map((i) => `${locale === 'am' && i.categoryNameAm ? i.categoryNameAm : i.categoryNameEn} ×${i.quantity}`).join(', ')}
          </Text>
          <Text style={[s.total, { color: colors.lime }]}>{b.totalAmountEtb} ETB</Text>
        </View>
      </Pressable>
    );
  };

  return bg(
    q.isLoading ? (
      <View style={{ padding: 24 }}>{header}<ActivityIndicator size="large" color={colors.lime} style={{ marginTop: 30 }} /></View>
    ) : q.isError ? (
      <View style={{ padding: 24 }}>
        {header}
        <Banner text={getApiErrorMessageForDisplay(q.error) || t('failed_to_load_bookings')} />
        <Button label={t('retry')} onPress={() => q.refetch()} />
      </View>
    ) : (
      <FlatList
        data={shown}
        keyExtractor={(b) => b.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => { q.refetch(); refunds.refetch(); }} tintColor={colors.lime} />}
        ListEmptyComponent={<View style={s.empty}><Text style={[s.emptyT, { color: colors.text }]}>{t('no_bookings_yet')}</Text><Body style={{ marginTop: 6, textAlign: 'center' }}>{t('book_visit_to_start')}</Body></View>}
        ListFooterComponent={q.hasNextPage ? <Button label={t('load_more')} variant="secondary" loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} /> : null}
      />
    )
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  list: { padding: 24, paddingBottom: 40 },
  card: { borderRadius: radii.md, borderWidth: 1, padding: 16, marginBottom: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontFamily: fonts.serif, fontSize: 24, marginTop: 12 },
  date: { marginTop: 2 },
  refund: { marginTop: 4, fontSize: 13 },
  divider: { height: 1, marginVertical: 12 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  items: { flex: 1 },
  total: { fontWeight: '900' },
  empty: { alignItems: 'center', marginTop: 40, padding: 20 },
  emptyT: { fontFamily: fonts.serif, fontSize: 24 },
});
