import { apiRequest } from '@/shared/api/client';
import { LOGIN_URL } from '@/shared/config';
import { removeAccessToken, setAccessToken } from '@/shared/auth/tokenStorage';

type TokenResponse = {
  access_token: string;
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
