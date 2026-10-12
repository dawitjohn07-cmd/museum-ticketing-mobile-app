import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { startVisitorVerification } from '../../src/lib/api/services';
import { getApiErrorMessageForDisplay } from '../../src/lib/api/client';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { LanguageSelector } from '../../src/components/LanguageSelector';
import { colors, radii, shadows } from '../../src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestOtp = async () => {
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();
    if (!normalizedEmail || !normalizedPhone) {
      setError(t('email_phone_required'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await startVisitorVerification({
        email: normalizedEmail,
        phone: normalizedPhone,
      });
      router.push({
        pathname: '/(auth)/verify',
        params: { phone: normalizedPhone, verification_id: result.verification_id },
      });
    } catch (err: any) {
      setError(getApiErrorMessageForDisplay(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topRow}><Text style={styles.kicker}>ZNHM-AAU</Text><LanguageSelector /></View>
        <Text style={styles.title}>Meet the wild heart of Ethiopia.</Text>
        <Text style={styles.subtitle}>
        {t('login_subtitle')}
        </Text>
        <View style={styles.card}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.label}>{t('email')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
        />
        <Text style={styles.label}>{t('phone')}</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          autoCapitalize="none"
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="+251..."
          onSubmitEditing={requestOtp}
          />
          <Pressable style={styles.button} onPress={requestOtp} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('send_verification_code')}</Text>}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.forest },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 },
  kicker: { color: colors.moss, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 38, fontWeight: '900', lineHeight: 45 },
  subtitle: { color: '#D6E9D4', fontSize: 16, lineHeight: 25, marginTop: 14, marginBottom: 30 },
  card: { backgroundColor: colors.paper, borderRadius: radii.lg, padding: 24, ...shadows.floating },
  error: { color: colors.danger, backgroundColor: '#FCEBE8', padding: 12, borderRadius: radii.sm, marginBottom: 16 },
  label: { color: colors.ink, fontWeight: '800', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: 16, fontSize: 16, marginBottom: 16, backgroundColor: '#FBFCFA', color: colors.ink },
  button: { backgroundColor: colors.forestBright, borderRadius: radii.sm, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
