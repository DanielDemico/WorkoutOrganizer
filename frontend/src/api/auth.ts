import { apiFetch, setTokens, type Tokens } from './client';
import type { User } from '../types';

export async function login(name: string, password: string): Promise<Tokens> {
  const tokens = await apiFetch<Tokens>('/api/auth/login', {
    method: 'POST',
    body: { name, password },
    skipAuth: true,
  });
  setTokens(tokens);
  return tokens;
}

export async function register(name: string, password: string): Promise<User> {
  return apiFetch<User>('/api/users', {
    method: 'POST',
    body: { name, password },
    skipAuth: true,
  });
}

export async function logout(refreshToken: string): Promise<void> {
  await apiFetch<void>('/api/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    skipAuth: true,
  });
}
