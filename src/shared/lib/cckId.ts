export const normalizeCckId = (value: string | null | undefined): string =>
  String(value ?? '').trim().toUpperCase();

