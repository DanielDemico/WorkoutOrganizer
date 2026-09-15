import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getTokens, onAuthChange, setTokens } from '../api/client';
import * as authApi from '../api/auth';

interface AuthUser {
  id: number;
  name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (name: string, password: string) => Promise<void>;
  register: (name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeUser(accessToken: string): AuthUser | null {
  try {
    const [, payload] = accessToken.split('.');
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return { id: Number(claims.sub), name: claims.unique_name as string };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const tokens = getTokens();
    return tokens ? decodeUser(tokens.accessToken) : null;
  });

  useEffect(
    () =>
      onAuthChange(() => {
        const tokens = getTokens();
        setUser(tokens ? decodeUser(tokens.accessToken) : null);
      }),
    [],
  );

  const login = async (name: string, password: string) => {
    await authApi.login(name, password);
  };

  const register = async (name: string, password: string) => {
    await authApi.register(name, password);
    await authApi.login(name, password);
  };

  const logout = async () => {
    const tokens = getTokens();
    if (tokens) {
      try {
        await authApi.logout(tokens.refreshToken);
      } catch {
        // Best-effort: the token gets dropped locally regardless.
      }
    }
    setTokens(null);
  };

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
