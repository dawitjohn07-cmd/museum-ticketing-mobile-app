import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import {
  clearAuthTokens, getAccessToken, onAuthLost, refreshAccessToken, setAuthTokens,
} from '../lib/api/client';
import { getCurrentUser, logout as logoutRequest, type Account } from '../lib/api/services';

interface AuthCtx {
  user: Account | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (accessToken: string, user?: Account) => Promise<Account>;
  setUser: (u: Account | null) => void;
  refreshUser: () => Promise<Account>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => onAuthLost(() => setUser(null)), []);

  // Restore the session: stored access token (native) or a silent refresh
  // through the refresh-token cookie (also covers web reloads).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let token = await getAccessToken();
        if (!token) token = await refreshAccessToken();
        if (token) {
          const me = await getCurrentUser();
          if (alive) setUser(me);
        }
      } catch {
        // stay signed out
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const signIn = useCallback(async (access: string, u?: Account) => {
    await setAuthTokens(access);
    const me = u ?? (await getCurrentUser());
    setUser(me);
    return me;
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await getCurrentUser();
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try { await logoutRequest(); } catch { /* best effort */ }
    await clearAuthTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: !!user, signIn, setUser, refreshUser, logout }),
    [user, isLoading, signIn, refreshUser, logout]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}

/** Redirects to login (remembering where to return) and, when requireEmail is set,
 *  to the email-confirmation step: mirrors the website's /verify?redirect= gate. */
export function useRequireAuth(opts?: { requireEmail?: boolean }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (auth.isLoading) return;
    if (!auth.isAuthenticated) {
      router.replace({ pathname: '/(auth)/login', params: { redirect: pathname } } as never);
    } else if (opts?.requireEmail && auth.user && !auth.user.email_verified_at) {
      router.replace({ pathname: '/(auth)/email-pending', params: { redirect: pathname } } as never);
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.user, opts?.requireEmail, pathname, router]);
  return auth;
}

export function safeRedirect(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/(visitor)') ? value : '/(visitor)/bookings';
}
