import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getBooking } from '../../src/lib/api/services';
import { useEffect, useRef } from 'react';
import { useTranslation } from '../../src/lib/i18n/useTranslation';

export default function PaymentReturnScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const sentToOpener = useRef(false);
  const isWebReturn = Platform.OS === 'web';
  const { t } = useTranslation();

  useEffect(() => {
    if (!isWebReturn || !id || sentToOpener.current) return;
    sentToOpener.current = true;
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: 'museum-payment-return', bookingId: id },
        window.location.origin,
      );
      window.setTimeout(() => window.close(), 250);
    }
  }, [id, isWebReturn]);

  const query = useQuery({
    queryKey: ['payment-return-booking', id],
    queryFn: () => getBooking(id!),
    enabled: !!id && !isWebReturn,
    retry: 1,
  });

  if (!id) {
    return <Message title={t('payment_return_missing_reference')} onBack={() => router.replace('/(visitor)/home')} />;
  }
  if (isWebReturn) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>{t('payment_return_received')}</Text>
        <Text style={styles.body}>
          {t('payment_return_checking')}
        </Text>
        <Pressable style={styles.button} onPress={() => window.close()}>
          <Text style={styles.buttonText}>{t('close_return_window')}</Text>
        </Pressable>
      </View>
    );
  }
  if (query.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.body}>{t('checking_payment_status')}</Text>
      </View>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Message
        title={t('payment_status_check_failed')}
        body={t('payment_return_no_change')}
        onBack={() => router.replace('/(visitor)/bookings')}
      />
    );
  }

  const status = query.data.status;
  const title =
    status === 'pending' ? t('payment_confirmed') :
    status === 'awaiting_payment' ? t('payment_pending') :
    `${t('payment_status')}: ${status.replace('_', ' ')}`;
  const body =
    status === 'pending'
      ? t('payment_confirmed_message')
      : status === 'awaiting_payment'
        ? t('payment_pending_message')
        : t('payment_not_confirmed_message');

  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable style={styles.button} onPress={() => router.replace(`/(visitor)/booking/${id}`)}>
        <Text style={styles.buttonText}>{t('booking_details')}</Text>
      </Pressable>
      <Pressable onPress={() => void query.refetch()}>
        <Text style={styles.retry}>{t('check_again')}</Text>
      </Pressable>
    </View>
  );
}

function Message({ title, body, onBack }: { title: string; body?: string; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{title}</Text>
      {body && <Text style={styles.body}>{body}</Text>}
      <Pressable style={styles.button} onPress={onBack}>
        <Text style={styles.buttonText}>{t('return_to_visitor_app')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F5F7FA' },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  button: { backgroundColor: '#2E7D32', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 13, marginBottom: 16 },
  buttonText: { color: '#FFF', fontWeight: '800' },
  retry: { color: '#2E7D32', fontWeight: '700' },
});
