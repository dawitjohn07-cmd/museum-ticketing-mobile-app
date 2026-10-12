import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw, XCircle, ExternalLink } from 'lucide-react-native';
import {
  getBooking,
  verifyBookingPayment,
  type BookingStatus,
  cancelBooking,
  rescheduleBooking,
  requestPartialRefund,
  getMyRefunds,
  type Refund,
  type Booking,
} from '../../../src/lib/api/services';
import {
  ApiError,
  getApiErrorMessageForDisplay,
} from '../../../src/lib/api/client';
import { useTranslation } from '../../../src/lib/i18n/useTranslation';

function addDays(d: Date, n: number) {
  const c = new Date(d); c.setDate(c.getDate() + n); return c;
}
function isSunday(d: Date) { return d.getDay() === 0; }
function toDateStr(d: Date) { return d.toISOString().split('T')[0]; }
type PaymentReturnNotice = {
  kind: 'checking' | 'confirmed' | 'pending' | 'status' | 'error';
  text: string;
};

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function getBookingStatusMessage(status: BookingStatus, t: (key: string) => string): string {
  switch (status) {
    case 'cancelled':
      return t('booking_cancelled');
    case 'awaiting_payment':
      return t('awaiting_payment_message');
    case 'pending':
      return t('payment_confirmed_message');
    case 'visited':
      return t('visit_completed_message');
    case 'refunded':
      return t('booking_refunded');
    default:
      return `Booking status: ${String(status).replace('_', ' ')}.`;
  }

}

