import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../lib/i18n/useTranslation';
import { CardArt } from './Art';
import { colors, fonts } from '../theme';

// Same as the website: the reference code is the ticket (no QR; gate staff look it up).
export function DigitalTicket({ reference, dateLabel, summary }: { reference: string; dateLabel: string; summary: string }) {
  const { t } = useTranslation();
  return (
    <View style={s.card}>
      <CardArt variant={3} />
      <Text style={s.kicker}>{t('digital_ticket')}</Text>
      <Text style={s.ref} selectable>{reference}</Text>
      <Text style={s.line}>{dateLabel}</Text>
      <Text style={s.line}>{summary}</Text>
      <Text style={s.hint}>{t('show_at_gate')}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  card: { borderRadius: 28, overflow: 'hidden', padding: 22, marginBottom: 16, borderWidth: 1, borderColor: colors.lime },
  kicker: { color: colors.lime, fontWeight: '900', letterSpacing: 2, fontSize: 12, textTransform: 'uppercase' },
  ref: { color: '#fff', fontFamily: fonts.serif, fontSize: 34, letterSpacing: 4, marginVertical: 12 },
  line: { color: 'rgba(255,255,255,0.88)', marginTop: 2 },
  hint: { color: colors.lime, marginTop: 14, fontSize: 13, fontWeight: '700' },
});
