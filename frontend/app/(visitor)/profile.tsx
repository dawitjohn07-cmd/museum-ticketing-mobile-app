import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Phone, Mail, LogOut, Save, Edit2 } from 'lucide-react-native';
import { clearAuthTokens } from '../../src/lib/api/client';
import { getCurrentUser, updateCurrentUser, logout } from '../../src/lib/api/services';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../src/lib/i18n/useTranslation';

export default function VisitorProfile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { locale, setLocale, t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: getCurrentUser,
  });

  const updateMutation = useMutation({
    mutationFn: () => updateCurrentUser({ first_name: firstName, last_name: lastName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setEditing(false);
      Alert.alert(t('saved'), t('profile_updated'));
    },
    onError: (err: any) => {
      Alert.alert(t('error'), err?.payload?.detail ?? t('profile_update_failed'));
    },
  });

  const handleLogout = () => {
    Alert.alert(t('log_out'), t('logout_confirmation'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('log_out'),
        style: 'destructive',
        onPress: async () => {
          try { await logout(); } catch {}
          await clearAuthTokens();
          queryClient.clear();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.first_name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.displayName}>
            {user?.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : 'Museum Visitor'}
          </Text>
          <Text style={styles.roleLabel}>{t('visitor')}</Text>
        </View>

        {/* Info card */}
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Mail size={18} color="#888" style={styles.infoIcon} />
            <Text style={styles.infoText}>{user?.email ?? '—'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Phone size={18} color="#888" style={styles.infoIcon} />
            <Text style={styles.infoText}>{user?.phone ?? '—'}</Text>
          </View>
        </View>

        {/* Edit profile */}
        {editing ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('edit_profile')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('first_name')}
              value={firstName}
              onChangeText={setFirstName}
            />
            <TextInput
              style={styles.input}
              placeholder={t('last_name')}
              value={lastName}
              onChangeText={setLastName}
            />
            <View style={styles.editActions}>
              <Pressable
                style={[styles.btn, styles.saveBtn]}
                onPress={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending
                  ? <ActivityIndicator color="#FFF" />
                  : <><Save size={16} color="#FFF" /><Text style={styles.btnText}>{t('save')}</Text></>}
              </Pressable>
              <Pressable
                style={[styles.btn, styles.cancelBtn]}
                onPress={() => setEditing(false)}
              >
                <Text style={[styles.btnText, { color: '#666' }]}>{t('cancel')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            style={styles.editBtn}
            onPress={() => {
              setFirstName(user?.first_name ?? '');
              setLastName(user?.last_name ?? '');
              setEditing(true);
            }}
          >
            <Edit2 size={18} color="#1565C0" />
            <Text style={styles.editBtnText}>{t('edit_profile')}</Text>
          </Pressable>
        )}

        {/* Language Selection */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('language')}</Text>
          <View style={styles.langActions}>
            <Pressable
              style={[styles.langBtn, locale === 'en' && styles.langBtnActive]}
              onPress={() => setLocale('en')}
            >
              <Text style={[styles.langBtnText, locale === 'en' && { color: '#FFF' }]}>English</Text>
            </Pressable>
            <Pressable
              style={[styles.langBtn, locale === 'am' && styles.langBtnActive]}
              onPress={() => setLocale('am')}
            >
              <Text style={[styles.langBtnText, locale === 'am' && { color: '#FFF' }]}>አማርኛ</Text>
            </Pressable>
          </View>
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color="#D32F2F" />
          <Text style={styles.logoutText}>{t('log_out')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scroll: { padding: 24, paddingBottom: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: { fontSize: 36, fontWeight: '900', color: '#FFF' },
  displayName: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  roleLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoIcon: { marginRight: 14 },
  infoText: { fontSize: 15, color: '#1A1A1A', flex: 1 },
  divider: { height: 1, backgroundColor: '#F0F0F0' },

  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: '#E5E9F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 14,
    backgroundColor: '#FAFAFA',
    color: '#1A1A1A',
  },
  editActions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, flexDirection: 'row', height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  saveBtn: { backgroundColor: '#2E7D32' },
  cancelBtn: { backgroundColor: '#F5F7FA', borderWidth: 1, borderColor: '#E5E9F0' },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 15, marginLeft: 8 },

  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#BBDEFB',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    marginBottom: 16,
  },
  editBtnText: { color: '#1565C0', fontWeight: '700', fontSize: 15, marginLeft: 10 },

  langActions: { flexDirection: 'row', gap: 12 },
  langBtn: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F5F7FA', borderWidth: 1, borderColor: '#E5E9F0' },
  langBtnActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  langBtnText: { color: '#333', fontWeight: '700', fontSize: 15 },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
  },
  logoutText: { color: '#D32F2F', fontWeight: '700', fontSize: 15, marginLeft: 10 },
});
