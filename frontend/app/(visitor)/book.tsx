import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, ArrowRight, AlertCircle } from 'lucide-react-native';
import {
  getCategories,
  createBooking,
  checkDateAvailability,
  getCurrentUser,
} from '../../src/lib/api/services';
import {
  ApiError,
  ApiTimeoutError,
  getApiErrorMessageForDisplay,
} from '../../src/lib/api/client';
import { useTranslation } from '../../src/lib/i18n/useTranslation';

// Business rules (backend is authoritative, these are display fallbacks)
function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function isSunday(d: Date) {
  return d.getDay() === 0;
}

export default function BookVisitScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showReview, setShowReview] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    // Start from tomorrow, skip Sunday
    let d = addDays(new Date(), 1);
    while (isSunday(d)) d = addDays(d, 1);
    return d;
  });

  // ── Server data ──────────────────────────────────────────────
  const {
    data: categories,
    isLoading: catLoading,
    isError: categoriesError,
    refetch: retryCategories,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
    retry: 1,
  });
  const {
    data: currentUser,
    isLoading: userLoading,
    isError: userError,
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    retry: false,
  });

  const dateStr = toDateStr(selectedDate);
  const {
    data: availability,
    isLoading: availLoading,
    isError: availabilityError,
    error: availabilityErrorValue,
    refetch: retryAvailability,
  } = useQuery({
    queryKey: ['availability', dateStr],
    queryFn: ({ signal }) => checkDateAvailability(dateStr, signal),
    retry: false,
  });

  const displayCategories = categories ?? [];
  const dateOpen = availability?.isOpenForBooking === true;

  function availabilityMessage(error: unknown) {
    if (error instanceof ApiTimeoutError) {
      return t('failed_to_load_availability');
    }
    if (error instanceof ApiError && error.status) {
      return `${t('failed_to_load_availability')} (HTTP ${error.status}).`;
    }
    if (error instanceof Error && error.message.startsWith('Invalid visit date')) {
      return error.message;
    }
    return t('could_not_reach_backend');
  }

  // ── Create booking mutation ──────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () =>
      createBooking({
        visitDate: dateStr,
        bookingType: 'individual',
        items: Object.entries(quantities).map(([categoryId, quantity]) => ({
          categoryId,
          quantity,
        })),
      }),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['myBookings'] });
      // Navigate to booking detail which shows checkout URL / QR
      router.push(`/(visitor)/booking/${booking.id}`);
    },
    onError: (err: any) => {
      Alert.alert(t('booking_failed'), getApiErrorMessageForDisplay(err));
    },
  });

  // ── Quantity helpers ─────────────────────────────────────────
  const updateQty = (id: string, delta: number) => {
    setQuantities((prev) => {
      const next = (prev[id] ?? 0) + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const totalTickets = Object.values(quantities).reduce((a, b) => a + b, 0);
  const totalPrice = Object.entries(quantities).reduce((sum, [id, qty]) => {
    const cat = displayCategories.find((c) => c.id === id);
    return sum + (cat ? Number(cat.price_etb) * qty : 0);
  }, 0);
  const canContinue =
    dateOpen &&
    !availLoading &&
    !catLoading &&
    !categoriesError &&
    !userLoading &&
    !!currentUser?.email_verified_at &&
    !!currentUser?.phone_verified_at &&
    totalTickets > 0;

  // ── Date strip: next 7 bookable days ────────────────────────
  const dateStrip: Date[] = [];
  {
    let d = addDays(new Date(), 1);
    while (dateStrip.length < 7) {
      if (!isSunday(d)) dateStrip.push(d);
      d = addDays(d, 1);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('book_a_visit')}</Text>
        <Text style={styles.subtitle}>{t('select_date_and_categories')}</Text>

        {/* Date strip */}
        <Text style={styles.sectionLabel}>{t('choose_date')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRow}>
          {dateStrip.map((d) => {
            const str = toDateStr(d);
            const isSelected = str === dateStr;
            return (
              <Pressable
                key={str}
                style={[styles.dateChip, isSelected && styles.dateChipActive]}
                onPress={() => setSelectedDate(d)}
              >
                <Text style={[styles.dateDay, isSelected && styles.dateDayActive]}>
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={[styles.dateNum, isSelected && styles.dateNumActive]}>
                  {d.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Availability feedback */}
        {availLoading ? (
          <View style={styles.availRow}>
            <ActivityIndicator size="small" color="#2E7D32" />
            <Text style={styles.availText}>{t('checking_availability')}</Text>
          </View>
        ) : availabilityError ? (
          <View style={styles.errorBanner}>
            <AlertCircle color="#B3261E" size={18} />
            <View style={styles.errorContent}>
              <Text style={styles.errorText}>
                {availabilityMessage(availabilityErrorValue)}
              </Text>
              <Pressable onPress={() => retryAvailability()} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>{t('retry')}</Text>
              </Pressable>
            </View>
          </View>
        ) : availability && !dateOpen ? (
          <View style={styles.closedBanner}>
            <AlertCircle color="#D32F2F" size={18} />
            <Text style={styles.closedText}>
              {t('date_closed_for_booking')}
            </Text>
          </View>
        ) : availability?.isOpenForBooking ? (
          <View style={styles.availableBanner}>
            <Text style={styles.availableText}>{t('available')}</Text>
          </View>
        ) : null}

        {userError && (
          <View style={styles.errorBanner}>
            <AlertCircle color="#B3261E" size={18} />
            <Text style={styles.errorText}>
              {t('verification_required_before_booking')}
            </Text>
          </View>
        )}

        {!userLoading && currentUser && (!currentUser.email_verified_at || !currentUser.phone_verified_at) && (
          <View style={styles.errorBanner}>
            <AlertCircle color="#B3261E" size={18} />
            <Text style={styles.errorText}>
              Verify your email and phone from the links/codes sent to you before submitting an online booking.
            </Text>
          </View>
        )}

        {/* Category selector */}
        <Text style={styles.sectionLabel}>{t('browse_tickets')}</Text>
        {catLoading ? (
          <ActivityIndicator size="large" color="#2E7D32" style={{ marginTop: 20 }} />
        ) : categoriesError ? (
          <View style={styles.errorBanner}>
            <AlertCircle color="#B3261E" size={18} />
            <View style={styles.errorContent}>
              <Text style={styles.errorText}>
                {t('categories_load_failed')}
              </Text>
              <Pressable onPress={() => retryCategories()} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>{t('retry')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.categoryList}>
            {displayCategories.map((cat) => (
              <View key={cat.id} style={styles.categoryRow}>
                <View style={styles.catInfo}>
                  <Text style={styles.catName}>{cat.name_en}</Text>
                  <Text style={styles.catPrice}>
                    {cat.is_free ? t('free') : `${cat.price_etb} ETB`}
                  </Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable
                    style={[styles.stepBtn, !(quantities[cat.id] > 0) && styles.stepBtnDisabled]}
                    onPress={() => updateQty(cat.id, -1)}
                    disabled={!(quantities[cat.id] > 0)}
                  >
                    <Minus size={16} color={quantities[cat.id] > 0 ? '#2E7D32' : '#CCC'} />
                  </Pressable>
                  <Text style={styles.stepVal}>{quantities[cat.id] ?? 0}</Text>
                  <Pressable
                    style={styles.stepBtn}
                    onPress={() => updateQty(cat.id, 1)}
                    disabled={!dateOpen}
                  >
                    <Plus size={16} color={dateOpen ? '#2E7D32' : '#CCC'} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
        {showReview && canContinue && (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>{t('review_your_visit')}</Text>
            <Text style={styles.reviewLine}>{t('date')}: {selectedDate.toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-US')}</Text>
            {Object.entries(quantities).map(([id, quantity]) => {
              const category = displayCategories.find((item) => item.id === id);
              if (!category) return null;
              return (
                <Text key={id} style={styles.reviewLine}>
                  {category.name_en} × {quantity}
                </Text>
              );
            })}
            <Text style={styles.reviewTotal}>{t('total')}: {totalPrice} ETB</Text>
            <Text style={styles.reviewHint}>
              {t('server_confirms_booking')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer CTA */}
      {totalTickets > 0 && (
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerTickets}>{totalTickets} {t('ticket')}{totalTickets > 1 ? 's' : ''}</Text>
            <Text style={styles.footerPrice}>{totalPrice} ETB</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.ctaBtn,
              pressed && styles.ctaBtnPressed,
              (!canContinue || createMutation.isPending) && styles.ctaBtnDisabled,
            ]}
            onPress={() => {
              if (showReview) createMutation.mutate();
              else setShowReview(true);
            }}
            disabled={!canContinue || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.ctaText}>{showReview ? t('submit_booking') : t('continue')}</Text>
                <ArrowRight color="#FFF" size={20} />
              </>
            )}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  scroll: { padding: 24, paddingBottom: 120 },

  title: { fontSize: 28, fontWeight: '900', color: '#1A1A1A', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 28 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#888', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },

  dateRow: { marginBottom: 20 },
  dateChip: {
    width: 58,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#E5E9F0',
  },
  dateChipActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  dateDay: { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 4 },
  dateDayActive: { color: 'rgba(255,255,255,0.8)' },
  dateNum: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  dateNumActive: { color: '#FFF' },

  availRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  availText: { fontSize: 14, color: '#888', marginLeft: 8 },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  closedText: { fontSize: 14, color: '#D32F2F', marginLeft: 10, flex: 1 },
  availableBanner: {
    backgroundColor: '#E8F5E9',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  availableText: { fontSize: 14, color: '#1B5E20', fontWeight: '600' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFEBEE',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorContent: { flex: 1, marginLeft: 8 },
  errorText: { fontSize: 14, color: '#B3261E', lineHeight: 20, marginBottom: 8 },
  retryButton: { alignSelf: 'flex-start', paddingVertical: 4 },
  retryButtonText: { color: '#8B1E17', fontWeight: '800' },
  reviewCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  reviewTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 },
  reviewLine: { fontSize: 14, color: '#555', marginBottom: 4 },
  reviewTotal: { fontSize: 17, fontWeight: '800', color: '#1B5E20', marginTop: 8 },
  reviewHint: { fontSize: 12, color: '#777', marginTop: 8, lineHeight: 17 },

  categoryList: { gap: 12 },
  categoryRow: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  catInfo: { flex: 1 },
  catName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  catPrice: { fontSize: 14, color: '#2E7D32', fontWeight: '600' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 4,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  stepBtnDisabled: { shadowOpacity: 0, elevation: 0, backgroundColor: '#F5F7FA' },
  stepVal: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', width: 34, textAlign: 'center' },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    padding: 24,
    paddingBottom: 36,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  footerTickets: { fontSize: 13, color: '#888', fontWeight: '500' },
  footerPrice: { fontSize: 22, fontWeight: '900', color: '#1A1A1A' },
  ctaBtn: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  ctaBtnPressed: { backgroundColor: '#1B5E20' },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '700', marginRight: 8 },
});
