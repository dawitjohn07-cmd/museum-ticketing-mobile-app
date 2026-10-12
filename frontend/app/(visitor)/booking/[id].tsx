import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelBooking, getBooking, getCategories, getMyRefunds, requestPartialRefund, rescheduleBooking, updateBooking,
  type Booking,
} from '../../../src/lib/api/services';
import { ApiError, getApiErrorMessageForDisplay } from '../../../src/lib/api/client';
import { useRequireAuth } from '../../../src/hooks/useAuth';
import { useTranslation } from '../../../src/lib/i18n/useTranslation';
import { CategoryPicker, itemsFrom } from '../../../src/components/CategoryPicker';
import { MonthCalendar } from '../../../src/components/MonthCalendar';
import { DigitalTicket } from '../../../src/components/DigitalTicket';
import { Banner, Button, StatusBadge } from '../../../src/components/ui';
import { formatDate, formatDateTime } from '../../../src/lib/dates';
import { colors, radii, shadows } from '../../../src/theme';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={s.sheetTitle}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t, locale } = useTranslation();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [notice, setNotice] = useState<{ text: string; kind: 'error' | 'info' | 'success' } | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirm, setConfirm] = useState<null | 'cancel'>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [reschedOpen, setReschedOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editQty, setEditQty] = useState<Record<string, number>>({});
  const polling = useRef(false);

  const q = useQuery({ queryKey: ['booking', id], queryFn: () => getBooking(id!), enabled: !!id && isAuthenticated });
  const refunds = useQuery({ queryKey: ['myRefunds'], queryFn: () => getMyRefunds(), enabled: isAuthenticated });
  const cats = useQuery({ queryKey: ['categories'], queryFn: getCategories, enabled: editOpen });
  const booking = q.data;
  const refundRow = refunds.data?.data.find((r) => r.bookingId === id && r.reason === 'partial_shortfall' && r.status !== 'failed');
  const cancelRefund = refunds.data?.data.find((r) => r.bookingId === id && r.reason === 'cancellation');

  const setBooking = (b: Booking) => {
    qc.setQueryData(['booking', id], b);
    qc.invalidateQueries({ queryKey: ['myBookings'] });
    qc.invalidateQueries({ queryKey: ['myRefunds'] });
  };
  const fail = (e: unknown) => setNotice({ text: getApiErrorMessageForDisplay(e), kind: 'error' });

  // Payment is confirmed only by Chapa's webhook on the server, so after checkout we
  // poll GET /bookings/{id}/ (same as the website's return page) until status changes.
  const pollPayment = useCallback(async () => {
    if (!id || polling.current) return;
    polling.current = true;
    setChecking(true);
    setNotice({ text: t('checking_payment_status'), kind: 'info' });
    try {
      let latest: Booking | undefined;
      for (let i = 0; i < 8; i += 1) {
        latest = await getBooking(id);
        qc.setQueryData(['booking', id], latest);
        if (latest.status !== 'awaiting_payment') break;
        await wait(2500);
      }
      qc.invalidateQueries({ queryKey: ['myBookings'] });
      if (latest?.status === 'pending') setNotice({ text: t('payment_confirmed_message'), kind: 'success' });
      else if (latest?.status === 'awaiting_payment') setNotice({ text: t('payment_check_pending'), kind: 'info' });
      else setNotice(null);
    } catch (e) {
      fail(e);
    } finally {
      polling.current = false;
      setChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, qc]);

  // Returning to the app/tab after paying elsewhere: refresh once.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && q.data?.status === 'awaiting_payment' && !polling.current) q.refetch();
    });
    return () => sub.remove();
  }, [q]);

  const openCheckout = async () => {
    if (!booking?.checkoutUrl) return;
    if (Platform.OS === 'web') {
      window.open(booking.checkoutUrl, '_blank');
      setNotice({ text: t('payment_check_pending'), kind: 'info' });
      return;
    }
    await WebBrowser.openBrowserAsync(booking.checkoutUrl);
    void pollPayment();
  };
  const openReceipt = async () => {
    if (booking?.receiptUrl) await WebBrowser.openBrowserAsync(booking.receiptUrl);
  };

  const cancel = useMutation({
    mutationFn: () => cancelBooking(id!),
    onSuccess: (b) => { setBooking(b); setNotice({ text: booking?.status === 'pending' ? t('booking_cancel_success') : t('booking_deleted'), kind: 'success' }); },
    onError: fail,
  });
  const reschedule = useMutation({
    mutationFn: () => rescheduleBooking(id!, newDate),
    onSuccess: (b) => { setBooking(b); setReschedOpen(false); setNewDate(''); setNotice({ text: t('booking_rescheduled'), kind: 'success' }); },
    onError: fail,
  });
  const save = useMutation({
    mutationFn: () => updateBooking(id!, { items: itemsFrom(editQty), visitDate: editDate }),
    onSuccess: (b) => { setBooking(b); setEditOpen(false); setNotice({ text: t('booking_updated'), kind: 'success' }); },
    onError: fail,
  });
  const refund = useMutation({
    mutationFn: () => requestPartialRefund(id!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['myRefunds'] }); setNotice({ text: t('refund_requested'), kind: 'success' }); },
    onError: (e) => {
      if (e instanceof ApiError && (e.status === 409 || e.code === 'conflict')) {
        qc.invalidateQueries({ queryKey: ['myRefunds'] });
        setNotice({ text: t('refund_already_requested'), kind: 'success' });
      } else fail(e);
    },
  });

  if (authLoading || !isAuthenticated || q.isLoading) return <View style={s.center}><ActivityIndicator size="large" color={colors.forestBright} /></View>;
  if (q.isError || !booking) {
    return (
      <View style={s.center}>
        <Text style={s.h2}>{t('booking_not_found')}</Text>
        <Text style={s.muted}>{q.error ? getApiErrorMessageForDisplay(q.error) : t('booking_not_found_description')}</Text>
        <Button label={t('back_to_bookings')} onPress={() => router.replace('/(visitor)/bookings' as never)} />
      </View>
    );
  }

  const itemName = (i: Booking['items'][number]) => (locale === 'am' && i.categoryNameAm ? i.categoryNameAm : i.categoryNameEn);
  const summary = booking.items.map((i) => `${itemName(i)} ×${i.quantity}`).join(', ');
  const isAwaiting = booking.status === 'awaiting_payment';
  const isPending = booking.status === 'pending';
  const canReschedule = isPending && booking.rescheduledCount < 1;
  const shortfall = booking.attendedQuantity !== null && booking.attendedQuantity !== undefined && booking.attendedQuantity < booking.bookedQuantity;
  const showReceipt = !!booking.receiptUrl && booking.status !== 'cancelled' && booking.status !== 'refunded';

  const openEdit = () => {
    setEditQty(Object.fromEntries(booking.items.map((i) => [i.categoryId, i.quantity])));
    setEditDate(booking.visitDate);
    setEditOpen(true);
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Button label={`← ${t('back_to_bookings')}`} variant="secondary" onPress={() => router.replace('/(visitor)/bookings' as never)} />
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>{t('booking_details')}</Text>
            <Text style={s.ref}>#{booking.reference}</Text>
          </View>
          <StatusBadge status={booking.status} />
        </View>

        {notice ? <Banner text={notice.text} kind={notice.kind} /> : null}

        <View style={s.card}>
          <Row k={t('visit_date')} v={formatDate(booking.visitDate, locale)} />
          {booking.bookingType === 'group' && booking.groupName ? <Row k={t('group_name')} v={booking.groupName} /> : null}
          <Row k={t('category')} v={summary} />
          <Row k={t('quantity')} v={String(booking.bookedQuantity)} />
          <Row k={t('total')} v={`ETB ${booking.totalAmountEtb}`} strong />
          {booking.attendedQuantity !== null && booking.attendedQuantity !== undefined ? <Row k={t('attended')} v={String(booking.attendedQuantity)} /> : null}
          <Row k={t('booked_on')} v={formatDateTime(booking.createdAt, locale)} />
          {showReceipt ? <Button label={t('download_receipt')} variant="secondary" onPress={openReceipt} /> : null}
        </View>

        {isAwaiting && (
          <View style={[s.card, { backgroundColor: '#EEF7F0' }]}>
            <Text style={s.h2}>{t('payment_required')}</Text>
            <Text style={s.muted}>{booking.categoryCorrectedAt ? t('payment_required_correction_description') : t('payment_required_description')}</Text>
            {booking.checkoutUrl ? (
              <Button label={checking ? t('processing') : t('pay_now')} loading={checking} onPress={openCheckout} />
            ) : (
              <Text style={[s.muted, { color: colors.danger }]}>{t('checkout_unavailable')}</Text>
            )}
            {Platform.OS === 'web' || notice?.kind === 'info' ? <Button label={t('check_again')} variant="secondary" onPress={pollPayment} disabled={checking} /> : null}
            <Button label={t('edit_booking')} variant="secondary" onPress={openEdit} />
            <Button label={t('delete_booking')} variant="danger" onPress={() => setConfirm('cancel')} />
          </View>
        )}

        {isPending && (
          <DigitalTicket reference={booking.reference} dateLabel={formatDate(booking.visitDate, locale)} summary={summary} />
        )}

        {shortfall && (
          <View style={[s.card, { backgroundColor: '#FFF3E0' }]}>
            <Text style={s.h2}>{t('partial_attendance_recorded')}</Text>
            <Text style={s.muted}>
              {booking.bookedQuantity - (booking.attendedQuantity ?? 0)} / {booking.bookedQuantity}
              {booking.status === 'visited' ? `\n${t('refund_available')}` : ''}
            </Text>
            {booking.status === 'visited' ? (
              refundRow || refund.isSuccess ? <Text style={[s.muted, { fontWeight: '800' }]}>✓ {t('refund_requested')}</Text>
                : <Button label={t('request_refund')} loading={refund.isPending} onPress={() => refund.mutate()} />
            ) : null}
          </View>
        )}

        {(booking.status === 'cancelled' || booking.status === 'refunded') && (
          <View style={s.card}>
            <Text style={s.h2}>{t('cancellation')}</Text>
            <Text style={s.muted}>
              {!cancelRefund ? t('no_refund_record') : cancelRefund.status === 'completed' ? t('refund_completed') : cancelRefund.status === 'failed' ? t('refund_failed') : t('refund_processing')}
            </Text>
          </View>
        )}

        <View style={s.card}>
          <Text style={s.h2}>{t('manage_booking')}</Text>
          {isPending ? (
            <>
              <Text style={s.muted}>{t('manage_booking_description')}</Text>
              {canReschedule ? <Button label={t('reschedule')} variant="secondary" onPress={() => { setNewDate(''); setReschedOpen(true); }} /> : <Text style={s.muted}>{t('max_reschedule_reached')}</Text>}
              <Button label={t('cancel_booking')} variant="danger" onPress={() => setConfirm('cancel')} />
            </>
          ) : (
            <Text style={s.muted}>
              {booking.status === 'visited' ? t('already_visited') : booking.status === 'cancelled' ? t('already_cancelled') : booking.status === 'refunded' ? t('already_refunded') : t('awaiting_payment_message')}
            </Text>
          )}
        </View>
      </ScrollView>

      <Sheet visible={confirm === 'cancel'} onClose={() => setConfirm(null)} title={isPending ? t('cancel_booking') : t('delete_booking')}>
        <Text style={s.muted}>{isPending ? t('cancel_confirmation') : t('delete_unpaid_booking_confirmation')}</Text>
        <Button label={isPending ? t('cancel_booking') : t('delete_booking')} variant="danger" loading={cancel.isPending} onPress={() => { setConfirm(null); cancel.mutate(); }} />
        <Button label={t('back')} variant="secondary" onPress={() => setConfirm(null)} />
      </Sheet>

      <Sheet visible={reschedOpen} onClose={() => setReschedOpen(false)} title={t('reschedule_booking')}>
        <Text style={s.muted}>{t('current_date')}: {formatDate(booking.visitDate, locale)}</Text>
        <MonthCalendar value={newDate} onChange={setNewDate} />
        <Text style={s.muted}>{t('reschedule_note')}</Text>
        <Button label={t('confirm')} disabled={!newDate} loading={reschedule.isPending} onPress={() => reschedule.mutate()} />
        <Button label={t('cancel')} variant="secondary" onPress={() => setReschedOpen(false)} />
      </Sheet>

      <Sheet visible={editOpen} onClose={() => setEditOpen(false)} title={t('edit_booking')}>
        <MonthCalendar value={editDate} onChange={setEditDate} />
        <View style={{ height: 12 }} />
        {cats.isLoading ? <ActivityIndicator color={colors.forestBright} /> : <CategoryPicker categories={cats.data ?? []} quantities={editQty} onChange={setEditQty} />}
        <Button label={t('save_changes')} disabled={Object.keys(editQty).length === 0 || !editDate} loading={save.isPending} onPress={() => save.mutate()} />
        <Button label={t('cancel')} variant="secondary" onPress={() => setEditOpen(false)} />
      </Sheet>
    </SafeAreaView>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.k}>{k}</Text>
      <Text style={[s.v, strong && { fontWeight: '900', fontSize: 17 }]}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { padding: 16, paddingBottom: 48 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 14 },
  h1: { fontSize: 24, fontWeight: '900', color: colors.ink },
  h2: { fontSize: 17, fontWeight: '900', color: colors.ink, marginBottom: 6 },
  ref: { color: colors.inkSoft, marginTop: 2, fontWeight: '700' },
  muted: { color: colors.inkSoft, lineHeight: 21, marginVertical: 6 },
  card: { backgroundColor: '#fff', borderRadius: radii.md, padding: 16, marginBottom: 14, ...shadows.card },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
  k: { color: colors.inkSoft },
  v: { color: colors.ink, fontWeight: '700', flex: 1, textAlign: 'right' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, maxHeight: '90%' },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: colors.ink, marginBottom: 10 },
});
