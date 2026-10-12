import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export class ApiError extends Error {
  constructor(public payload: unknown, public status?: number) {
    super(getApiErrorMessage(payload, status));
    this.name = 'ApiError';
  }
}

function getApiErrorMessage(payload: unknown, status?: number): string {
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (!payload || typeof payload !== 'object') {
    return `The server rejected the request${status ? ` (HTTP ${status})` : ''}.`;
  }

  const body = payload as {
    detail?: unknown;
    message?: unknown;
    error?: { message?: unknown; fieldErrors?: unknown } | string;
  };
  const error = body.error;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
    if (error.fieldErrors && typeof error.fieldErrors === 'object') {
      return Object.entries(error.fieldErrors)
        .map(([field, message]) => `${field}: ${String(message)}`)
        .join(' ');
    }
  }
  if (typeof body.detail === 'string' && body.detail.trim()) return body.detail;
  if (typeof body.message === 'string' && body.message.trim()) return body.message;

  return `The server rejected the request${status ? ` (HTTP ${status})` : ''}.`;
}

export function getApiErrorMessageForDisplay(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof ApiTimeoutError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Could not complete the request. Please try again.';
}

export class ApiTimeoutError extends Error {
  constructor() {
    super('The request timed out. Check the backend URL and network connection.');
    this.name = 'ApiTimeoutError';
  }
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const REQUEST_TIMEOUT_MS = 10000;
const canUseNativeSecureStore = Platform.OS !== 'web';

let inMemoryAccessToken: string | null = null;
export let currentLanguageHeader = 'en';

export function setGlobalLanguage(lang: string) {
  currentLanguageHeader = lang;
}

export async function setAuthTokens(access: string, refresh?: string) {
  inMemoryAccessToken = access;
  if (!canUseNativeSecureStore) return;
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
  if (refresh) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
}

export async function getAccessToken() {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  if (!canUseNativeSecureStore) return null;
  inMemoryAccessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  return inMemoryAccessToken;
}

export async function getRefreshToken() {
  if (!canUseNativeSecureStore) return null;
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearAuthTokens() {
  inMemoryAccessToken = null;
  if (!canUseNativeSecureStore) return;
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

let inFlightRefresh: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;
      const response = await fetchWithTimeout(`${API_BASE}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refresh: refreshToken }),
      });
      if (!response.ok) {
        await clearAuthTokens();
        return null;
      }
      const data: { access: string; refresh?: string } = await response.json();
      await setAuthTokens(data.access, data.refresh ?? refreshToken);
      return data.access;
    } finally {
      inFlightRefresh = null;
    }
  })();
  return inFlightRefresh;
}

function normalizePath(path: string) {
  const [pathname, search] = path.split('?');
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return search ? `${normalized}?${search}` : normalized;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const externalSignal = options.signal;
  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', abortFromExternalSignal, { once: true });
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new ApiTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const normalizedPath = normalizePath(path);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': currentLanguageHeader,
    ...(options.headers as Record<string, string> | undefined),
  };
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE}${normalizedPath}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (error) {
    if (error instanceof ApiTimeoutError) throw error;
    throw new Error('Network error: could not reach the server. Check the backend URL and connection.');
  }

  if (response.status === 401 && !isRetry && !normalizedPath.startsWith('/auth/refresh')) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(path, options, true);
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
  get: <T>(path: string, options?: Pick<RequestInit, 'signal'>) =>
    request<T>(path, { method: 'GET', ...options }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
