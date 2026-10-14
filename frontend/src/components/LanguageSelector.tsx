import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Globe, Moon, Settings, Sun, X } from 'lucide-react-native';
import { useTranslation } from '../lib/i18n/useTranslation';
import { useTheme, ThemeMode } from '../lib/theme/useTheme';
import { updateCurrentUser } from '../lib/api/services';
import { useAuth } from '../hooks/useAuth';

type Panel = 'language' | 'theme' | null;

/**
 * HeaderControls renders the language globe + settings gear icon buttons
 * displayed on the top right of every screen's BrandHeader.
 */
export function HeaderControls() {
  const { locale, setLocale, t } = useTranslation();
  const { mode, setMode, colors, isDark } = useTheme();
  const { user, setUser } = useAuth();
  const [open, setOpen] = useState<Panel>(null);

  const handleSelectLanguage = (option: 'en' | 'am') => {
    setLocale(option);
    setOpen(null);
    if (user) {
      void updateCurrentUser({ language_preference: option })
        .then((updated) => setUser(updated))
        .catch(() => {});
    }
  };

  const handleSelectTheme = (m: ThemeMode) => {
    setMode(m);
    setOpen(null);
  };

  const triggerStyle = {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  };

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        {/* Language Globe Button */}
        <Pressable
          accessibilityLabel={t('language')}
          accessibilityRole="button"
          onPress={() => setOpen('language')}
          style={triggerStyle}
        >
          <Globe color={colors.lime} size={20} />
        </Pressable>

        {/* Settings / Appearance Button */}
        <Pressable
          accessibilityLabel="Settings"
          accessibilityRole="button"
          onPress={() => setOpen('theme')}
          style={triggerStyle}
        >
          <Settings color={isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.60)'} size={20} />
        </Pressable>
      </View>

      {/* ── LANGUAGE POPUP MODAL (Matching screenshot 2) ── */}
      <Modal visible={open === 'language'} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.panelHead}>
              <Text style={[styles.panelTitle, { color: colors.lime }]}>{t('language')}</Text>
              <Pressable onPress={() => setOpen(null)} hitSlop={10} accessibilityLabel={t('close')}>
                <X color={colors.muted} size={20} />
              </Pressable>
            </View>

            {/* Language options */}
            {(['en', 'am'] as const).map((option) => {
              const isActive = locale === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  onPress={() => handleSelectLanguage(option)}
                  style={[
                    styles.option,
                    isActive && { backgroundColor: colors.limeSoft },
                  ]}
                >
                  <Text style={[styles.optionText, { color: colors.text }]}>
                    {option === 'en' ? 'English' : 'አማርኛ'}
                  </Text>
                  {isActive && <Check color={colors.lime} size={20} strokeWidth={2.5} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── THEME / APPEARANCE POPUP MODAL (Exact same layout & styling) ── */}
      <Modal visible={open === 'theme'} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.panelHead}>
              <Text style={[styles.panelTitle, { color: colors.lime }]}>THEME</Text>
              <Pressable onPress={() => setOpen(null)} hitSlop={10} accessibilityLabel="Close">
                <X color={colors.muted} size={20} />
              </Pressable>
            </View>

            {/* Theme options: Dark / Light */}
            {(['dark', 'light'] as ThemeMode[]).map((m) => {
              const isActive = mode === m;
              const label = m === 'dark' ? 'Dark' : 'Light';
              const Icon = m === 'dark' ? Moon : Sun;
              const iconColor = m === 'dark' ? '#C6F04F' : '#F59E0B';
              return (
                <Pressable
                  key={m}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  onPress={() => handleSelectTheme(m)}
                  style={[
                    styles.option,
                    isActive && { backgroundColor: colors.limeSoft },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={[
                        styles.iconWrap,
                        {
                          backgroundColor: isActive
                            ? isDark
                              ? 'rgba(198,240,79,0.18)'
                              : 'rgba(30,122,62,0.12)'
                            : 'transparent',
                        },
                      ]}
                    >
                      <Icon color={isActive ? iconColor : colors.muted} size={18} />
                    </View>
                    <Text style={[styles.optionText, { color: colors.text }]}>{label}</Text>
                  </View>
                  {isActive && <Check color={colors.lime} size={20} strokeWidth={2.5} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Backward-compatibility export */
export function LanguageSelector() {
  return <HeaderControls />;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 68,
    paddingRight: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    width: 240,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  panelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  option: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
