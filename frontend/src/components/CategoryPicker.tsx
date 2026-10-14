import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import type { Category } from '../lib/api/services';
import { useTranslation } from '../lib/i18n/useTranslation';
import { useTheme } from '../lib/theme/useTheme';
import { fonts, radii } from '../theme';

export const MAX_QTY = 99;

export function CategoryPicker({
  categories,
  quantities,
  onChange,
}: {
  categories: Category[];
  quantities: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();

  const set = (id: string, q: number) => {
    const next = { ...quantities };
    if (q <= 0) delete next[id];
    else next[id] = Math.min(q, MAX_QTY);
    onChange(next);
  };

  return (
    <View>
      {categories.map((c) => {
        const q = quantities[c.id] ?? 0;
        return (
          <View
            key={c.id}
            style={[
              s.row,
              { backgroundColor: colors.card, borderColor: q > 0 ? colors.lime : colors.line },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.name, { color: colors.text }]}>
                {locale === 'am' && c.name_am ? c.name_am : c.name_en}
              </Text>
              <Text style={[s.price, { color: colors.lime }]}>
                {c.is_free ? t('free') : `${c.price_etb} ETB`}
              </Text>
            </View>
            <View style={s.stepper}>
              <Pressable
                accessibilityLabel={t('decrease_quantity')}
                disabled={q === 0}
                onPress={() => set(c.id, q - 1)}
                style={[
                  s.btn,
                  { backgroundColor: colors.inputBg, borderColor: colors.line },
                  q === 0 && { opacity: 0.35 },
                ]}
              >
                <Minus size={18} color={colors.lime} />
              </Pressable>
              <Text style={[s.qty, { color: colors.text }]}>{q}</Text>
              <Pressable
                accessibilityLabel={t('increase_quantity')}
                disabled={q >= MAX_QTY}
                onPress={() => set(c.id, q + 1)}
                style={[s.btn, { backgroundColor: colors.inputBg, borderColor: colors.line }]}
              >
                <Plus size={18} color={colors.lime} />
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function itemsFrom(q: Record<string, number>) {
  return Object.entries(q).map(([categoryId, quantity]) => ({ categoryId, quantity }));
}

export function totalOf(q: Record<string, number>, cats: Category[]) {
  return Object.entries(q).reduce(
    (sum, [id, n]) => sum + Number(cats.find((c) => c.id === id)?.price_etb ?? 0) * n,
    0
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  name: { fontFamily: fonts.serif, fontSize: 19 },
  price: { marginTop: 3, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { minWidth: 38, textAlign: 'center', fontWeight: '900', fontSize: 18 },
});
