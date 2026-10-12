import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Globe, X } from 'lucide-react-native';
import { useTranslation } from '../lib/i18n/useTranslation';

export function LanguageSelector() {
  const { locale, setLocale, t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        accessibilityLabel={t('language')}
        accessibilityRole="button"
        onPress={() => setVisible(true)}
        style={styles.trigger}
      >
        <Globe color="#FFF" size={22} />
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.heading}>
              <Text style={styles.title}>{t('language')}</Text>
              <Pressable accessibilityLabel={t('close_modal')} onPress={() => setVisible(false)}>
                <X color="#555" size={22} />
              </Pressable>
            </View>
            {(['en', 'am'] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: locale === option }}
                onPress={() => {
                  setLocale(option);
                  setVisible(false);
                }}
                style={[styles.option, locale === option && styles.selected]}
              >
                <Text style={styles.optionText}>{option === 'en' ? 'English' : 'አማርኛ'}</Text>
                {locale === option && <Check color="#2E7D32" size={22} />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { padding: 8, marginRight: 8 },
  backdrop: { flex: 1, justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 58, paddingRight: 12, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: { width: 230, borderRadius: 16, padding: 16, backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  option: { minHeight: 50, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selected: { backgroundColor: '#E8F5E9' },
  optionText: { fontSize: 16, color: '#1A1A1A', fontWeight: '600' },
});
