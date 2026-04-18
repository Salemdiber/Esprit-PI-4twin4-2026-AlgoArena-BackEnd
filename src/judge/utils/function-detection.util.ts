export type SupportedLanguage = 'javascript' | 'python';

const JS_PATTERNS = [
  /(?:^|\r?\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
  /(?:^|\r?\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b/g,
  /(?:^|\r?\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g,
];

const PY_PATTERN = /(?:^|\r?\n)\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

function findFirstMatch(code: string, patterns: RegExp[]): string | null {
  let earliest: { name: string; index: number } | null = null;

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(code);
    if (!match?.[1]) continue;
    const index = match.index ?? Number.MAX_SAFE_INTEGER;
    if (!earliest || index < earliest.index) {
      earliest = { name: match[1], index };
    }
  }

  return earliest?.name ?? null;
}

export function detectFunctionName(code: string, language: SupportedLanguage): string | null {
  if (!code?.trim()) return null;
  if (language === 'javascript') return findFirstMatch(code, JS_PATTERNS);
  return findFirstMatch(code, [PY_PATTERN]);
}
