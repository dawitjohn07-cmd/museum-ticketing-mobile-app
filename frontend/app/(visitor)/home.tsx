import React, { useEffect, useRef, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronRight, Clock, MapPin, Ticket } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { getMyBookings } from '../../src/lib/api/services';
import { useAuth } from '../../src/hooks/useAuth';
import { formatDate, todayIso } from '../../src/lib/dates';
import { BrandHeader, Button, Kicker, Screen } from '../../src/components/ui';
import { CardArt } from '../../src/components/Art';
import { useTheme } from '../../src/lib/theme/useTheme';
import { fonts } from '../../src/theme';

const GAP = 12;

export default function VisitorHome() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const { width } = useWindowDimensions();
  const cardW = width - 24 * 2 - 24;
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % 3;
        listRef.current?.scrollToOffset({
          offset: next * (cardW + GAP),
          animated: true,
        });
        return next;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [cardW]);

  const { data: bookings } = useQuery({
    queryKey: ['myBookings', 'home'],
    queryFn: () => getMyBookings({ limit: 100, offset: 0 }),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const upcoming = (bookings?.data ?? [])
    .filter((b) => (b.status === 'pending' || b.status === 'awaiting_payment') && b.visitDate >= todayIso())
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate))[0];

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.max(0, Math.min(2, Math.round(e.nativeEvent.contentOffset.x / (cardW + GAP)))));
  };
  const goTo = (i: number) => { listRef.current?.scrollToOffset({ offset: i * (cardW + GAP), animated: true }); setIndex(i); };

  const cardBase = { height: 280, borderRadius: 30, overflow: 'hidden' as const, padding: 20, justifyContent: 'space-between' as const, borderWidth: 1, borderColor: colors.line };

  const cards = [
    // Card 1: hero
    <View key="1" style={[cardBase, { width: cardW }]}>
      <CardArt variant={1} />
      <Text style={{ color: '#FFF', fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 15, letterSpacing: 1 }}>{t('aau_logo_alt').toUpperCase()}</Text>
      <View>
        <Text style={{ color: '#FFF', fontFamily: fonts.serif, fontSize: 38, lineHeight: 42, width: '78%', marginBottom: 16 }}>{t('home_hero_title')}</Text>
        <Pressable onPress={() => goTo(1)} accessibilityRole="button" hitSlop={10}>
          <Text style={{ color: '#C6F04F', fontWeight: '800', fontSize: 12, letterSpacing: 2.2 }}>{t('enter_collection')} →</Text>
        </Pressable>
      </View>
    </View>,
    // Card 2: plan your visit
    <View key="2" style={[cardBase, { width: cardW, justifyContent: 'flex-start' }]}>
      <CardArt variant={2} />
      <Text style={{ color: '#C6F04F', fontWeight: '800', fontSize: 11, letterSpacing: 2, marginBottom: 6 }}>{t('natural_history_addis')}</Text>
      <Text style={{ color: '#FFF', fontFamily: fonts.serif, fontSize: 36, lineHeight: 40, marginBottom: 10 }}>{t('plan_your_visit')}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 21, width: '88%' }}>{t('home_visit_description')}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 'auto' }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(8,10,10,0.55)', borderColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderRadius: 18, padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}><Clock color="#C6F04F" size={14} /><Text style={{ color: '#C6F04F', fontWeight: '800', fontSize: 12 }}>{t('hours')}</Text></View>
          <Text style={{ color: '#FFF', fontSize: 12, lineHeight: 17, fontWeight: '600' }}>{t('home_hours_value')}</Text>
          <Text style={{ color: '#FFF', fontSize: 12, lineHeight: 17, fontWeight: '600' }}>{t('sunday_closed')}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: 'rgba(8,10,10,0.55)', borderColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderRadius: 18, padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}><MapPin color="#C6F04F" size={14} /><Text style={{ color: '#C6F04F', fontWeight: '800', fontSize: 12 }}>{t('location')}</Text></View>
          <Text style={{ color: '#FFF', fontSize: 12, lineHeight: 17, fontWeight: '600' }}>{t('home_location_line1')}</Text>
          <Text style={{ color: '#FFF', fontSize: 12, lineHeight: 17, fontWeight: '600' }}>{t('home_location_line2')}</Text>
        </View>
      </View>
    </View>,
    // Card 3: about
    <View key="3" style={[cardBase, { width: cardW, justifyContent: 'flex-start' }]}>
      <CardArt variant={3} />
      <Text style={{ color: '#FFF', fontFamily: fonts.serif, fontSize: 36, lineHeight: 40, marginBottom: 10 }}>{t('about')}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 15, lineHeight: 24, width: '88%' }}>{t('museum_description')}</Text>
    </View>,
  ];

  return (
    <Screen stickyHeader={<><BrandHeader /><Kicker>ARCHIVE / 001</Kicker></>}>
      <View style={{ marginHorizontal: -24 }}>
        <FlatList
          ref={listRef}
          data={cards}
          horizontal
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => item}
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardW + GAP}
          decelerationRate="fast"
          ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
          contentContainerStyle={{ paddingHorizontal: 24 }}
          onMomentumScrollEnd={onEnd}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 12 }}>
        {[0, 1, 2].map((i) => (
          <Pressable key={i} onPress={() => goTo(i)} hitSlop={8} accessibilityLabel={`${i + 1}/3`}>
            <View style={[
              { width: 8, height: 8, borderRadius: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)' },
              i === index && { width: 26, backgroundColor: colors.lime },
            ]} />
          </Pressable>
        ))}
      </View>

      {upcoming && (
        <Pressable
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 22, padding: 14, marginTop: 6, marginBottom: 4 }, pressed && { opacity: 0.85 }]}
          onPress={() => router.push(`/(visitor)/booking/${upcoming.id}`)}
        >
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ticket color={colors.lime} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.lime, fontWeight: '800', fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' }}>{t('upcoming_booking')}</Text>
            <Text style={{ color: colors.text, fontFamily: fonts.serif, fontSize: 18, marginTop: 2 }}>{formatDate(upcoming.visitDate, locale)}</Text>
          </View>
          <ChevronRight color={colors.lime} size={22} />
        </Pressable>
      )}

      <Button label={t('book_now')} icon={<CalendarDays color={colors.limeDark} size={20} />} onPress={() => router.push('/(visitor)/book')} />
      <Button label={t('book_for_school_institution')} variant="rust" icon={<Ticket color="#FFF" size={20} />} onPress={() => router.push('/(visitor)/group' as never)} />
    </Screen>
  );
}
