/**
 * useAuth.ts
 *
 * Centralized auth state hook. Restores native sessions from the API client,
 * exposes login/logout helpers, and drives role-based routing. Web sessions
 * are intentionally memory-only because tokens are never persisted in
 * browser storage.
 * No fake data — all API calls hit Django.
 */
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  setAuthTokens,
  clearAuthTokens,
  getAccessToken,
} from '../lib/api/client';
import {
  startVisitorVerification,
  confirmVisitorOtp,
  getCurrentUser,
  logout as logoutService,
  type Account,
} from '../lib/api/services';

interface AuthState {
  user: Account | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // On native, the API client reads the token from SecureStore. On web,
  // this is memory-only and therefore returns no token after a page reload.
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          const user = await getCurrentUser();
          setState({ user, isLoading: false, isAuthenticated: true });
        } else {
          setState((s) => ({ ...s, isLoading: false }));
        }
      } catch {
        // Token is stale or backend unreachable — clear tokens
        await clearAuthTokens();
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    })();
  }, []);

  // ── Visitor OTP step 1 ─────────────────────────────────────────
  const sendVisitorOtp = useCallback(
    async (
      input: { email: string; phone: string }
    ): Promise<{ verification_id?: string; error?: string }> => {
      try {
        const res = await startVisitorVerification(input);
        return { verification_id: res.verification_id };
      } catch (err: any) {
        const msg = err?.payload?.detail ?? 'Failed to send OTP.';
        return { error: msg };
      }
    },
    []
  );

  // ── Visitor OTP step 2 ─────────────────────────────────────────
  const confirmOtp = useCallback(
    async (
      verification_id: string,
      otp_code: string
    ): Promise<{ error?: string }> => {
      try {
        const res = await confirmVisitorOtp({ verification_id, otp_code });
        await setAuthTokens(res.access_token);
        const user = await getCurrentUser();
        setState({ user, isLoading: false, isAuthenticated: true });
        router.replace('/(visitor)/home');
        return {};
      } catch (err: any) {
        const msg = err?.payload?.detail ?? 'Invalid OTP code.';
        return { error: msg };
      }
    },
    [router]
  );

  // ── Logout ─────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await logoutService();
    } catch {
      // Best-effort — always clear local tokens
    }
    await clearAuthTokens();
    setState({ user: null, isLoading: false, isAuthenticated: false });
    router.replace('/(auth)/login');
  }, [router]);

  return {
    ...state,
    sendVisitorOtp,
    confirmOtp,
    logout,
  };
}
