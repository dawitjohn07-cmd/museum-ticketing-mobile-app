import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { KeyRound, ArrowLeft } from 'lucide-react-native';
import { getApiErrorMessageForDisplay, setAuthTokens } from '../../src/lib/api/client';
import { confirmVisitorOtp, getCurrentUser } from '../../src/lib/api/services';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { LanguageSelector } from '../../src/components/LanguageSelector';
import { colors, radii, shadows } from '../../src/theme';

export default function VerifyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { phone, verification_id } = useLocalSearchParams<{
    phone: string;
    verification_id: string;
  }>();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (code.length < 4) {
      setError(t('otp_required'));
      return;
    }
    if (!verification_id) {
      setError(t('verification_session_missing'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await confirmVisitorOtp({ verification_id, otp_code: code });
      const token = (res as any).access_token ?? (res as any).access;
      await setAuthTokens(token);
      // Verify session by fetching user profile
      await getCurrentUser();
      router.replace('/(visitor)/home');
    } catch (err: any) {
      setError(getApiErrorMessageForDisplay(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.topRow}><Pressable style={styles.back} onPress={() => router.back()}><ArrowLeft color="#FFF" size={24} /></Pressable><LanguageSelector /></View>

        <View style={styles.content}>
          <Text style={styles.title}>{t('enter_otp')}</Text>
          <Text style={styles.subtitle}>
            {t('otp_sent_to')}{'\n'}
            <Text style={styles.phoneHighlight}>{phone}</Text>
          </Text>

          <View style={styles.card}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Text style={styles.label}>{t('one_time_code')}</Text>
            <View style={styles.inputRow}>
              <KeyRound color="#757575" size={20} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('otp_placeholder')}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="go"
                onSubmitEditing={handleVerify}
              />
            </View>

            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>{t('verify_continue')}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.forest },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { padding: 24, paddingBottom: 0 },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 38, fontWeight: '900', color: '#FFF', marginBottom: 10 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 26, marginBottom: 36 },
  phoneHighlight: { color: '#A5D6A7', fontWeight: '700' },
  card: {
    backgroundColor: '#FFF',
    borderRadius: radii.lg,
    padding: 24,
    ...shadows.floating,
  },
  errorText: {
    color: '#D32F2F',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    fontSize: 14,
    overflow: 'hidden',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E9F0',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 56, fontSize: 24, letterSpacing: 8, color: '#1A1A1A', fontWeight: '700' },
  button: {
    backgroundColor: colors.forestBright,
    height: 56,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: { backgroundColor: '#1B5E20' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
