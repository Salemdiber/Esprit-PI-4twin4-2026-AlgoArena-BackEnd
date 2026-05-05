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

  return origins.length > 0 ? origins : DEFAULT_ORIGINS.split(',');
}
