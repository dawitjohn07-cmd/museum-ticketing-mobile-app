import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Backend error envelope: { error: { code, message, fieldErrors? } }
export class ApiError extends Error {
  status?: number;
  code?: string;
  fieldErrors?: Record<string, string>;
  payload: unknown;
  constructor(payload: unknown, status?: number) {
    const parsed = parseError(payload, status);
    super(parsed.message);
    this.name = 'ApiError';
    this.payload = payload;
    this.status = status;
    this.code = parsed.code;
    this.fieldErrors = parsed.fieldErrors;
  }
}

type Parsed = { message: string; code?: string; fieldErrors?: Record<string, string> };
function parseError(payload: unknown, status?: number): Parsed {
  const fallback = `The server rejected the request${status ? ` (HTTP ${status})` : ''}.`;
  if (typeof payload === 'string' && payload.trim()) return { message: payload };
  if (!payload || typeof payload !== 'object') return { message: fallback };
  const body = payload as { detail?: unknown; message?: unknown; error?: { code?: string; message?: string; fieldErrors?: Record<string, unknown> } | string };
  const err = body.error;
  if (typeof err === 'string' && err.trim()) return { message: err };
  if (err && typeof err === 'object') {
    const fe = err.fieldErrors
      ? Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [k, String(v)]))
      : undefined;
    const message =
      (typeof err.message === 'string' && err.message.trim()) ||
      (fe && Object.values(fe).join(' ')) ||
      fallback;
    return { message, code: err.code, fieldErrors: fe };
  }
  if (typeof body.detail === 'string' && body.detail.trim()) return { message: body.detail };
  if (typeof body.message === 'string' && body.message.trim()) return { message: body.message };
  return { message: fallback };
}

export class ApiTimeoutError extends Error {
  constructor() {
    super('The request timed out. Check your connection and try again.');
    this.name = 'ApiTimeoutError';
  }
}

export function getApiErrorMessageForDisplay(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Could not complete the request. Please try again.';
}

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '');
const ACCESS_TOKEN_KEY = 'auth_access_token';
const DEFAULT_TIMEOUT_MS = 15000;
const BOOKING_CREATE_TIMEOUT_MS = 45000; // server calls Chapa inside this request
const native = Platform.OS !== 'web';

let accessToken: string | null = null;
export let currentLanguageHeader = 'en';
export function setGlobalLanguage(lang: string) {
  currentLanguageHeader = lang;
}

const authLostListeners = new Set<() => void>();
export function onAuthLost(cb: () => void) {
  authLostListeners.add(cb);
  return () => { authLostListeners.delete(cb); };
}

export async function setAuthTokens(access: string) {
  accessToken = access;
  if (native) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
}
export async function getAccessToken() {
  if (accessToken) return accessToken;
  if (!native) return null;
  accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  return accessToken;
}
export async function clearAuthTokens() {
  accessToken = null;
  if (native) await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const ext = options.signal;
  const onAbort = () => controller.abort();
  if (ext) {
    if (ext.aborted) controller.abort();
    else ext.addEventListener('abort', onAbort, { once: true });
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted && !ext?.aborted) throw new ApiTimeoutError();
    throw e;
  } finally {
    clearTimeout(timer);
    ext?.removeEventListener('abort', onAbort);
  }
}

// The backend keeps the refresh token ONLY in an httpOnly cookie
// (apps.accounts.cookies) and its refresh endpoint ignores any request body.
// So we send no body and let the platform cookie jar attach it.
let inFlightRefresh: Promise<string | null> | null = null;
export async function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Language': currentLanguageHeader },
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 401) {
          await clearAuthTokens();
          authLostListeners.forEach((cb) => cb());
        }
        return null;
      }
      const data: { access: string } = await res.json();
      await setAuthTokens(data.access);
      return data.access;
    } catch {
      return null; // offline etc.: do not sign the visitor out
    } finally {
      inFlightRefresh = null;
    }
  })();
  return inFlightRefresh;
}

function normalizePath(path: string) {
  const [pathname, search] = path.split('?');
  const p = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return search ? `${p}?${search}` : p;
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const normalized = normalizePath(path);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': currentLanguageHeader,
    ...(options.headers as Record<string, string> | undefined),
  };
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE}${normalized}`, { ...options, headers, credentials: 'include' }, timeoutMs);
  } catch (e) {
    if (e instanceof ApiTimeoutError) throw e;
    throw new Error('Network error: could not reach the server. Check your connection and try again.');
  }

  const isAuthCall = normalized.startsWith('/auth/');
  if (response.status === 401 && !isRetry && !isAuthCall) {
    const fresh = await refreshAccessToken();
    if (fresh) return request<T>(path, options, true, timeoutMs);
  }
  if (response.status === 204) return undefined as T;

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) throw new ApiError({ detail: `Request failed with HTTP ${response.status}.` }, response.status);
    throw new Error('The server returned an invalid response.');
  }
  if (!response.ok) throw new ApiError(data, response.status);
  return data as T;
}

export const apiClient = {
  get: <T>(path: string, options?: Pick<RequestInit, 'signal'>) => request<T>(path, { method: 'GET', ...options }),
  post: <T>(path: string, body?: unknown, timeoutMs?: number) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }, false, timeoutMs ?? DEFAULT_TIMEOUT_MS),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
};
export { BOOKING_CREATE_TIMEOUT_MS };
