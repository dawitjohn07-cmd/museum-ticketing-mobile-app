/**
 * Visitor API layer. Every call matches contracts/openapi.yaml of the website
 * backend (unchanged). Staff / manager / admin endpoints are intentionally absent.
 */
import { apiClient, BOOKING_CREATE_TIMEOUT_MS } from './client';

export type Locale = 'en' | 'am';
export type BookingStatus = 'awaiting_payment' | 'pending' | 'visited' | 'cancelled' | 'refunded';
export type BookingType = 'individual' | 'group';

export interface Category {
  id: string; name_en: string; name_am: string; price_etb: string; is_free: boolean; active: boolean;
}
export interface BookingItem {
  id: string; categoryId: string; categoryNameEn: string; categoryNameAm: string;
  quantity: number; attendedQuantity: number | null; unitPriceEtb: string; subtotalEtb: string;
}
export interface Booking {
  id: string; reference: string; visitDate: string; bookingType: BookingType;
  groupName: string | null; groupContactPhone: string | null; groupTin: string | null;
  items: BookingItem[]; bookedQuantity: number; attendedQuantity: number | null;
  status: BookingStatus; rescheduledCount: number; categoryCorrectedAt: string | null;
  checkoutUrl: string | null; receiptUrl: string | null; totalAmountEtb: string; createdAt: string;
}
export interface Paginated<T> { data: T[]; meta: { total: number; limit: number; offset: number } }
export interface DateAvailability { date: string; isOpenForBooking: boolean }
export interface Refund {
  id: string; bookingId: string; amountEtb: string;
  reason: 'cancellation' | 'partial_shortfall' | 'no_response' | 'category_correction';
  status: 'pending' | 'completed' | 'failed'; chapaRefundReference: string | null; createdAt: string;
}
export interface Account {
  id: string; email: string; phone: string | null; full_name: string; role: string;
  language_preference: Locale; active: boolean;
  email_verified_at: string | null; phone_verified_at: string | null; created_at: string;
}
export interface AuthResponse { access_token: string; user: Account }
export interface ItemInput { categoryId: string; quantity: number }

// ── Auth ──
export const startVisitorVerification = (input: { email: string; phone: string; full_name?: string; language_preference?: Locale }) =>
  apiClient.post<{ verification_id: string; otp_expires_in_seconds: number }>('/auth/visitor/verify/start/', input);
export const confirmVisitorOtp = (input: { verification_id: string; otp_code: string }) =>
  apiClient.post<AuthResponse>('/auth/visitor/verify/confirm/', input);
export const logout = () => apiClient.post<void>('/auth/logout/');
export const getCurrentUser = () => apiClient.get<Account>('/users/me/');
export const updateCurrentUser = (input: { full_name?: string; phone?: string | null; language_preference?: Locale }) =>
  apiClient.put<Account>('/users/me/', input);

// ── Catalog / availability ──
export async function getCategories(): Promise<Category[]> {
  const r = await apiClient.get<Paginated<Category>>('/categories/?limit=100');
  return r.data;
}
// Both params required by the backend; plain array (no envelope); max 366 days.
export const getAvailabilityRange = (from: string, to: string) =>
  apiClient.get<DateAvailability[]>(`/availability/?from=${from}&to=${to}`);

// ── Bookings ──
export interface CreateBookingInput {
  visitDate: string; items: ItemInput[]; bookingType: BookingType;
  groupName?: string; groupTin?: string; groupContactPhone?: string | null;
}
export const createBooking = (input: CreateBookingInput) =>
  apiClient.post<Booking>('/bookings/', input, BOOKING_CREATE_TIMEOUT_MS);
export const getBooking = (id: string) => apiClient.get<Booking>(`/bookings/${id}/`);
export const getMyBookings = (p?: { limit?: number; offset?: number }) => {
  const q = new URLSearchParams();
  if (p?.limit) q.set('limit', String(p.limit));
  if (p?.offset) q.set('offset', String(p.offset));
  const qs = q.toString();
  return apiClient.get<Paginated<Booking>>(`/users/me/bookings/${qs ? `?${qs}` : ''}`);
};
export const updateBooking = (id: string, input: { items?: ItemInput[]; visitDate?: string }) =>
  apiClient.patch<Booking>(`/bookings/${id}/`, input);
export const cancelBooking = (id: string) => apiClient.post<Booking>(`/bookings/${id}/cancel/`);
export const rescheduleBooking = (id: string, newVisitDate: string) =>
  apiClient.post<Booking>(`/bookings/${id}/reschedule/`, { newVisitDate });

// ── Refunds ──
export const getMyRefunds = (reason?: Refund['reason']) =>
  apiClient.get<Paginated<Refund>>(`/refunds/?limit=100${reason ? `&reason=${reason}` : ''}`);
export const requestPartialRefund = (bookingId: string) =>
  apiClient.post<Refund>(`/bookings/${bookingId}/refund-requests/`);

// ── Group visits ──
export async function lookupInstitutionByTin(tin: string) {
  const r = await apiClient.get<{ institution: { id: string; name: string; nameAm: string | null; tin: string } | null }>(
    `/institutions/?tin=${encodeURIComponent(tin)}`
  );
  return r.institution;
}
