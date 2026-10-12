import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { updateCurrentUser, type Locale } from '../../src/lib/api/services';
import { ApiError, getApiErrorMessageForDisplay } from '../../src/lib/api/client';
import { useRequireAuth } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { Banner, Button, Field } from '../../src/components/ui';
import { colors, radii } from '../../src/theme';

const PHONE_RE = /^(\+251|0)?[7-9][0-9]{8}$/;

export default function VisitorProfile() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, locale, setLocale } = useTranslation();
  const { user, isAuthenticated, isLoading, setUser, logout } = useRequireAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<Locale>(locale);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (user) { setFullName(user.full_name ?? ''); setPhone(user.phone ?? ''); setLanguage(user.language_preference ?? locale); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (isLoading || !isAuthenticated || !user) return <View style={s.center}><ActivityIndicator color={colors.forestBright} /></View>;

  const save = async () => {
    setError(''); setOk(''); setFieldErr({});
    const p = phone.trim().replace(/[\s-]/g, '');
    if (!fullName.trim()) { setFieldErr({ full_name: t('full_name') }); return; }
    if (p && !PHONE_RE.test(p)) { setFieldErr({ phone: t('invalid_phone') }); return; }
    setSaving(true);
    try {
      const updated = await updateCurrentUser({ full_name: fullName.trim(), phone: p || null, language_preference: language });
      setUser(updated);
      setLocale(language);
      setOk(t('profile_updated'));
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setFieldErr(e.fieldErrors);
      setError(getApiErrorMessageForDisplay(e));
    } finally {
      setSaving(false);
    }
  };

  const signOut = () =>
    Alert.alert(t('logout'), t('logout_confirmation'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: async () => { await logout(); qc.clear(); router.replace('/(visitor)/home' as never); } },
    ]);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{t('profile')}</Text>
        <Text style={s.sub}>{t('profile_description')}</Text>
        <View style={s.card}>
          {error ? <Banner text={error} /> : null}
          {ok ? <Banner text={ok} kind="success" /> : null}
          <Field label={t('full_name')} value={fullName} onChangeText={setFullName} error={fieldErr.full_name} />
          <Field label={t('email')} value={user.email} editable={false} style={{ opacity: 0.6 }} />
          <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={fieldErr.phone} />
          <Text style={s.label}>{t('language')}</Text>
          <View style={s.langRow}>
            {(['en', 'am'] as const).map((l) => (
              <Button key={l} label={l === 'en' ? t('english') : t('amharic')} variant={language === l ? 'primary' : 'secondary'} onPress={() => setLanguage(l)} />
            ))}
          </View>
          <Button label={saving ? t('saving') : t('save_changes')} onPress={save} loading={saving} />
        </View>
        <Button label={t('logout')} variant="danger" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '900', color: colors.ink },
  sub: { color: colors.inkSoft, marginVertical: 8 },
  card: { backgroundColor: '#fff', borderRadius: radii.md, padding: 16, marginVertical: 12 },
  label: { color: colors.ink, fontWeight: '800', marginBottom: 6 },
  langRow: { gap: 4, marginBottom: 8 },
});
