import { View, Text, StyleSheet, Image, ScrollView, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, MapPin, CalendarDays, ChevronRight, ArrowUpRight, Ticket } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { getMyBookings } from '../../src/lib/api/services';
import { colors, radii, shadows } from '../../src/theme';

const { width } = Dimensions.get('window');

export default function VisitorHome() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: bookings } = useQuery({
    queryKey: ['myBookings'],
    queryFn: () => getMyBookings({ limit: 1, offset: 0 }),
    staleTime: 60_000,
  });
  const upcoming = bookings?.data?.find((item) => item.status === 'pending' || item.status === 'awaiting_payment');

  return (
    <ScrollView style={styles.container} bounces={false} showsVerticalScrollIndicator={false}>
      <View style={styles.heroContainer}>
        <Image 
          source={require('../../assets/images/museum_hero.png')} 
          style={styles.heroImage}
          resizeMode="cover"
        />
        <View style={styles.overlay} />
        <View style={styles.heroEyebrow}><Text style={styles.eyebrowText}>ZNHM · AAU</Text><ArrowUpRight color="#FFF" size={15} /></View>
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>A living archive of Ethiopia.</Text>
          <Text style={styles.heroSubtitle}>{t('aau_logo_alt')}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.welcomeRow}>
          <View><Text style={styles.overline}>NATURAL HISTORY · ADDIS ABABA</Text><Text style={styles.welcomeTitle}>{t('plan_your_visit')}</Text></View>
          <View style={styles.leafMark}><Text style={styles.leafMarkText}>✦</Text></View>
        </View>
        <View style={styles.infoCards}>
          <View style={styles.infoCard}>
            <Clock color="#2E7D32" size={24} />
            <Text style={styles.infoCardTitle}>{t('hours')}</Text>
            <Text style={styles.infoCardText}>{t('monday_saturday')}</Text>
            <Text style={styles.infoCardSubtext}>8:30 AM - 5:00 PM</Text>
            <Text style={styles.closedText}>{t('sunday_closed')}</Text>
          </View>
          
          <View style={styles.infoCard}>
            <MapPin color="#2E7D32" size={24} />
            <Text style={styles.infoCardTitle}>{t('location')}</Text>
            <Text style={styles.infoCardText}>AAU Arat Kilo Campus</Text>
            <Text style={styles.infoCardSubtext}>Science Faculty</Text>
          </View>
        </View>

        {upcoming && (
          <Pressable style={({ pressed }) => [styles.upcomingCard, pressed && styles.pressed]} onPress={() => router.push(`/(visitor)/booking/${upcoming.id}`)}>
            <View style={styles.upcomingIcon}><Ticket color={colors.cream} size={21} /></View>
            <View style={styles.upcomingCopy}><Text style={styles.upcomingLabel}>{t('upcoming_booking')}</Text><Text style={styles.upcomingDate}>{upcoming.visitDate}</Text></View>
            <ChevronRight color={colors.moss} size={22} />
          </Pressable>
        )}
        <View style={styles.actionSection}>
          <Text style={styles.sectionTitle}>{t('plan_your_visit')}</Text>
          <Text style={styles.sectionBody}>
            {t('home_visit_description')}
          </Text>
          
          <Pressable 
            style={({ pressed }) => [
              styles.bookButton,
              pressed && styles.pressed
            ]}
            onPress={() => router.push('/(visitor)/book')}
          >
            <CalendarDays color="#FFF" size={20} />
            <Text style={styles.bookButtonText}>{t('book_now')}</Text>
            <ChevronRight color="#FFF" size={20} style={styles.buttonIconRight} />
          </Pressable>
        </View>
        
        <View style={styles.aboutSection}>
          <Text style={styles.sectionTitle}>{t('about')}</Text>
          <Text style={styles.sectionBody}>
            {t('museum_description')}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  heroContainer: {
    width: width,
    height: 360,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(8, 35, 24, 0.48)',
  },
  heroContent: {
    position: 'absolute',
    bottom: 38,
    left: 20,
    right: 20,
  },
  heroEyebrow: { position: 'absolute', top: 28, left: 22, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  eyebrowText: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  heroTitle: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
    lineHeight: 34,
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D6E9D4',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  content: {
    padding: 22,
    marginTop: -28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.cream,
  },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  overline: { color: colors.forestBright, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 5 },
  welcomeTitle: { color: colors.ink, fontSize: 25, fontWeight: '900' },
  leafMark: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.moss, alignItems: 'center', justifyContent: 'center' },
  leafMarkText: { color: colors.forest, fontSize: 24 },
  infoCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  infoCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.md,
    padding: 17,
    width: '48%',
    alignItems: 'center',
    ...shadows.card,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 12,
    marginBottom: 4,
  },
  infoCardText: {
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  infoCardSubtext: {
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 2,
  },
  closedText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
    marginTop: 6,
  },
  actionSection: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    padding: 24,
    marginBottom: 30,
    ...shadows.card,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 12,
  },
  sectionBody: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.inkSoft,
    marginBottom: 20,
  },
  bookButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  bookButtonText: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
    flex: 1,
  },
  buttonIconRight: {
    marginLeft: 'auto',
  },
  aboutSection: {
    padding: 10,
    paddingBottom: 40,
  },
  upcomingCard: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 22, borderRadius: radii.md, backgroundColor: colors.forest, ...shadows.floating },
  upcomingIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.forestBright, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  upcomingCopy: { flex: 1 },
  upcomingLabel: { color: colors.moss, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  upcomingDate: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
