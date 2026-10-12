import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { startVisitorVerification } from '../../src/lib/api/services';
import { getApiErrorMessageForDisplay } from '../../src/lib/api/client';
import { safeRedirect, useAuth } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { Banner, Button } from '../../src/components/ui';
import { colors, radii, shadows } from '../../src/theme';

// Mirrors the website's "Confirm your email" step: signed in, but booking
// needs email_verified_at (the link in the email opens in the phone browser).
export default function EmailPending() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { user, refreshUser, logout } = useAuth();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const check = async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      const me = await refreshUser();
      if (me.email_verified_at) router.replace(safeRedirect(redirect) as never);
      else setError(t('email_still_unverified'));
    } catch (e) {
      setError(getApiErrorMessageForDisplay(e));
    } finally {
      setLoading(false);
    }
  };
  const resend = async () => {
    if (!user?.phone) return;
    setLoading(true); setError(''); setNotice('');
    try {
      await startVisitorVerification({ email: user.email, phone: user.phone, full_name: user.full_name || undefined, language_preference: locale });
      setNotice(t('email_resent'));
    } catch (e) {
      setError(getApiErrorMessageForDisplay(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.card}>
          <View style={s.icon}><Mail color={colors.forestBright} size={26} /></View>
          <Text style={s.title}>{t('confirm_email_title')}</Text>
          <Text style={s.sub}>{t('confirm_email_subtitle')} <Text style={{ fontWeight: '800' }}>{user?.email}</Text></Text>
          {error ? <Banner text={error} /> : null}
          {notice ? <Banner text={notice} kind="success" /> : null}
          <Button label={t('verified_continue')} onPress={check} loading={loading} />
          <Button label={t('resend_email')} variant="secondary" onPress={resend} disabled={loading} />
          <Button label={t('logout')} variant="secondary" onPress={async () => { await logout(); router.replace('/(visitor)/home' as never); }} disabled={loading} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.forest },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: radii.lg, padding: 22, ...shadows.floating },
  icon: { alignSelf: 'center', width: 52, height: 52, borderRadius: 26, backgroundColor: colors.mist, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  sub: { color: colors.inkSoft, textAlign: 'center', lineHeight: 22, marginVertical: 12 },
});