function getRefundMessage(refund: Refund | undefined): string | null {
  if (!refund) return null;
  if (refund.status === 'completed') return 'Refund completed. The refunded amount was confirmed by the museum server.';
  if (refund.status === 'failed') return 'Refund failed. The booking is cancelled, but the refund needs attention.';
  return 'Refund is processing. The booking is cancelled, but the refund is not complete yet.';
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentReturnNotice, setPaymentReturnNotice] = useState<PaymentReturnNotice | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);
  const paymentRefreshInFlight = useRef(false);

  const { data: booking, isLoading, isError } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => getBooking(id!),
    enabled: !!id,
  });
  const { data: refundData } = useQuery({
    queryKey: ['myRefunds'],
    queryFn: getMyRefunds,
    enabled: !!id,
  });
  const bookingRefund = refundData?.data.find((refund) => refund.bookingId === id);

  const refreshPaymentStatus = useCallback(async () => {
    if (!id || paymentRefreshInFlight.current) return;
    paymentRefreshInFlight.current = true;
    setPaymentReturnNotice({
      kind: 'checking',
      text: 'Checking the payment status with the museum server…',
    });

    try {
      let refreshedBooking: Booking | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        refreshedBooking = await queryClient.fetchQuery({
          queryKey: ['booking', id],
          queryFn: () => verifyBookingPayment(id),
          staleTime: 0,
        });
        if (refreshedBooking?.status !== 'awaiting_payment') break;
        if (attempt < 2) await wait(1500);
      }

      const status: BookingStatus | undefined = refreshedBooking?.status;
      if (status === 'pending') {
        setPaymentReturnNotice({
          kind: 'confirmed',
          text: getBookingStatusMessage(status, t),
        });
      } else if (status === 'awaiting_payment') {
        setPaymentReturnNotice({
          kind: 'pending',
          text: getBookingStatusMessage(status, t),
        });
      } else {
        setPaymentReturnNotice({
          kind: 'status',
          text: status ? getBookingStatusMessage(status, t) : t('booking_status_unavailable'),
        });
      }
    } catch (error) {
      let text = getApiErrorMessageForDisplay(error);
      if (error instanceof ApiError) {
        if (error.status === 401) text = 'Your visitor session has expired. Sign in again to check this payment.';
        else if (error.status === 403) text = 'You are not allowed to view this booking.';
        else if (error.status === 404) text = 'The booking could not be found.';
        else if (error.status && error.status >= 500) text = 'The museum server could not check this payment. Please retry.';
      }
      setPaymentReturnNotice({ kind: 'error', text });
    } finally {
      paymentRefreshInFlight.current = false;
    }
  }, [id, queryClient, t]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !id) return;
    const handlePaymentReturn = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data;
      if (
        !message ||
        message.type !== 'museum-payment-return' ||
        message.bookingId !== id
      ) {
        return;
      }
      void refreshPaymentStatus();
    };
    window.addEventListener('message', handlePaymentReturn);
    return () => window.removeEventListener('message', handlePaymentReturn);
  }, [id, refreshPaymentStatus]);

  const cancelMutation = useMutation({
    mutationFn: () => cancelBooking(id!),
    onMutate: () => {
      setCancelError(null);
    },
    onSuccess: async (updatedBooking) => {
      queryClient.setQueryData(['booking', id], updatedBooking);
      await queryClient.invalidateQueries({ queryKey: ['myBookings'] });
      await queryClient.invalidateQueries({ queryKey: ['myRefunds'] });
      setPaymentReturnNotice({
        kind: 'status',
        text: [getBookingStatusMessage(updatedBooking.status, t), getRefundMessage(bookingRefund)]
          .filter(Boolean)
          .join(' '),
      });
      Alert.alert(
        'Cancellation confirmed',
        updatedBooking.status === 'cancelled'
          ? 'Django confirmed that this booking was cancelled.'
          : 'The museum server returned an unexpected booking status. Please refresh.',
      );
    },
    onError: (error: unknown) => {
      let message = getApiErrorMessageForDisplay(error);
      if (error instanceof ApiError) {
        if (error.status === 401) message = 'Your visitor session has expired. Sign in again to cancel this booking.';
        else if (error.status === 403) message = 'You are not allowed to cancel this booking.';
        else if (error.status === 409) message = 'This booking is no longer eligible for cancellation.';
        else if (error.status === 429) message = t('cancellation_rate_limited');
        else if (error.status && error.status >= 500) message = 'The museum server could not cancel this booking. Please try again.';
      }
      setCancelError(message);
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: () => rescheduleBooking(id!, toDateStr(newDate!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myBookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setRescheduleMode(false);
      Alert.alert('Rescheduled', 'Your visit date has been updated.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.payload?.detail ?? 'Could not reschedule. You may have already rescheduled this booking.');
    },
  });

  const refundMutation = useMutation({
    mutationFn: () => requestPartialRefund(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      Alert.alert('Refund Requested', 'Your partial refund request has been submitted.');
    },
    onError: (e: any) => Alert.alert('Error', e.message || 'Could not request refund'),
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  if (isError || !booking) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errText}>Could not load booking.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const currentBooking: Booking = booking;
  const canCancel = currentBooking.status === 'pending' || currentBooking.status === 'awaiting_payment';
  const canReschedule = booking.status === 'pending' && !(booking.rescheduledCount ?? 0);
  const isPendingPayment = currentBooking.status === 'awaiting_payment';
  const isVisited = currentBooking.status === 'visited';
  const bookingId = currentBooking.id;

  async function openCheckout() {
    const checkoutUrl = currentBooking.checkoutUrl;
    if (!checkoutUrl || checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      if (Platform.OS === 'web') {
        const popup = window.open(
          checkoutUrl,
          '_blank',
          'popup,width=480,height=800,resizable=yes,scrollbars=yes',
        );
        if (!popup) {
          Alert.alert('Payment window blocked', 'Allow popups for this site and try again.');
        }
        return;
      }
      const returnUrl = ExpoLinking.createURL(`/payment-return/${bookingId}`);
      const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, returnUrl);
      if (result.type === 'success' && result.url) {
        router.replace({
          pathname: '/payment-return/[id]',
          params: { id: bookingId },
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['booking', id] });
      }
    } finally {
      setCheckoutLoading(false);
    }
  }

  // Build date options for reschedule (next 7 bookable non-Sunday days)
  const dateOptions: Date[] = [];
  {
    let d = addDays(new Date(), 1);
    while (dateOptions.length < 7) {
      if (!isSunday(d)) dateOptions.push(d);
      d = addDays(d, 1);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <Pressable style={styles.backRow} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#1A1A1A" />
          <Text style={styles.backText}>{t('my_bookings')}</Text>
        </Pressable>

        {/* Status & Reference */}
        <View style={styles.refCard}>
          <Text style={styles.ref}>{booking.reference}</Text>
          <Text style={styles.dateLabel}>
            {new Date(booking.visitDate).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            })}
          </Text>
          <View style={[styles.badge, getStatusStyle(booking.status)]}>
            <Text style={[styles.badgeText, { color: getStatusColor(booking.status) }]}>
              {booking.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* The backend currently exposes no server-issued QR payload. */}
        {booking.status === 'pending' && (
          <View style={styles.qrCard}>
            <Text style={styles.qrLabel}>{t('digital_ticket')}</Text>
            <Text style={styles.qrSub}>{t('digital_ticket_unavailable')}</Text>
          </View>
        )}

        {/* Chapa payment CTA */}
        {isPendingPayment && booking.checkoutUrl && (
          <Pressable
            style={styles.payBtn}
            onPress={() => void openCheckout()}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <ExternalLink color="#FFF" size={20} />
                <Text style={styles.payBtnText}>{t('complete_payment')}</Text>
              </>
            )}
          </Pressable>
        )}
        {paymentReturnNotice && (
          <View style={styles.paymentNotice}>
            {paymentReturnNotice.kind === 'checking' && <ActivityIndicator color="#1B5E20" />}
            <Text style={styles.paymentNoticeText}>{paymentReturnNotice.text}</Text>
            {(paymentReturnNotice.kind === 'pending' || paymentReturnNotice.kind === 'error') && (
              <Pressable onPress={() => void refreshPaymentStatus()} style={styles.paymentRetry}>
                <Text style={styles.paymentRetryText}>{t('check_again')}</Text>
              </Pressable>
            )}
          </View>
        )}
        {booking.status === 'cancelled' && (
          <View style={styles.refundNotice}>
            <Text style={styles.refundNoticeTitle}>{t('cancellation_and_refund')}</Text>
            <Text style={styles.refundNoticeText}>
              {getBookingStatusMessage(booking.status, t)}{' '}
              {getRefundMessage(bookingRefund) ?? 'No refund record is available for this booking.'}
            </Text>
          </View>
        )}

        {/* Items breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ticket_breakdown')}</Text>
          {booking.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.categoryNameEn}</Text>
              <Text style={styles.itemDetail}>
                {item.quantity} × {item.unitPriceEtb} ETB
              </Text>
              <Text style={styles.itemTotal}>{item.subtotalEtb} ETB</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.itemRow}>
            <Text style={[styles.itemName, { fontWeight: '900' }]}>{t('total')}</Text>
            <Text style={[styles.itemTotal, { fontSize: 18, fontWeight: '900' }]}>
              {booking.totalAmountEtb} ETB
            </Text>
          </View>
        </View>

        {/* Attended counts (post-visit) */}
        {isVisited && booking.items.some((i) => i.attendedQuantity !== undefined) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('attendance')}</Text>
            {booking.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.categoryNameEn}</Text>
                <Text style={styles.itemDetail}>
                  {t('attended')}: {item.attendedQuantity ?? 0} / {item.quantity}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Reschedule mode */}
        {rescheduleMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('choose_date')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {dateOptions.map((d) => {
                const str = toDateStr(d);
                const selected = newDate ? toDateStr(newDate) === str : false;
                return (
                  <Pressable
                    key={str}
                    style={[styles.dateChip, selected && styles.dateChipActive]}
                    onPress={() => setNewDate(d)}
                  >
                    <Text style={[styles.dateChipDay, selected && { color: '#FFF' }]}>
                      {d.toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                    <Text style={[styles.dateChipNum, selected && { color: '#FFF' }]}>
                      {d.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionBtn, styles.confirmBtn, !newDate && styles.disabledBtn]}
                onPress={() => newDate && rescheduleMutation.mutate()}
                disabled={!newDate || rescheduleMutation.isPending}
              >
                {rescheduleMutation.isPending
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.actionBtnText}>{t('confirm_reschedule')}</Text>}
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.ghostBtn]}
                onPress={() => setRescheduleMode(false)}
              >
                <Text style={[styles.actionBtnText, { color: '#666' }]}>{t('cancel')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Actions */}
        {!rescheduleMode && (
          <View style={styles.actionsContainer}>
            {canReschedule && (
              <Pressable style={[styles.actionBtn, styles.rescheduleBtn]} onPress={() => setRescheduleMode(true)}>
                <RotateCcw size={18} color="#1565C0" />
                <Text style={[styles.actionBtnText, { color: '#1565C0' }]}>{t('reschedule')}</Text>
              </Pressable>
            )}
            {canCancel && (
              <Pressable
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => setCancelConfirmVisible(true)}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending
                  ? <ActivityIndicator color="#D32F2F" />
                  : <>
                      <XCircle size={18} color="#D32F2F" />
                      <Text style={[styles.actionBtnText, { color: '#D32F2F' }]}>{t('cancel_booking')}</Text>
                    </>}
              </Pressable>
            )}
            {cancelError && (
              <View style={styles.cancelError}>
                <Text style={styles.cancelErrorText}>{cancelError}</Text>
                <Pressable
                  onPress={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                >
                  <Text style={styles.cancelRetryText}>{t('retry')}</Text>
                </Pressable>
              </View>
            )}
            {booking.status === 'visited' && booking.items.some(i => i.attendedQuantity !== undefined && i.attendedQuantity < i.quantity) && (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: '#FFF3E0', borderColor: '#FFE0B2', borderWidth: 1 }]}
                onPress={() =>
                  Alert.alert(t('request_refund'), t('request_refund_confirmation'), [
                    { text: t('cancel'), style: 'cancel' },
                    { text: t('submit_request'), style: 'default', onPress: () => refundMutation.mutate() },
                  ])
                }
                disabled={refundMutation.isPending}
              >
                {refundMutation.isPending ? <ActivityIndicator color="#E65100" /> : <Text style={[styles.actionBtnText, { color: '#E65100' }]}>{t('request_partial_refund')}</Text>}
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
      <Modal
        visible={cancelConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelConfirmVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{t('cancel_booking_question')}</Text>
            <Text style={styles.confirmBody}>
              {booking.status === 'pending'
                ? t('paid_cancel_confirmation')
                : t('unpaid_cancel_confirmation')}
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmAction, styles.confirmNo]}
                onPress={() => setCancelConfirmVisible(false)}
                disabled={cancelMutation.isPending}
              >
                <Text style={styles.confirmNoText}>{t('keep_booking')}</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmAction, styles.confirmYes]}
                onPress={() => {
                  setCancelConfirmVisible(false);
                  cancelMutation.mutate();
                }}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.confirmYesText}>{t('cancel_booking')}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getStatusColor(s: Booking['status']) {
  const map: Record<string, string> = {
    pending: '#2E7D32', awaiting_payment: '#E65100', visited: '#1565C0',
    cancelled: '#757575', refunded: '#6A1B9A',
  };
  return map[s] ?? '#333';
}

