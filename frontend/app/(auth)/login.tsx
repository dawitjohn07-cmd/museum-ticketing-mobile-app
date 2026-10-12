import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { startVisitorVerification } from '../../src/lib/api/services';
import { getApiErrorMessageForDisplay } from '../../src/lib/api/client';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { LanguageSelector } from '../../src/components/LanguageSelector';
import { Banner, Button, Field } from '../../src/components/ui';
import { colors, radii, shadows } from '../../src/theme';

export const PHONE_RE = /^(\+251|0)?[7-9][0-9]{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { t, locale } = useTranslation();
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
        email: e, phone: p, full_name: fullName.trim() || undefined, language_preference: locale,
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
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.topRow}><Text style={s.kicker}>ZNHM-AAU</Text><LanguageSelector /></View>
          <Text style={s.title}>Meet the wild heart of Ethiopia.</Text>
          <Text style={s.subtitle}>{t('login_subtitle')}</Text>
          <View style={s.card}>
            {error ? <Banner text={error} /> : null}
            <Field label={t('full_name_optional')} value={fullName} onChangeText={setFullName} autoComplete="name" />
            <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" error={errors.email} />
            <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="0912345678" error={errors.phone} onSubmitEditing={requestOtp} />
            <Button label={t('send_verification_code')} onPress={requestOtp} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.forest },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  kicker: { color: colors.moss, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 34, fontWeight: '900', lineHeight: 41 },
  subtitle: { color: '#D6E9D4', fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 24 },
  card: { backgroundColor: colors.paper, borderRadius: radii.lg, padding: 22, ...shadows.floating },
});
