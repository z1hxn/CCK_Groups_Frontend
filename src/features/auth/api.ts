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
  const response = await fetch(`https://auth.cubingclub.com/api/auth/info/${encodeURIComponent(cckId.toLowerCase())}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch auth info (${response.status})`);
  }
  return (await response.json()) as AuthInfoResponse;
};
