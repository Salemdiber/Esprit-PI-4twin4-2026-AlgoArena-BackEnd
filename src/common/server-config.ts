const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173';

export function resolveAllowedOrigins(rawOrigins?: string): string[] {
  const fallbackOrigins = DEFAULT_FRONTEND_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origins = (rawOrigins ?? DEFAULT_FRONTEND_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : fallbackOrigins;
}
