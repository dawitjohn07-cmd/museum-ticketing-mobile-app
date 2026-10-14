import { useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { confirmVisitorOtp, startVisitorVerification } from '../../src/lib/api/services';
import { getApiErrorMessageForDisplay } from '../../src/lib/api/client';
import { safeRedirect, useAuth } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { useTheme } from '../../src/lib/theme/useTheme';
import { Banner, Body, BrandHeader, Button, Card, Field, Heading, Kicker, Screen } from '../../src/components/ui';

export default function VerifyScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
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
    <Screen stickyHeader={<><BrandHeader onBack={() => router.back()} /><Kicker>ZNHM–AAU / GATEWAY 03</Kicker></>}>
      <Heading size={44}>{t('enter_otp')}</Heading>
      <Body style={{ marginBottom: 24 }}>{t('otp_sent_to')}{'\n'}<Text style={{ color: colors.lime, fontWeight: '800' }}>{p.phone}</Text></Body>
      <Card>
        {error ? <Banner text={error} /> : null}
        {notice ? <Banner text={notice} kind="success" /> : null}
        <Field label={t('one_time_code')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} placeholder="123456" style={{ fontSize: 26, letterSpacing: 10, textAlign: 'center' }} onSubmitEditing={handleVerify} />
        <Button label={t('verify_continue')} onPress={handleVerify} loading={loading} />
        <Button label={t('resend_code')} variant="secondary" onPress={resend} disabled={loading} />
      </Card>
    </Screen>
  );
}
