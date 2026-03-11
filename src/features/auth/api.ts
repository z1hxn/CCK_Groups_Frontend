import { apiRequest } from '@/shared/api/client';
import { LOGIN_URL } from '@/shared/config';
import { removeAccessToken, setAccessToken } from '@/shared/auth/tokenStorage';

type TokenResponse = {
  access_token: string;
};

type AuthInfoResponse = {
  name: string;
  enName: string;
  state: string;
  cckId: string;
  wcaId?: string;
  gender?: string;
  position?: string;
};

export const startLogin = () => {
  window.location.href = LOGIN_URL;
};

export const exchangeCode = async (code: string) => {
  const token = await apiRequest<TokenResponse>(`/auth/token?code=${encodeURIComponent(code)}`, {
    method: 'POST',
  });
  setAccessToken(token.access_token);
};

export const logout = async () => {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } finally {
    removeAccessToken();
  }
};

export const getAuthInfoByCckId = async (cckId: string): Promise<AuthInfoResponse> => {
  const normalizedCckId = cckId.trim().toLowerCase();
  const response = await fetch(`https://auth.cubingclub.com/api/auth/info/${encodeURIComponent(normalizedCckId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Auth info request failed (${response.status})`);
  }

  const data = (await response.json()) as Partial<AuthInfoResponse> | null;
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid auth info payload');
  }

  return {
    name: String(data.name ?? ''),
    enName: String(data.enName ?? ''),
    state: String(data.state ?? ''),
    cckId: String(data.cckId ?? normalizedCckId),
    wcaId: data.wcaId ? String(data.wcaId) : '',
    gender: data.gender ? String(data.gender) : '',
    position: data.position ? String(data.position) : '',
  };
};

export const getMyAuthInfo = async (): Promise<AuthInfoResponse> => {
  return apiRequest<AuthInfoResponse>('/auth/info');
};
