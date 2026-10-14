import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ArrowLeft } from 'lucide-react-native';
import { fonts, radii } from '../theme';
import type { BookingStatus } from '../lib/api/services';
import { useTranslation } from '../lib/i18n/useTranslation';
import { useTheme } from '../lib/theme/useTheme';
import { HeaderControls } from './LanguageSelector';

/** Soft olive / plum glows behind every screen. Light mode uses soft green & amber. */
export function Glow() {
  const { isDark } = useTheme();
  if (!isDark) {
    return (
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="gA" cx="15%" cy="10%" r="50%">
            <Stop offset="0" stopColor="#A8E063" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#A8E063" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="gB" cx="90%" cy="90%" r="50%">
            <Stop offset="0" stopColor="#56AB2F" stopOpacity="0.14" />
            <Stop offset="1" stopColor="#56AB2F" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#gA)" />
        <Rect width="100%" height="100%" fill="url(#gB)" />
      </Svg>
    );
  }
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="gA" cx="8%" cy="14%" r="48%">
          <Stop offset="0" stopColor="#C6F04F" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#C6F04F" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="gB" cx="100%" cy="92%" r="55%">
          <Stop offset="0" stopColor="#C0504D" stopOpacity="0.30" />
          <Stop offset="1" stopColor="#C0504D" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#gA)" />
      <Rect width="100%" height="100%" fill="url(#gB)" />
    </Svg>
  );
}

export function Screen({ children, scroll = true, contentStyle, stickyHeader }: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  stickyHeader?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {stickyHeader ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 4 }}>{stickyHeader}</View>
        ) : null}
        {scroll ? (
          <ScrollView
            contentContainerStyle={[{ padding: 24, paddingTop: stickyHeader ? 0 : 24, paddingBottom: 48 }, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

export function BrandHeader({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('back')} onPress={onBack} hitSlop={12} style={{ width: 44, height: 44, justifyContent: 'center' }}>
          <ArrowLeft color={colors.lime} size={30} />
        </Pressable>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime }} />
          </View>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, letterSpacing: 0.6 }}>ZNHM–AAU</Text>
        </View>
      )}
      <HeaderControls />
    </View>
  );
}

export function Kicker({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.lime, fontWeight: '800', fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase', marginBottom: 10 }, style as never]}>{children}</Text>;
}

export function Heading({ children, size = 44, style }: { children: React.ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.text, fontFamily: fonts.serif, fontSize: size, lineHeight: size * 1.1, marginBottom: 10 }, style as never]}>{children}</Text>;
}

export function Body({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.muted, fontSize: 15, lineHeight: 22 }, style as never]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 18, marginBottom: 16 }, style]}>{children}</View>;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'rust';
export function Button({ label, onPress, loading, disabled, variant = 'primary', icon }: {
  label: string; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: Variant; icon?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const v = {
    primary: { bg: colors.lime, fg: colors.limeDark, bd: colors.lime },
    secondary: { bg: 'transparent', fg: colors.lime, bd: colors.lime },
    ghost: { bg: colors.line, fg: colors.text, bd: colors.line },
    danger: { bg: 'transparent', fg: colors.danger, bd: colors.danger },
    rust: { bg: colors.rust, fg: '#FFF', bd: colors.rust },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [{ minHeight: 56, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 10, backgroundColor: v.bg, borderColor: v.bd, opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : (<>{icon}<Text style={{ fontWeight: '800', fontSize: 16, color: v.fg }}>{label}</Text></>)}
    </Pressable>
  );
}

export function Banner({ text, kind = 'error' }: { text: string; kind?: 'error' | 'info' | 'success' }) {
  const { colors } = useTheme();
  const fg = kind === 'error' ? colors.danger : kind === 'success' ? colors.lime : colors.warn;
  const bg = kind === 'error' ? `${colors.danger}22` : kind === 'success' ? colors.limeSoft : `${colors.warn}22`;
  return (
    <View style={{ backgroundColor: bg, borderColor: fg, borderWidth: 1, padding: 12, borderRadius: radii.sm, marginBottom: 14 }}>
      <Text style={{ color: fg, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.lime, fontWeight: '700', fontSize: 13, marginBottom: 8 }}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.faint}
        selectionColor={colors.lime}
        {...props}
        style={[{
          minHeight: 56, borderWidth: 1,
          borderColor: error ? colors.danger : colors.inputLine,
          borderRadius: 18, paddingHorizontal: 16, fontSize: 16,
          backgroundColor: colors.inputBg, color: colors.text,
        }, props.style]}
      />
      {error ? <Text style={{ color: colors.danger, marginTop: 6, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

const BADGE: Record<BookingStatus, { label: string; colorKey: 'lime' | 'warn' | 'info' | 'muted' | 'purple' }> = {
  pending: { label: 'booking_confirmed', colorKey: 'lime' },
  awaiting_payment: { label: 'awaiting_payment', colorKey: 'warn' },
  visited: { label: 'visited', colorKey: 'info' },
  cancelled: { label: 'cancelled', colorKey: 'muted' },
  refunded: { label: 'refunded', colorKey: 'purple' },
};
export function StatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const x = BADGE[status] ?? BADGE.pending;
  const color = colors[x.colorKey];
  return (
    <View style={{ borderColor: color, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' }}>
      <Text style={{ color, fontWeight: '800', fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' }}>{t(x.label)}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.pill, borderWidth: 1, borderColor: active ? colors.lime : colors.line, backgroundColor: active ? colors.lime : 'transparent' }}>
      <Text style={{ fontWeight: '800', color: active ? colors.limeDark : colors.text }}>{label}</Text>
    </Pressable>
  );
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</View>;
}

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '90%', borderWidth: 1, borderColor: colors.line }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 26, color: colors.text, marginBottom: 12 }}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}
