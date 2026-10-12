import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { confirmVisitorOtp, startVisitorVerification } from '../../src/lib/api/services';
import { getApiErrorMessageForDisplay } from '../../src/lib/api/client';
import { safeRedirect, useAuth } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { Banner, Button, Field } from '../../src/components/ui';
import { colors, radii, shadows } from '../../src/theme';

export default function VerifyScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { signIn } = useAuth();
  const p = useLocalSearchParams<{ phone: string; email: string; full_name: string; verification_id: string; redirect: string }>();
  const [verificationId, setVerificationId] = useState(p.verification_id ?? '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) { setError(t('otp_six_digits')); return; }
    if (!verificationId) { setError(t('verification_session_missing')); return; }
    setLoading(true); setError(''); setNotice('');
    try {
      const res = await confirmVisitorOtp({ verification_id: verificationId, otp_code: code });
      const me = await signIn(res.access_token, res.user);
      const dest = p.redirect ? safeRedirect(p.redirect) : '/(visitor)/bookings';
      if (!me.email_verified_at) router.replace({ pathname: '/(auth)/email-pending', params: { redirect: dest } } as never);
      else router.replace(dest as never);
    } catch (err) {
      setError(getApiErrorMessageForDisplay(err));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!p.email || !p.phone) return;
    setLoading(true); setError(''); setNotice('');
    try {
      const r = await startVisitorVerification({ email: p.email, phone: p.phone, full_name: p.full_name || undefined, language_preference: locale });
      setVerificationId(r.verification_id);
      setNotice(t('code_resent'));
    } catch (err) {
      setError(getApiErrorMessageForDisplay(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Pressable style={s.back} onPress={() => router.back()} accessibilityLabel={t('back')}><ArrowLeft color="#FFF" size={24} /></Pressable>
        <View style={s.content}>
          <Text style={s.title}>{t('enter_otp')}</Text>
          <Text style={s.subtitle}>{t('otp_sent_to')}{'\n'}<Text style={{ color: '#A5D6A7', fontWeight: '700' }}>{p.phone}</Text></Text>
          <View style={s.card}>
            {error ? <Banner text={error} /> : null}
            {notice ? <Banner text={notice} kind="success" /> : null}
            <Field label={t('one_time_code')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} placeholder="123456" style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }} onSubmitEditing={handleVerify} />
            <Button label={t('verify_continue')} onPress={handleVerify} loading={loading} />
            <Button label={t('resend_code')} variant="secondary" onPress={resend} disabled={loading} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.forest },
  back: { padding: 24, paddingBottom: 0 },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 34, fontWeight: '900', color: '#FFF', marginBottom: 10 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.75)', lineHeight: 26, marginBottom: 28 },
  card: { backgroundColor: '#FFF', borderRadius: radii.lg, padding: 22, ...shadows.floating },
});
