export const env = {
  API_URL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api',
  SSO_URL: import.meta.env.VITE_SSO_URL ?? 'http://localhost:8081',
  LOGIN_URL: import.meta.env.VITE_LOGIN_URL ?? 'http://localhost:8081/login',
} as const;

export const API_URL = env.API_URL;
export const SSO_URL = env.SSO_URL;
export const LOGIN_URL = env.LOGIN_URL;
