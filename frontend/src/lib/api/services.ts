/**
 * services.ts
 *
 * Centralized service layer for the ZNHM-AAU mobile app.
 * Maps every endpoint from frontend_web/src/features/[feature]/api.ts to the mobile apiClient.
 * All server communication MUST go through this file.
 * No secrets. No fake data. Django backend is authoritative.
 */
import { apiClient } from './client';
import { Platform } from 'react-native';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface Category {
  id: string;
  name_en: string;
  name_am?: string;
  price_etb: number;
  is_free: boolean;
  active: boolean;
}

export type BookingStatus =
  | 'awaiting_payment'
  | 'pending'
  | 'visited'
  | 'cancelled'
  | 'refunded';

export type BookingType = 'individual' | 'group';

export interface BookingItem {
  id: string;
  categoryId: string;
  categoryNameEn: string;
  categoryNameAm: string;
  quantity: number;
  attendedQuantity?: number;
  unitPriceEtb: number;
  subtotalEtb: number;
}

export interface Booking {
  id: string;
  reference: string;
  visitDate: string;
  status: BookingStatus;
  bookingType: BookingType;
  totalAmountEtb: number;
  checkoutUrl?: string;
  items: BookingItem[];
  createdAt: string;
  rescheduledCount?: number;
  groupName?: string;
  groupContactPhone?: string;
  refunds?: Refund[];
}

export interface PaginatedList<T> {
  data: T[];
  meta: { total: number; limit: number; offset: number };
}

export interface DateAvailability {
  date: string;
  isOpenForBooking: boolean;
}

export interface Voucher {
  transaction_ref: string;
  amount: number;
  date: string;
}

export interface CheckInResponse extends Booking {
  voucher?: Voucher;
}

export interface Refund {
  id: string;
  bookingId: string;
  amountEtb: string;
  reason: 'cancellation' | 'partial_shortfall' | 'no_response' | 'category_correction';
  status: 'pending' | 'completed' | 'failed';
  chapaRefundReference: string | null;
  createdAt: string;
}

export async function getMyRefunds(): Promise<PaginatedList<Refund>> {
  return apiClient.get<PaginatedList<Refund>>('/refunds/?limit=100&offset=0');
}

export interface OutstandingBalance {
  balanceEtb: string;
  pendingVoucherCount: number;
}

