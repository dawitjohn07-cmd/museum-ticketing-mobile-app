import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { getBooking, verifyBookingPayment } from '../../src/lib/api/services';
import { useAuth } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { colors } from '../../src/theme';

// Landing route for Chapa's return (deep link frontend://payment-return/<id> or the
// Expo-web URL). The redirect itself proves nothing: we ask the server to verify
// the transaction with Chapa, then show the booking.
export default function PaymentReturn() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const [msg, setMsg] = useState(t('checking_payment_status'));
  const started = useRef(false);

  useEffect(() => {
    if (isLoading || !id) return;
    const target = `/(visitor)/booking/${id}`;
    if (!isAuthenticated) {
      router.replace({ pathname: '/(auth)/login', params: { redirect: target } } as never);
      return;
    }
    if (started.current) return;
    started.current = true;
    (async () => {
      for (let i = 0; i < 6; i += 1) {
        let b;
        try { b = await verifyBookingPayment(id); } catch { try { b = await getBooking(id); } catch { b = undefined; } }
        if (b) {
          qc.setQueryData(['booking', id], b);
          if (b.status !== 'awaiting_payment') break;
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      qc.invalidateQueries({ queryKey: ['myBookings'] });
      setMsg(t('processing'));
      router.replace(target as never);
    })();
  }, [id, isAuthenticated, isLoading, qc, router, t]);

  return (
    <View style={s.c}>
      <ActivityIndicator size="large" color={colors.forestBright} />
      <Text style={s.t}>{msg}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.cream },
  t: { marginTop: 16, color: colors.ink, fontWeight: '700', textAlign: 'center' },
});
