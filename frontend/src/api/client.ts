import { getLang } from '../i18n/lang';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5199';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

const STORAGE_KEY = 'workout-organizer:tokens';

type Listener = () => void;
const listeners = new Set<Listener>();

export function onAuthChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyAuthChange() {
  listeners.forEach((listener) => listener());
}

export function getTokens(): Tokens | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tokens;
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens | null) {
  if (tokens) localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(STORAGE_KEY);
  notifyAuthChange();
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Refresh rotates the token on every call, so concurrent 401s must share one in-flight refresh
// instead of each swapping the stored refresh token out from under the others.
let refreshPromise: Promise<Tokens | null> | null = null;

async function refreshTokens(): Promise<Tokens | null> {
  const current = getTokens();
  if (!current) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!res.ok) {
          setTokens(null);
          return null;
        }
        const next = (await res.json()) as Tokens;
        setTokens(next);
        return next;
      } catch {
        setTokens(null);
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

// Every request carries the active language, so no call site has to remember to pass it
// (spec 004 §7.1). Endpoints that have no dataset text simply ignore the parameter.
function withLang(path: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}lang=${getLang()}`;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip attaching the access token / retrying on 401 (used by login/register/logout). */
  skipAuth?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options;

  const doFetch = async (accessToken: string | null): Promise<Response> => {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const finalHeaders: Record<string, string> = {
      ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(headers as Record<string, string> | undefined),
    };
    if (accessToken && !skipAuth) finalHeaders.Authorization = `Bearer ${accessToken}`;

    return fetch(`${API_URL}${withLang(path)}`, {
      ...rest,
      headers: finalHeaders,
      body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  const tokens = getTokens();
  let res = await doFetch(tokens?.accessToken ?? null);

  if (res.status === 401 && !skipAuth && tokens?.refreshToken) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      res = await doFetch(refreshed.accessToken);
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function mediaUrl(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  return `${API_URL}/${relativePath}`;
}