export interface CashierReconciliation {
  id: string;
  cashierId: string;
  amountEtb: string;
  chapaTransferReference: string | null;
  status: 'pending' | 'completed' | 'failed';
  initiatedAt: string | null;
  completedAt: string | null;
  transferReceiptUrl: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface Account {
  id: string;
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  role: 'visitor' | 'cashier' | 'manager' | 'platform_admin';
  active: boolean;
  email_verified_at?: string | null;
  phone_verified_at?: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  user: Account;
}

// ─────────────────────────────────────────
// AUTH SERVICES
// ─────────────────────────────────────────

// POST /auth/visitor/verify/start/ — Visitor OTP step 1
export async function startVisitorVerification(input: { phone: string; email: string }) {
  return apiClient.post<{ verification_id: string; otp_expires_in_seconds: number }>('/auth/visitor/verify/start/', input);
}

// POST /auth/visitor/verify/confirm/ — Visitor OTP step 2
export async function confirmVisitorOtp(input: { verification_id: string; otp_code: string }) {
  return apiClient.post<AuthResponse>('/auth/visitor/verify/confirm/', input);
}

// POST /auth/login/ — Staff (email/password)
export async function staffLogin(input: { email: string; password: string }) {
  return apiClient.post<AuthResponse>('/auth/login/', input);
}

// GET /users/me/ — current authenticated user
export async function getCurrentUser() {
  return apiClient.get<Account>('/users/me/');
}

// POST /auth/logout/
export async function logout() {
  return apiClient.post<void>('/auth/logout/');
}

// PUT /users/me/
export async function updateCurrentUser(input: Partial<Pick<Account, 'first_name' | 'last_name' | 'phone'>>) {
  return apiClient.put<Account>('/users/me/', input);
}

// ─────────────────────────────────────────
// CATALOG SERVICES
// ─────────────────────────────────────────

// GET /categories/ — public, active-only by default
export async function getCategories(options?: { includeInactive?: boolean }): Promise<Category[]> {
  const qs = options?.includeInactive ? '?active=all' : '';
  const response = await apiClient.get<PaginatedList<Category>>(`/categories/${qs}`);
  return response.data;
}

// POST /categories/ — Manager only
export async function createCategory(input: Pick<Category, 'name_en' | 'price_etb'> & { name_am?: string; is_free?: boolean }) {
  return apiClient.post<Category>('/categories/', input);
}

// PUT /categories/{id}/ — Manager only (price/name edits AND active toggle)
export async function updateCategory(id: string, input: Partial<Pick<Category, 'name_en' | 'name_am' | 'price_etb' | 'active' | 'is_free'>>) {
  return apiClient.put<Category>(`/categories/${id}/`, input);
}

// DELETE /categories/{id}/ — soft retire, Manager only
export async function retireCategory(id: string): Promise<void> {
  return apiClient.delete<void>(`/categories/${id}/`);
}

// ─────────────────────────────────────────
// BOOKING SERVICES
// ─────────────────────────────────────────

export interface CreateBookingInput {
  visitDate: string;
  items: { categoryId: string; quantity: number }[];
  bookingType: BookingType;
  paymentReturnTarget?: 'mobile_web' | 'mobile_native';
}

// POST /bookings/ — authenticated Visitor only
export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  return apiClient.post<Booking>('/bookings/', {
    ...input,
    paymentReturnTarget: Platform.OS === 'web' ? 'mobile_web' : 'mobile_native',
  });
}

// GET /bookings/{id}/ — Visitor who owns it, or any staff
export async function getBooking(id: string): Promise<Booking> {
  return apiClient.get<Booking>(`/bookings/${id}/`);
}

// POST /payments/bookings/{id}/verify/ — server-side Chapa reconciliation
export async function verifyBookingPayment(id: string): Promise<Booking> {
  return apiClient.post<Booking>(`/payments/bookings/${id}/verify/`);
}

// GET /users/me/bookings/ — current Visitor's own bookings
export async function getMyBookings(params?: { limit?: number; offset?: number }): Promise<PaginatedList<Booking>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return apiClient.get<PaginatedList<Booking>>(`/users/me/bookings/${qs ? `?${qs}` : ''}`);
}

// POST /bookings/{id}/cancel/ — Visitor or Manager
export async function cancelBooking(id: string): Promise<Booking> {
  return apiClient.post<Booking>(`/bookings/${id}/cancel/`);
}

// POST /bookings/{id}/reschedule/ — at most once (FR-BOOK-007)
export async function rescheduleBooking(id: string, newVisitDate: string): Promise<Booking> {
  return apiClient.post<Booking>(`/bookings/${id}/reschedule/`, { newVisitDate });
}

// PATCH /bookings/{id}/ — edit items/date while awaiting_payment
export async function updateBooking(id: string, input: { items?: { categoryId: string; quantity: number }[]; visitDate?: string }): Promise<Booking> {
  return apiClient.patch<Booking>(`/bookings/${id}/`, input);
}

// GET /availability/?from=...&to=...
export async function checkDateAvailability(
  date: string,
  signal?: AbortSignal
): Promise<{ isOpenForBooking: boolean }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid visit date. Use YYYY-MM-DD.');
  }
  const query = new URLSearchParams({ from: date, to: date });
  const dates = await apiClient.get<DateAvailability[]>(
    `/availability/?${query.toString()}`,
    { signal }
  );
  const match = dates.find((d) => d.date === date);
  if (!match) {
    throw new Error('The availability response did not include the selected date.');
  }
  return { isOpenForBooking: match.isOpenForBooking };
}

