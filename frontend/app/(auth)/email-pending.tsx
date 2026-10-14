import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { startVisitorVerification } from '../../src/lib/api/services';
import { getApiErrorMessageForDisplay } from '../../src/lib/api/client';
import { safeRedirect, useAuth } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { useTheme } from '../../src/lib/theme/useTheme';
import { Banner, Body, BrandHeader, Button, Card, Heading, Kicker, Screen } from '../../src/components/ui';

export default function EmailPending() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
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
    <Screen stickyHeader={<><BrandHeader /><Kicker>ZNHM–AAU / GATEWAY 04</Kicker></>}>
      <Heading size={42}>{t('confirm_email_title')}</Heading>
      <Card style={{ marginTop: 12 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Mail color={colors.lime} size={24} />
        </View>
        <Body style={{ marginBottom: 14 }}>
          {t('confirm_email_subtitle')}{' '}
          <Text style={{ color: colors.text, fontWeight: '800' }}>{user?.email}</Text>
        </Body>
        {error ? <Banner text={error} /> : null}
        {notice ? <Banner text={notice} kind="success" /> : null}
        <Button label={t('verified_continue')} onPress={check} loading={loading} />
        <Button label={t('resend_email')} variant="secondary" onPress={resend} disabled={loading} />
        <Button label={t('logout')} variant="ghost" onPress={async () => { await logout(); router.replace('/(visitor)/home' as never); }} disabled={loading} />
      </Card>
    </Screen>
  );
}
