import { useState } from 'react';
import { StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { startVisitorVerification } from '../../src/lib/api/services';
import { getApiErrorMessageForDisplay } from '../../src/lib/api/client';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { useTheme } from '../../src/lib/theme/useTheme';
import { Banner, BrandHeader, Body, Button, Field, Kicker, Screen } from '../../src/components/ui';
import { fonts } from '../../src/theme';

export const PHONE_RE = /^(\+251|0)?[7-9][0-9]{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ email?: string; phone?: string }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestOtp = async () => {
    const e = email.trim();
    const p = phone.trim().replace(/[\s-]/g, '');
    const next: { email?: string; phone?: string } = {};
    if (!EMAIL_RE.test(e)) next.email = t('invalid_email');
    if (!PHONE_RE.test(p)) next.phone = t('invalid_phone');
    setErrors(next);
    if (next.email || next.phone) return;
    setLoading(true);
    setError('');
    try {
      const r = await startVisitorVerification({
        email: e,
        phone: p,
        full_name: fullName.trim() || undefined,
        language_preference: locale,
      });
      router.push({
        pathname: '/(auth)/verify',
        params: { phone: p, email: e, full_name: fullName.trim(), verification_id: r.verification_id, redirect: redirect ?? '' },
      } as never);
    } catch (err) {
      setError(getApiErrorMessageForDisplay(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header — sticky at top */}
        <View style={s.header}>
          <BrandHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/(visitor)/home' as never))} />
          <Kicker>ZNHM–AAU / GATEWAY 02</Kicker>
        </View>

        {/* Form area */}
        <View style={s.formArea}>
          {/* Compact sign-in title */}
          <Text style={[s.title, { color: colors.text }]}>{t('sign_in')}</Text>
          <Body style={[s.subtitle, { color: colors.muted }]}>{t('login_subtitle')}</Body>

          {error ? <Banner text={error} /> : null}

          <Field label={t('full_name_optional')} value={fullName} onChangeText={setFullName} autoComplete="name" />
          <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" error={errors.email} />
          <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="0912345678" error={errors.phone} onSubmitEditing={requestOtp} />

          <Button label={t('send_verification_code')} onPress={requestOtp} loading={loading} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    paddingTop: 4,
    paddingBottom: 16,
  },
  formArea: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 34,
    lineHeight: 40,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 28,
    width: '80%',
  },
});