export async function getAvailabilityRange(from: string, to: string): Promise<DateAvailability[]> {
  const query = new URLSearchParams({ from, to });
  return apiClient.get<DateAvailability[]>(`/availability/?${query.toString()}`);
}

// POST /availability/toggle/ — Manager only (closes/opens a date)
export async function toggleDateAvailability(date: string, isOpen: boolean): Promise<DateAvailability> {
  return apiClient.post<DateAvailability>(`/availability/`, { date, is_open_for_booking: isOpen });
}

// ─────────────────────────────────────────
// ENTRANCE / CASHIER SERVICES
// ─────────────────────────────────────────

// GET /bookings/lookup?reference=... — Cashier only
export async function lookupBooking(reference: string): Promise<Booking> {
  return apiClient.get<Booking>(`/bookings/lookup/?reference=${encodeURIComponent(reference)}`);
}

// POST /bookings/{id}/check-in/ — Cashier only
export async function checkInBooking(bookingId: string): Promise<CheckInResponse> {
  return apiClient.post<CheckInResponse>(`/bookings/${bookingId}/check-in/`);
}

// POST /bookings/{id}/flag-mismatch/ — Cashier only
export async function flagBookingMismatch(bookingId: string, note?: string): Promise<Booking> {
  return apiClient.post<Booking>(`/bookings/${bookingId}/flag-mismatch/`, { note: note ?? null });
}

// GET /bookings/{id}/ifmis-voucher/ — Cashier
export async function getIfmisVoucher(bookingId: string): Promise<Voucher> {
  return apiClient.get<Voucher>(`/bookings/${bookingId}/ifmis-voucher/`);
}

// PATCH /bookings/{id}/ifmis-voucher/ — Cashier: record Document No + Ref No (both required)
export async function recordIfmisVoucher(bookingId: string, documentNo: string, refNo: string): Promise<Booking> {
  return apiClient.patch<Booking>(`/bookings/${bookingId}/ifmis-voucher/`, { documentNo, refNo });
}

// ─────────────────────────────────────────
// MANAGER / CORRECTION SERVICES
// ─────────────────────────────────────────

// GET /bookings/?flagged=true — Manager: list flagged bookings for correction
export async function getFlaggedBookings(params?: { limit?: number; offset?: number }): Promise<PaginatedList<Booking>> {
  const query = new URLSearchParams({ flagged: 'true' });
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  return apiClient.get<PaginatedList<Booking>>(`/bookings/?${query.toString()}`);
}

// PATCH /bookings/{id}/category-correction/ — Manager: single-item correction
export async function correctBookingCategory(
  bookingId: string,
  itemId: string,
  correction: { categoryId?: string; quantity?: number }
): Promise<Booking> {
  return apiClient.patch<Booking>(`/bookings/${bookingId}/category-correction/`, {
    itemId,
    ...(correction.categoryId ? { categoryId: correction.categoryId } : {}),
    ...(correction.quantity !== undefined ? { quantity: correction.quantity } : {}),
  });
}

// PATCH /bookings/{id}/category-corrections/batch/ — Manager: atomic batch correction
export async function correctBookingCategoryBatch(
  bookingId: string,
  ops: { itemId: string | null; categoryId?: string; quantity?: number }[]
): Promise<Booking> {
  return apiClient.patch<Booking>(`/bookings/${bookingId}/category-corrections/batch/`, { ops });
}

// POST /bookings/{id}/items/ — Manager: add a new item line to a Pending booking
export async function addBookingItem(bookingId: string, addition: { categoryId: string; quantity: number }): Promise<Booking> {
  return apiClient.post<Booking>(`/bookings/${bookingId}/items/`, addition);
}

// ─────────────────────────────────────────
// REFUND SERVICES
// ─────────────────────────────────────────

// GET /refunds — Visitor sees own, Staff sees all
export async function getRefunds(params?: { limit?: number; offset?: number; reason?: Refund['reason'] }): Promise<PaginatedList<Refund>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.reason) query.set('reason', params.reason);
  const qs = query.toString();
  return apiClient.get<PaginatedList<Refund>>(`/refunds/${qs ? `?${qs}` : ''}`);
}

