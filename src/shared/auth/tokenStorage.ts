const ACCESS_TOKEN_KEY = 'access_token';
const AUTH_EVENT = 'auth-change';

type JwtPayload = Record<string, unknown>;

export type AuthUserProfile = {
  name: string;
  cckId: string;
  role?: string;
  position?: string;
};

const dispatchAuthChange = () => {
  window.dispatchEvent(new Event(AUTH_EVENT));
};

export const authChangeEvent = AUTH_EVENT;

export const setAccessToken = (token: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  dispatchAuthChange();
};

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY);

export const removeAccessToken = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  dispatchAuthChange();
};

const decodeBase64Url = (value: string): string | null => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  try {
    const binary = atob(padded);
    const percent = Array.from(binary)
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join('');
    return decodeURIComponent(percent);
  } catch {
    return null;
  }
};

const getPayload = (): JwtPayload | null => {
  const token = getAccessToken();
  if (!token) return null;

  const parts = token.split('.');
  const payloadRaw = parts.length >= 2 ? parts[1] : token;
  const decoded = decodeBase64Url(payloadRaw);
  if (!decoded) return null;

  try {
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
};

const pickString = (payload: JwtPayload, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

export const getAuthUserProfile = (): AuthUserProfile | null => {
  const payload = getPayload();
  if (!payload) return null;

  const name = pickString(payload, ['name', 'nickname', 'preferred_username', 'username']) ?? '사용자';
  const cckId = pickString(payload, ['cckId', 'memberId', 'id', 'sub']) ?? '';
  const role = pickString(payload, ['role', 'userRole', 'memberRole']);
  const position = pickString(payload, ['position']);

  return { name, cckId, role, position };
};

const getStringArray = (payload: JwtPayload, keys: string[]): string[] => {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
      return value
        .split(/[,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
};

export const isAdminByToken = (): boolean => {
  const payload = getPayload();
  if (!payload) return false;

  const candidates = [
    pickString(payload, ['position']),
    pickString(payload, ['role', 'userRole', 'memberRole']),
  ]
    .filter(Boolean)
    .map((item) => String(item).toUpperCase());

  const authorities = getStringArray(payload, ['authorities', 'roles', 'permissions']).map((item) =>
    item.toUpperCase(),
  );

  return [...candidates, ...authorities].some((item) => item.includes('ADMIN'));
};
