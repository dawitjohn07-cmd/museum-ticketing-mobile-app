import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { getAvailabilityRange } from '../lib/api/services';
import { parseIso, toIso, todayIso } from '../lib/dates';
import { useTranslation } from '../lib/i18n/useTranslation';
import { colors, radii } from '../theme';

/** Month grid driven by GET /availability/?from&to. Past days, Sundays and
 *  Manager-closed dates are disabled (website AvailabilityDatePicker rules). */
export function MonthCalendar({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const { t, locale } = useTranslation();
  const now = new Date();
  const [view, setView] = useState(() => (value ? parseIso(value) : now));
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const from = toIso(first);
  const to = toIso(last);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['availability', from, to],
    queryFn: () => getAvailabilityRange(from, to),
    staleTime: 60_000,
  });
  const open = useMemo(() => new Map((data ?? []).map((d) => [d.date, d.isOpenForBooking])), [data]);
  const today = todayIso();
  const atCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const days: (Date | null)[] = [];
  for (let i = 0; i < first.getDay(); i += 1) days.push(null);
  for (let d = 1; d <= last.getDate(); d += 1) days.push(new Date(year, month, d));

  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-US', { weekday: 'narrow' })
  );
  const title = view.toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-US', { month: 'long', year: 'numeric' });

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Pressable accessibilityLabel={t('previous_month')} disabled={atCurrentMonth} onPress={() => setView(new Date(year, month - 1, 1))} style={[s.nav, atCurrentMonth && { opacity: 0.3 }]}>
          <ChevronLeft color={colors.forest} size={22} />
        </Pressable>
        <Text style={s.title}>{title}</Text>
        <Pressable accessibilityLabel={t('next_month')} onPress={() => setView(new Date(year, month + 1, 1))} style={s.nav}>
          <ChevronRight color={colors.forest} size={22} />
        </Pressable>
      </View>
      <View style={s.row}>
        {weekdayNames.map((w, i) => (<Text key={i} style={s.wd}>{w}</Text>))}
      </View>
      {isLoading ? (
        <ActivityIndicator color={colors.forestBright} style={{ marginVertical: 24 }} />
      ) : isError ? (
        <Pressable onPress={() => refetch()}><Text style={s.err}>{t('failed_to_load_availability')} · {t('retry')}</Text></Pressable>
      ) : (
        <View style={s.grid}>
          {days.map((d, i) => {
            if (!d) return <View key={`e${i}`} style={s.cell} />;
            const iso = toIso(d);
            const closed = d.getDay() === 0 || open.get(iso) === false;
            const disabled = iso < today || closed;
            const selected = iso === value;
            return (
              <Pressable key={iso} disabled={disabled} onPress={() => onChange(iso)} style={s.cell} accessibilityState={{ disabled, selected }}>
                <View style={[s.day, selected && { backgroundColor: colors.forestBright }]}>
                  <Text style={[s.dayText, disabled && { color: '#B8C2BB', textDecorationLine: closed && iso >= today ? 'line-through' : 'none' }, selected && { color: '#fff' }]}>
                    {d.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      <Text style={s.legend}>{t('closed_every_sunday')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  row: { flexDirection: 'row' },
  wd: { flex: 1, textAlign: 'center', color: colors.inkSoft, fontWeight: '700', paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  day: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dayText: { color: colors.ink, fontWeight: '700' },
  legend: { color: colors.inkSoft, fontSize: 12, marginTop: 6, textAlign: 'center' },
  err: { color: colors.danger, textAlign: 'center', paddingVertical: 20 },
});