// POST /bookings/{id}/refund-requests — Visitor: shortfall refund request
export async function requestPartialRefund(bookingId: string, note?: string): Promise<Refund> {
  return apiClient.post<Refund>(`/bookings/${bookingId}/refund-requests/`, { note: note ?? null });
}

// ─────────────────────────────────────────
// REPORTS SERVICES (Manager / Admin)
// ─────────────────────────────────────────

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface DashboardStats {
  revenueTotalEtb: string;
  visitorCountsByCategory: { [key: string]: number };
  groupVsIndividualSplit: { group: number; individual: number };
  statusMix: {
    pending: number;
    visited: number;
    cancelled: number;
    refunded: number;
  };
}

export async function getDashboard(): Promise<DashboardStats> {
  return apiClient.get<DashboardStats>('/reports/dashboard/');
}

export interface ReportSummary {
  period: string;
  to: string;
  bookingCount: number;
  revenueByCategory: { [key: string]: string };
  visitorCountsByGroup: { [key: string]: number };
  from: string;
}

export async function getReportSummary(period: ReportPeriod = 'daily'): Promise<ReportSummary> {
  return apiClient.get<ReportSummary>(`/reports/summary/?period=${period}`);
}

// ─────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────

export async function getCashierBalances() {
  return apiClient.get<any>('/reports/cashier-balances/');
}
// SETTLEMENT
// ─────────────────────────────────────────

export async function getMyOutstandingBalance(): Promise<OutstandingBalance> {
  return apiClient.get<OutstandingBalance>('/settlement/my-balance/');
}

export async function initiateReconciliation(): Promise<CashierReconciliation> {
  return apiClient.post<CashierReconciliation>('/settlement/reconcile/');
}

export async function listReconciliations(params?: { limit?: number; offset?: number }): Promise<PaginatedList<CashierReconciliation>> {
  const qs = Object.entries(params || {})
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return apiClient.get<PaginatedList<CashierReconciliation>>(`/settlement/reconciliations/${qs ? `?${qs}` : ''}`);
}

export async function getBookingTimeline(range?: { from: string; to: string }) {
  const query = range ? `?from=${range.from}&to=${range.to}` : '';
  return apiClient.get<any>(`/reports/booking-timeline/${query}`);
}

export async function getAttendanceReport(range: { from: string; to: string }) {
  return apiClient.get<any>(`/reports/attendance/?from=${range.from}&to=${range.to}`);
}

export async function getRevenueReport(range: { from: string; to: string }) {
  return apiClient.get<any>(`/reports/revenue/?from=${range.from}&to=${range.to}`);
}

// ─────────────────────────────────────────
// ADMIN SERVICES
// ─────────────────────────────────────────

// GET /admin/staff/
export async function getStaffAccounts(params?: { limit?: number; offset?: number }): Promise<PaginatedList<Account>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return apiClient.get<PaginatedList<Account>>(`/admin/staff/${qs ? `?${qs}` : ''}`);
}

// POST /admin/staff/ — provision (no password, email set-link sent by backend)
export async function createStaffAccount(input: { email: string; role: 'cashier' | 'manager' }) {
  return apiClient.post<Account>('/admin/staff/', input);
}

// PUT /admin/staff/{id}/ — update role/profile, or set active:true to reactivate
export async function updateStaffAccount(id: string, input: Partial<Pick<Account, 'role' | 'first_name' | 'last_name' | 'active'>>) {
  return apiClient.put<Account>(`/admin/staff/${id}/`, input);
}

// DELETE /admin/staff/{id}/ — deactivates (soft delete)
export async function deactivateStaffAccount(id: string): Promise<void> {
  return apiClient.delete<void>(`/admin/staff/${id}/`);
}

// Reactivate uses PUT with active:true
export async function activateStaffAccount(id: string): Promise<Account> {
  return apiClient.put<Account>(`/admin/staff/${id}/`, { active: true });
}
