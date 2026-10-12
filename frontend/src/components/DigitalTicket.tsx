import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../lib/i18n/useTranslation';
import { colors, radii, shadows } from '../theme';

// Same as the website: the reference code is the ticket (no QR; gate staff look it up).
export function DigitalTicket({ reference, dateLabel, summary }: { reference: string; dateLabel: string; summary: string }) {
  const { t } = useTranslation();
  return (
    <View style={s.card}>
      <Text style={s.kicker}>{t('digital_ticket')}</Text>
      <Text style={s.ref} selectable>{reference}</Text>
      <Text style={s.line}>{dateLabel}</Text>
      <Text style={s.line}>{summary}</Text>
      <Text style={s.hint}>{t('show_at_gate')}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  card: { backgroundColor: colors.forest, borderRadius: radii.md, padding: 20, marginBottom: 16, ...shadows.card },
  kicker: { color: colors.moss, fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
  ref: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: 4, marginVertical: 10 },
  line: { color: '#D6E9D4', marginTop: 2 },
  hint: { color: colors.moss, marginTop: 12, fontSize: 13 },
});
