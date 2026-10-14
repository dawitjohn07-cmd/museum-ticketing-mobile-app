import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { updateCurrentUser, type Locale } from '../../src/lib/api/services';
import { ApiError, getApiErrorMessageForDisplay } from '../../src/lib/api/client';
import { useRequireAuth } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { useTheme } from '../../src/lib/theme/useTheme';
import { Banner, Body, BrandHeader, Button, Card, Field, Heading, Kicker, Screen } from '../../src/components/ui';
import { fonts } from '../../src/theme';

const PHONE_RE = /^(\+251|0)?[7-9][0-9]{8}$/;

export default function VisitorProfile() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, locale, setLocale } = useTranslation();
  const { colors } = useTheme();
  const { user, isAuthenticated, isLoading, setUser, logout } = useRequireAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<Locale>(locale);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [ok, setOk] = useState('');

  // Sync state from loaded user
  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? '');
      setPhone(user.phone ?? '');
      if (user.language_preference) {
        setLanguage(user.language_preference);
        if (user.language_preference !== locale) {
          setLocale(user.language_preference);
        }
      }
    }
  }, [user?.id]);

  // Keep button active indicator in sync when changed via header controls
  useEffect(() => {
    setLanguage(locale);
  }, [locale]);

  if (isLoading || !isAuthenticated || !user) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.lime} />
        </View>
      </Screen>
    );
  }

  const handleLanguageChange = (l: Locale) => {
    setLanguage(l);
    setLocale(l);
    if (user) {
      void updateCurrentUser({ language_preference: l })
        .then((updated) => setUser(updated))
        .catch(() => {});
    }
  };

  const save = async () => {
    setError('');
    setOk('');
    setFieldErr({});
    const p = phone.trim().replace(/[\s-]/g, '');
    if (!fullName.trim()) {
      setFieldErr({ full_name: t('full_name') });
      return;
    }
    if (p && !PHONE_RE.test(p)) {
      setFieldErr({ phone: t('invalid_phone') });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateCurrentUser({
        full_name: fullName.trim(),
        phone: p || null,
        language_preference: language,
      });
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
      {
        text: t('logout'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          qc.clear();
          router.replace('/(visitor)/home' as never);
        },
      },
    ]);

  const initials =
    (fullName || user.email)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';

  return (
    <Screen stickyHeader={<><BrandHeader /><Kicker>ARCHIVE ID / PROFILE</Kicker></>}>
      <Heading size={56}>{t('profile')}</Heading>

      <View style={s.who}>
        <View style={[s.avatar, { borderColor: colors.lime, backgroundColor: colors.limeSoft }]}>
          <Text style={[s.initials, { color: colors.text }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.whoTitle, { color: colors.text }]}>{t('your_profile')}</Text>
          <Body style={{ fontSize: 13, lineHeight: 18 }}>{t('profile_description')}</Body>
        </View>
      </View>

      <Card style={{ borderRadius: 28 }}>
        {error ? <Banner text={error} /> : null}
        {ok ? <Banner text={ok} kind="success" /> : null}

        <Field label={t('full_name')} value={fullName} onChangeText={setFullName} error={fieldErr.full_name} />
        <Field label={t('email')} value={user.email} editable={false} style={{ opacity: 0.65 }} />
        <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={fieldErr.phone} />

        <Text style={[s.langLabel, { color: colors.lime }]}>{t('language')}</Text>
        <View style={s.langRow}>
          {(['en', 'am'] as const).map((l) => (
            <View key={l} style={{ flex: 1 }}>
              <Button
                label={`${language === l ? '✓ ' : ''}${l === 'en' ? t('english') : t('amharic')}`}
                variant={language === l ? 'primary' : 'secondary'}
                onPress={() => handleLanguageChange(l)}
              />
            </View>
          ))}
        </View>
      </Card>

      <Button label={saving ? t('saving') : t('save_changes')} onPress={save} loading={saving} />
      <Button label={t('logout')} variant="danger" icon={<LogOut color={colors.danger} size={18} />} onPress={signOut} />
    </Screen>
  );
}

const s = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 18 },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.serif, fontSize: 26 },
  whoTitle: { fontFamily: fonts.serif, fontSize: 28, marginBottom: 4 },
  langLabel: { fontWeight: '700', fontSize: 13, marginBottom: 2 },
  langRow: { flexDirection: 'row', gap: 12 },
});
