import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, CheckCircle2, XCircle, Banknote } from 'lucide-react-native';
import { getMyBookings, getMyRefunds, type Booking, type BookingStatus } from '../../src/lib/api/services';
import { ApiError, ApiTimeoutError } from '../../src/lib/api/client';
import { useTranslation } from '../../src/lib/i18n/useTranslation';

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'booking_confirmed', color: '#2E7D32', bg: '#E8F5E9', icon: CheckCircle2 },
  awaiting_payment: { label: 'awaiting_payment', color: '#E65100', bg: '#FFF3E0', icon: Banknote },
  visited: { label: 'visited', color: '#1565C0', bg: '#E3F2FD', icon: CheckCircle2 },
  cancelled: { label: 'cancelled', color: '#757575', bg: '#F5F5F5', icon: XCircle },
  refunded: { label: 'refunded', color: '#6A1B9A', bg: '#F3E5F5', icon: Banknote },
};

function BookingCard({ booking, refund, t }: { booking: Booking; refund?: { status: 'pending' | 'completed' | 'failed' }; t: (key: string) => string }) {
  const router = useRouter();
  const status = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = status.icon;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/(visitor)/booking/${booking.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <StatusIcon size={14} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{t(status.label)}</Text>
        </View>
        <ChevronRight size={20} color="#BDBDBD" />
      </View>

      <Text style={styles.refText}>{booking.reference}</Text>
      <Text style={styles.dateText}>
        {new Date(booking.visitDate).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </Text>
      {booking.status === 'cancelled' && (
        <Text style={styles.refundText}>
          {(() => {
            if (!refund) return `${t('cancelled')} • ${t('no_refund_record')}`;
            if (refund.status === 'completed') return `${t('cancelled')} • ${t('refund_completed')}`;
            if (refund.status === 'failed') return `${t('cancelled')} • ${t('refund_failed')}`;
            return `${t('cancelled')} • ${t('refund_processing')}`;
          })()}
        </Text>
      )}

      <View style={styles.divider} />

      <View style={styles.cardFooter}>
        <Text style={styles.itemsSummary}>
          {booking.items.map((i) => `${i.categoryNameEn} ×${i.quantity}`).join(', ')}
        </Text>
        <Text style={styles.totalText}>{booking.totalAmountEtb} ETB</Text>
      </View>
    </Pressable>
  );
}

export default function MyBookingsScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['myBookings'],
    queryFn: () => getMyBookings({ limit: 20, offset: 0 }),
    retry: 1,
  });
  const { t } = useTranslation();
  const { data: refundData } = useQuery({
    queryKey: ['myRefunds'],
    queryFn: getMyRefunds,
  });
  const refundsByBooking = new Map((refundData?.data ?? []).map((refund) => [refund.bookingId, refund]));

  const bookings = data?.data ?? [];
  const errorMessage =
    error instanceof ApiTimeoutError
      ? 'Loading your bookings timed out. Check that the backend is reachable.'
      : error instanceof ApiError && error.status === 401
        ? 'Your session has expired. Please sign in again.'
        : error instanceof ApiError
          ? `The backend rejected the request (HTTP ${error.status ?? 'unknown'}).`
          : t('could_not_reach_backend');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Text style={styles.title}>{t('my_bookings')}</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2E7D32" style={{ marginTop: 60 }} />
      ) : isError ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyText}>{t('failed_to_load_bookings')}</Text>
          <Text style={styles.emptySubText}>{errorMessage}</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>{t('retry')}</Text>
          </Pressable>
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎟️</Text>
          <Text style={styles.emptyText}>{t('no_bookings_yet')}</Text>
          <Text style={styles.emptySubText}>{t('book_visit_to_start')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2E7D32" />
          }
        >
          {bookings.map((b) => (
            <BookingCard key={b.id} booking={b} refund={refundsByBooking.get(b.id)} t={t} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  title: { fontSize: 28, fontWeight: '900', color: '#1A1A1A', padding: 24, paddingBottom: 16 },
  list: { padding: 16, gap: 14 },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700', marginLeft: 5 },

  refText: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  dateText: { fontSize: 14, color: '#666', marginBottom: 14 },
  refundText: { fontSize: 13, color: '#6A1B9A', fontWeight: '700', marginBottom: 14 },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginBottom: 14 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  itemsSummary: { fontSize: 13, color: '#888', flex: 1, marginRight: 12 },
  totalText: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  emptySubText: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 24 },
  retryBtn: { backgroundColor: '#2E7D32', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
  retryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