function getStatusStyle(s: Booking['status']) {
  const c = getStatusColor(s);
  return { backgroundColor: c + '20', borderColor: c + '40', borderWidth: 1 };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scroll: { padding: 24, paddingBottom: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errText: { fontSize: 16, color: '#666', marginBottom: 20 },
  backBtn: { backgroundColor: '#2E7D32', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  backBtnText: { color: '#FFF', fontWeight: '700' },

  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backText: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginLeft: 8 },

  refCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  ref: { fontSize: 22, fontWeight: '900', color: '#1A1A1A', marginBottom: 4 },
  dateLabel: { fontSize: 15, color: '#666', marginBottom: 12 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  qrCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  qrLabel: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  qrSub: { fontSize: 13, color: '#888', marginBottom: 20 },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },

  payBtn: {
    backgroundColor: '#E65100',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 14,
    marginBottom: 16,
  },
  payBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16, marginLeft: 10 },
  paymentNotice: {
    backgroundColor: '#E8F5E9',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paymentNoticeText: { fontSize: 14, color: '#1B5E20', lineHeight: 20 },
  paymentRetry: { marginLeft: 'auto', paddingLeft: 8 },
  paymentRetryText: { color: '#1B5E20', fontWeight: '800' },
  refundNotice: {
    backgroundColor: '#F3E5F5',
    borderColor: '#CE93D8',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  refundNoticeTitle: { color: '#4A148C', fontSize: 15, fontWeight: '800', marginBottom: 6 },
  refundNoticeText: { color: '#4A148C', lineHeight: 20 },
  cancelError: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelErrorText: { flex: 1, color: '#B71C1C', lineHeight: 20 },
  cancelRetryText: { color: '#B71C1C', fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 22,
  },
  confirmTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', marginBottom: 10 },
  confirmBody: { color: '#555', lineHeight: 21, marginBottom: 20 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  confirmAction: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  confirmNo: { backgroundColor: '#F1F3F5' },
  confirmYes: { backgroundColor: '#D32F2F' },
  confirmNoText: { color: '#444', fontWeight: '700' },
  confirmYesText: { color: '#FFF', fontWeight: '800' },

  section: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  itemName: { fontSize: 15, color: '#1A1A1A', fontWeight: '600', flex: 1 },
  itemDetail: { fontSize: 14, color: '#888' },
  itemTotal: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginLeft: 8 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 10 },

  dateChip: {
    width: 58, paddingVertical: 12, alignItems: 'center',
    backgroundColor: '#F5F7FA', borderRadius: 14, marginRight: 10,
    borderWidth: 1.5, borderColor: '#E5E9F0',
  },
  dateChipActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  dateChipDay: { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 4 },
  dateChipNum: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },

  actionsContainer: { gap: 12 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 20,
  },
  confirmBtn: { flex: 1, backgroundColor: '#2E7D32' },
  ghostBtn: { flex: 1, backgroundColor: '#F5F7FA', borderWidth: 1, borderColor: '#E5E9F0' },
  rescheduleBtn: { backgroundColor: '#E3F2FD', borderWidth: 1, borderColor: '#BBDEFB' },
  cancelBtn: { backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2' },
  disabledBtn: { opacity: 0.4 },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF', marginLeft: 8 },
});
