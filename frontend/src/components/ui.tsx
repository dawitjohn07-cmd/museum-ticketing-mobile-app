import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radii } from '../theme';
import type { BookingStatus } from '../lib/api/services';
import { useTranslation } from '../lib/i18n/useTranslation';

export function Button({ label, onPress, loading, disabled, variant = 'primary' }: {
  label: string; onPress: () => void; loading?: boolean; disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const bg = variant === 'primary' ? colors.forestBright : variant === 'danger' ? '#FCEBE8' : colors.mist;
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? colors.danger : colors.forest;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled || loading ? 0.55 : pressed ? 0.85 : 1 }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Banner({ text, kind = 'error' }: { text: string; kind?: 'error' | 'info' | 'success' }) {
  const bg = kind === 'error' ? '#FCEBE8' : kind === 'success' ? '#E8F5E9' : '#FFF8E1';
  const fg = kind === 'error' ? colors.danger : kind === 'success' ? '#1B5E20' : '#8A5A00';
  return (
    <View style={[s.banner, { backgroundColor: bg }]}>
      <Text style={{ color: fg, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#9AA79F"
        {...props}
        style={[s.input, error ? { borderColor: colors.danger } : null, props.style]}
      />
      {error ? <Text style={s.fieldError}>{error}</Text> : null}
    </View>
  );
}

const BADGE: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'booking_confirmed', color: '#2E7D32', bg: '#E8F5E9' },
  awaiting_payment: { label: 'awaiting_payment', color: '#E65100', bg: '#FFF3E0' },
  visited: { label: 'visited', color: '#1565C0', bg: '#E3F2FD' },
  cancelled: { label: 'cancelled', color: '#757575', bg: '#F5F5F5' },
  refunded: { label: 'refunded', color: '#6A1B9A', bg: '#F3E5F5' },
};
export function StatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useTranslation();
  const b = BADGE[status] ?? BADGE.pending;
  return (
    <View style={{ backgroundColor: b.bg, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' }}>
      <Text style={{ color: b.color, fontWeight: '800', fontSize: 12 }}>{t(b.label)}</Text>
    </View>
  );
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</View>;
}

const s = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 8 },
  btnText: { fontWeight: '800', fontSize: 16 },
  banner: { padding: 12, borderRadius: radii.sm, marginBottom: 14 },
  label: { color: colors.ink, fontWeight: '800', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: 14, fontSize: 16, backgroundColor: '#FBFCFA', color: colors.ink },
  fieldError: { color: colors.danger, marginTop: 4, fontSize: 13 },
});
