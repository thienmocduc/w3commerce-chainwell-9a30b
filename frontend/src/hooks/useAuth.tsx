import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupaUser, Session } from '@supabase/supabase-js';

export type UserRole = 'user' | 'koc' | 'vendor' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  referral_code?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
}

interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  loginWithCredentials: (email: string, password: string, role?: UserRole) => LoginResult;
  loginAsync: (email: string, password: string, role?: UserRole) => Promise<LoginResult>;
  registerAsync: (data: RegisterData) => Promise<LoginResult>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  phone?: string;
  referral_code?: string;
}

const STORAGE_KEY = 'wellkoc-auth';

/* ── Admin fallback (always works without Supabase) ── */
const ADMIN_ACCOUNTS: Record<string, { password: string; user: User }> = {
  'admin@wellkoc.com': {
    password: 'WellKOC@2026',
    user: { id: 'admin-001', email: 'admin@wellkoc.com', name: 'WellKOC Admin', role: 'admin' },
  },
};

/* ── Map Supabase user to our User type ── */
function mapSupaUser(su: SupaUser, roleOverride?: UserRole): User {
  const meta = su.user_metadata || {};
  return {
    id: su.id,
    email: su.email || '',
    name: meta.full_name || meta.name || su.email?.split('@')[0] || 'User',
    role: (meta.role as UserRole) || roleOverride || 'user',
    avatar: meta.avatar_url || meta.avatar,
    phone: su.phone || meta.phone,
    referral_code: meta.referral_code || `WK-${su.id.slice(0, 6).toUpperCase()}`,
  };
}

function getStoredAuth(): AuthState {
  if (typeof window === 'undefined') return { user: null, token: null, refreshToken: null };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as AuthState;
      if (parsed.user && parsed.token) return parsed;
    }
  } catch { /* ignore */ }
  return { user: null, token: null, refreshToken: null };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(getStoredAuth);
  const [loading, setLoading] = useState(true);

  // Persist to localStorage
  useEffect(() => {
    if (authState.user && authState.token) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authState));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [authState]);

  // Listen to Supabase auth changes
  useEffect(() => {
    // Check current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const user = mapSupaUser(session.user);
        setAuthState({ user, token: session.access_token, refreshToken: session.refresh_token || null });
      }
      setLoading(false);
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const user = mapSupaUser(session.user);
        setAuthState({ user, token: session.access_token, refreshToken: session.refresh_token || null });
      } else if (_event === 'SIGNED_OUT') {
        setAuthState({ user: null, token: null, refreshToken: null });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Direct login (for external use)
  const login = useCallback((user: User, token: string) => {
    setAuthState({ user, token, refreshToken: null });
  }, []);

  // Async login — Supabase Auth
  const loginAsync = useCallback(async (email: string, password: string, role: UserRole = 'user'): Promise<LoginResult> => {
    // Admin shortcut
    const adminAccount = ADMIN_ACCOUNTS[email];
    if (adminAccount && adminAccount.password === password) {
      setAuthState({ user: adminAccount.user, token: `admin-token-${Date.now()}`, refreshToken: null });
      return { success: true };
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setLoading(false);
        // Translate common errors to Vietnamese
        const msg = error.message.includes('Invalid login')
          ? 'Email hoặc mật khẩu không đúng'
          : error.message.includes('Email not confirmed')
          ? 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.'
          : error.message;
        return { success: false, error: msg };
      }

      if (data.user && data.session) {
        const user = mapSupaUser(data.user, role);
        // Update role in user_metadata if needed
        if (role && role !== 'user') {
          await supabase.auth.updateUser({ data: { role } });
        }
        setAuthState({
          user,
          token: data.session.access_token,
          refreshToken: data.session.refresh_token || null,
        });
        return { success: true };
      }

      return { success: false, error: 'Đăng nhập thất bại' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi kết nối' };
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync loginWithCredentials — backward compat
  const loginWithCredentials = useCallback(
    (email: string, password: string, role: UserRole = 'user'): LoginResult => {
      const adminAccount = ADMIN_ACCOUNTS[email];
      if (adminAccount && adminAccount.password === password) {
        setAuthState({ user: adminAccount.user, token: `admin-token-${Date.now()}`, refreshToken: null });
        return { success: true };
      }
      // Fire async in background
      loginAsync(email, password, role);
      if (email && password.length >= 6) return { success: true };
      return { success: false, error: 'Email hoặc mật khẩu không đúng' };
    },
    [loginAsync],
  );

  // Register — Supabase Auth
  const registerAsync = useCallback(async (data: RegisterData): Promise<LoginResult> => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.name,
            name: data.name,
            role: data.role,
            phone: data.phone,
            referral_code: data.referral_code,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        setLoading(false);
        const msg = error.message.includes('already registered')
          ? 'Email này đã được đăng ký. Vui lòng đăng nhập.'
          : error.message.includes('Password should be')
          ? 'Mật khẩu phải có ít nhất 6 ký tự'
          : error.message;
        return { success: false, error: msg };
      }

      // Supabase may auto-confirm or require email confirmation
      if (result.session && result.user) {
        // Auto-confirmed — login immediately
        const user = mapSupaUser(result.user, data.role);
        setAuthState({
          user,
          token: result.session.access_token,
          refreshToken: result.session.refresh_token || null,
        });
        return { success: true };
      }

      if (result.user && !result.session) {
        // Email confirmation required
        return { success: true, error: 'confirm_email' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Đăng ký thất bại' };
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    if (authState.token?.startsWith('admin-')) {
      // Admin mock — just clear state
      setAuthState({ user: null, token: null, refreshToken: null });
      return;
    }
    await supabase.auth.signOut();
    setAuthState({ user: null, token: null, refreshToken: null });
  }, [authState.token]);

  const isAuthenticated = authState.user !== null && authState.token !== null;
  const isAdmin = authState.user?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user: authState.user,
      token: authState.token,
      login,
      loginWithCredentials,
      loginAsync,
      registerAsync,
      logout,
      isAuthenticated,
      isAdmin,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      token: null,
      login: () => {},
      loginWithCredentials: () => ({ success: false, error: 'No auth provider' }),
      loginAsync: async () => ({ success: false, error: 'No auth provider' }),
      registerAsync: async () => ({ success: false, error: 'No auth provider' }),
      logout: () => {},
      isAuthenticated: false,
      isAdmin: false,
      loading: false,
    };
  }
  return ctx;
}
