const DEFAULT_FRONTEND_URL = 'https://algoarenatn.vercel.app';
const DEV_FRONTEND_URL = 'http://localhost:5173';

export function resolveFrontendUrl(envValue?: string | null): string {
  const raw = (envValue ?? '').trim().replace(/\/+$/, '');
  if (raw) return raw;
  return process.env.NODE_ENV === 'production'
    ? DEFAULT_FRONTEND_URL
    : DEV_FRONTEND_URL;
}

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://esprit-pi-4twin4-2026-algoarena-backend.onrender.com',
  'https://algoarenatn.vercel.app',
].join(',');

export function resolveAllowedOrigins(rawOrigins?: string): string[] {
  const raw = rawOrigins?.trim() ? rawOrigins : DEFAULT_ORIGINS;

  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const result = origins.length > 0 ? origins : DEFAULT_ORIGINS.split(',');

  // If '*' is present but there are also specific origins, remove '*'
  // to avoid credentials + wildcard conflict. If '*' is the only entry,
  // replace it with all known defaults so the dynamic origin callback
  // in main.ts can still match any request origin.
  if (result.includes('*')) {
    const withoutWildcard = result.filter((o) => o !== '*');
    return withoutWildcard.length > 0
      ? withoutWildcard
      : DEFAULT_ORIGINS.split(',');
  }

  return result;
}
