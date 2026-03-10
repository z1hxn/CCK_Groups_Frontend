import { API_URL } from '@/shared/config';
import { getAccessToken, removeAccessToken } from '@/shared/auth/tokenStorage';

const normalizePath = (requestPath: string): string => {
  if (requestPath.startsWith('http://') || requestPath.startsWith('https://')) return requestPath;
  const base = (API_URL || '/api').replace(/\/$/, '');
  const endpoint = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  return `${base}${endpoint}`;
};

export async function apiRequest<T>(requestPath: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init?.headers ?? {});

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(normalizePath(requestPath), {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) removeAccessToken();
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}
