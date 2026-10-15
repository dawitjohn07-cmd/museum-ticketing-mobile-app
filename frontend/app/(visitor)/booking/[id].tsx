import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelBooking, getBooking, getCategories, getMyRefunds, requestPartialRefund, rescheduleBooking, updateBooking, verifyBookingPayment,
  type Booking,
} from '../../../src/lib/api/services';
import { ApiError, getAccessToken, getApiBaseUrl, getApiErrorMessageForDisplay, refreshAccessToken } from '../../../src/lib/api/client';
import { useRequireAuth } from '../../../src/hooks/useAuth';
import { useTranslation } from '../../../src/lib/i18n/useTranslation';
import { useTheme } from '../../../src/lib/theme/useTheme';
import { CategoryPicker, itemsFrom } from '../../../src/components/CategoryPicker';
import { MonthCalendar } from '../../../src/components/MonthCalendar';
import { DigitalTicket } from '../../../src/components/DigitalTicket';
import { Banner, Body, BrandHeader, Button, Card, Heading, Kicker, Screen, Sheet, StatusBadge } from '../../../src/components/ui';
import { formatDate, formatDateTime } from '../../../src/lib/dates';
import { fonts } from '../../../src/theme';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// Ask the server to verify with Chapa; if that call fails, fall back to a plain read.
const reconcile = async (bookingId: string) => {
  try { return await verifyBookingPayment(bookingId); } catch { return getBooking(bookingId); }
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [notice, setNotice] = useState<{ text: string; kind: 'error' | 'info' | 'success' } | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirm, setConfirm] = useState<null | 'cancel'>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [reschedOpen, setReschedOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editQty, setEditQty] = useState<Record<string, number>>({});
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
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
        latest = await reconcile(id);
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
      if (st === 'active' && q.data?.status === 'awaiting_payment' && !polling.current) void pollPayment();
    });
    return () => sub.remove();
  }, [q, pollPayment]);

  const openCheckout = async () => {
    if (!booking?.checkoutUrl) return;
    if (Platform.OS === 'web') {
      // Same tab: Chapa returns to <web>/payment-return/<id>, which verifies the payment.
      window.location.assign(booking.checkoutUrl);
      return;
    }
    // Native: an auth session closes itself when Chapa returns to the app link; whatever
    // the outcome (success, cancel, dismissed) we then verify with the server.
    await WebBrowser.openAuthSessionAsync(booking.checkoutUrl, Linking.createURL('payment-return'));
    void pollPayment();
  };
  const openReceipt = async () => {
    if (!booking?.receiptUrl || downloadingReceipt) return;

    if (Platform.OS === 'web') {
      await WebBrowser.openBrowserAsync(booking.receiptUrl);
      return;
    }

    setDownloadingReceipt(true);
    try {
      const download = async (token: string | null) =>
        FileSystem.downloadAsync(
          `${getApiBaseUrl()}/bookings/${booking.id}/receipt/download/`,
          `${FileSystem.cacheDirectory}receipt-${booking.reference}.pdf`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );

      let result = await download(await getAccessToken());
      if (result.status === 401) {
        const freshToken = await refreshAccessToken();
        if (freshToken) result = await download(freshToken);
      }
      if (result.status < 200 || result.status >= 300) {
        throw new Error(`Receipt download failed (HTTP ${result.status}).`);
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: t('download_receipt'),
          UTI: 'com.adobe.pdf',
        });
      } else {
        await WebBrowser.openBrowserAsync(result.uri);
      }
    } catch (e) {
      fail(e);
    } finally {
      setDownloadingReceipt(false);
    }
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

  if (authLoading || !isAuthenticated || q.isLoading) {
    return <Screen scroll={false}><View style={s.center}><ActivityIndicator size="large" color={colors.lime} /></View></Screen>;
  }
  if (q.isError || !booking) {
    return (
      <Screen stickyHeader={<BrandHeader onBack={() => router.replace('/(visitor)/bookings' as never)} />}>
        <Heading size={34}>{t('booking_not_found')}</Heading>
        <Body style={{ marginBottom: 12 }}>{q.error ? getApiErrorMessageForDisplay(q.error) : t('booking_not_found_description')}</Body>
        <Button label={t('back_to_bookings')} onPress={() => router.replace('/(visitor)/bookings' as never)} />
      </Screen>
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
    <Screen stickyHeader={<><BrandHeader onBack={() => router.replace('/(visitor)/bookings' as never)} /><Kicker>ARCHIVE / TICKET</Kicker></>}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Heading size={38} style={{ marginBottom: 2 }}>{t('booking_details')}</Heading>
          <Text style={[s.ref, { color: colors.lime }]}>#{booking.reference}</Text>
        </View>
        <StatusBadge status={booking.status} />
      </View>

      {notice ? <Banner text={notice.text} kind={notice.kind} /> : null}

      <Card>
        <Row k={t('visit_date')} v={formatDate(booking.visitDate, locale)} />
        {booking.bookingType === 'group' && booking.groupName ? <Row k={t('group_name')} v={booking.groupName} /> : null}
        <Row k={t('category')} v={summary} />
        <Row k={t('quantity')} v={String(booking.bookedQuantity)} />
        <Row k={t('total')} v={`ETB ${booking.totalAmountEtb}`} strong />
        {booking.attendedQuantity !== null && booking.attendedQuantity !== undefined ? <Row k={t('attended')} v={String(booking.attendedQuantity)} /> : null}
        <Row k={t('booked_on')} v={formatDateTime(booking.createdAt, locale)} />
        {showReceipt ? <Button label={downloadingReceipt ? t('processing') : t('download_receipt')} variant="secondary" onPress={openReceipt} disabled={downloadingReceipt} /> : null}
      </Card>

      {isAwaiting && (
        <Card style={{ borderColor: colors.lime }}>
          <Text style={[s.h2, { color: colors.text }]}>{t('payment_required')}</Text>
          <Body>{booking.categoryCorrectedAt ? t('payment_required_correction_description') : t('payment_required_description')}</Body>
          {booking.checkoutUrl ? (
            <Button label={checking ? t('processing') : t('pay_now')} loading={checking} onPress={openCheckout} />
          ) : (
            <Text style={{ color: colors.danger, marginTop: 8 }}>{t('checkout_unavailable')}</Text>
          )}
          {Platform.OS === 'web' || notice?.kind === 'info' ? <Button label={t('check_again')} variant="secondary" onPress={pollPayment} disabled={checking} /> : null}
          <Button label={t('edit_booking')} variant="ghost" onPress={openEdit} />
          <Button label={t('delete_booking')} variant="danger" onPress={() => setConfirm('cancel')} />
        </Card>
      )}

      {isPending && (
        <DigitalTicket reference={booking.reference} dateLabel={formatDate(booking.visitDate, locale)} summary={summary} />
      )}

      {shortfall && (
        <Card style={{ borderColor: colors.warn }}>
          <Text style={[s.h2, { color: colors.text }]}>{t('partial_attendance_recorded')}</Text>
          <Body>
            {booking.bookedQuantity - (booking.attendedQuantity ?? 0)} / {booking.bookedQuantity}
            {booking.status === 'visited' ? `\n${t('refund_available')}` : ''}
          </Body>
          {booking.status === 'visited' ? (
            refundRow || refund.isSuccess ? <Text style={{ color: colors.lime, fontWeight: '800', marginTop: 8 }}>✓ {t('refund_requested')}</Text>
              : <Button label={t('request_refund')} loading={refund.isPending} onPress={() => refund.mutate()} />
          ) : null}
        </Card>
      )}

      {(booking.status === 'cancelled' || booking.status === 'refunded') && (
        <Card>
          <Text style={[s.h2, { color: colors.text }]}>{t('cancellation')}</Text>
          <Body>
            {!cancelRefund ? t('no_refund_record') : cancelRefund.status === 'completed' ? t('refund_completed') : cancelRefund.status === 'failed' ? t('refund_failed') : t('refund_processing')}
          </Body>
        </Card>
      )}

      <Card>
        <Text style={[s.h2, { color: colors.text }]}>{t('manage_booking')}</Text>
        {isPending ? (
          <>
            <Body>{t('manage_booking_description')}</Body>
            {canReschedule ? <Button label={t('reschedule')} variant="secondary" onPress={() => { setNewDate(''); setReschedOpen(true); }} /> : <Body style={{ marginTop: 8 }}>{t('max_reschedule_reached')}</Body>}
            <Button label={t('cancel_booking')} variant="danger" onPress={() => setConfirm('cancel')} />
          </>
        ) : (
          <Body>
            {booking.status === 'visited' ? t('already_visited') : booking.status === 'cancelled' ? t('already_cancelled') : booking.status === 'refunded' ? t('already_refunded') : t('awaiting_payment_message')}
          </Body>
        )}
      </Card>

      <Sheet visible={confirm === 'cancel'} onClose={() => setConfirm(null)} title={isPending ? t('cancel_booking') : t('delete_booking')}>
        <Body>{isPending ? t('cancel_confirmation') : t('delete_unpaid_booking_confirmation')}</Body>
        <Button label={isPending ? t('cancel_booking') : t('delete_booking')} variant="danger" loading={cancel.isPending} onPress={() => { setConfirm(null); cancel.mutate(); }} />
        <Button label={t('back')} variant="ghost" onPress={() => setConfirm(null)} />
      </Sheet>

      <Sheet visible={reschedOpen} onClose={() => setReschedOpen(false)} title={t('reschedule_booking')}>
        <Body style={{ marginBottom: 10 }}>{t('current_date')}: {formatDate(booking.visitDate, locale)}</Body>
        <MonthCalendar value={newDate} onChange={setNewDate} />
        <Body>{t('reschedule_note')}</Body>
        <Button label={t('confirm')} disabled={!newDate} loading={reschedule.isPending} onPress={() => reschedule.mutate()} />
        <Button label={t('cancel')} variant="ghost" onPress={() => setReschedOpen(false)} />
      </Sheet>

      <Sheet visible={editOpen} onClose={() => setEditOpen(false)} title={t('edit_booking')}>
        <MonthCalendar value={editDate} onChange={setEditDate} />
        {cats.isLoading ? <ActivityIndicator color={colors.lime} /> : <CategoryPicker categories={cats.data ?? []} quantities={editQty} onChange={setEditQty} />}
        <Button label={t('save_changes')} disabled={Object.keys(editQty).length === 0 || !editDate} loading={save.isPending} onPress={() => save.mutate()} />
        <Button label={t('cancel')} variant="ghost" onPress={() => setEditOpen(false)} />
      </Sheet>
    </Screen>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={s.row}>
      <Text style={[s.k, { color: colors.muted }]}>{k}</Text>
      <Text style={[s.v, { color: strong ? colors.lime : colors.text }, strong && { fontWeight: '900', fontSize: 18 }]}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  h2: { fontFamily: fonts.serif, fontSize: 24, marginBottom: 6 },
  ref: { fontWeight: '800', letterSpacing: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7 },
  k: {},
  v: { fontWeight: '700', flex: 1, textAlign: 'right' },
});
