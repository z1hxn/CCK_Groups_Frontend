import { API_URL } from '@/shared/config';
import { getAccessToken, removeAccessToken, setAccessToken } from '@/shared/auth/tokenStorage';

type ApiRequestInit = RequestInit & {
  skipRefresh?: boolean;
};

type RefreshResponse = {
  access_token: string;
};

const normalizePath = (requestPath: string): string => {
  if (requestPath.startsWith('http://') || requestPath.startsWith('https://')) return requestPath;
  const base = (API_URL || '/api').replace(/\/$/, '');
  const endpoint = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  return `${base}${endpoint}`;
};

let refreshPromise: Promise<string | null> | null = null;

const createRequestInit = (init?: RequestInit) => {
  const token = getAccessToken();
  const headers = new Headers(init?.headers ?? {});

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return {
    ...init,
    credentials: 'include' as RequestCredentials,
    headers,
  };
};

const refreshAccessToken = async (): Promise<string | null> => {
  const response = await fetch(normalizePath('/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!response.ok) {
    removeAccessToken();
    return null;
  }

  const data = (await response.json()) as RefreshResponse;
  if (!data?.access_token) {
    removeAccessToken();
    return null;
  }

  setAccessToken(data.access_token);
  return data.access_token;
};

const getOrCreateRefreshPromise = async () => {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
};

export async function apiRequest<T>(requestPath: string, init?: ApiRequestInit): Promise<T> {
  const { skipRefresh, ...requestInit } = init ?? {};
  const response = await fetch(normalizePath(requestPath), createRequestInit(requestInit));

  if (response.status === 401 && !skipRefresh) {
    const refreshedToken = await getOrCreateRefreshPromise();
    if (refreshedToken) {
      const retryResponse = await fetch(normalizePath(requestPath), createRequestInit(requestInit));
      if (retryResponse.ok) return parseResponse<T>(retryResponse);

      if (retryResponse.status === 401) {
        removeAccessToken();
      }

      const retryMessage = await retryResponse.text();
      throw new Error(retryMessage || `Request failed (${retryResponse.status})`);
    }
  }

  if (!response.ok) {
    if (response.status === 401) removeAccessToken();
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  return parseResponse<T>(response);
}
