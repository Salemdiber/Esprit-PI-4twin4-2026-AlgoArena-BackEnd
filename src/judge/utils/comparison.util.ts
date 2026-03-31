function normalizeForComparison(value: unknown): unknown {
  if (value === undefined) return '__undefined__';
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForComparison(item));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const normalized: Record<string, unknown> = {};
    for (const key of keys) {
      normalized[key] = normalizeForComparison(record[key]);
    }
    return normalized;
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForComparison(value));
}

export function isDeepEqual(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}
