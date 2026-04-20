/**
 * input-parser.util.ts
 *
 * Parses challenge test-case input strings into typed argument arrays.
 *
 * Supported input formats (all must produce the same result):
 *   - Named comma-separated:  "nums = [2,7,11,15], target = 9"
 *   - Space-separated:        "[2,7,11,15] 9"
 *   - Single value:           "\"babad\""  or  "123"
 *   - Already structured:     [already, an, array]
 */

// ─── Low-level helpers ────────────────────────────────────────────

function splitTopLevelByComma(source: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringQuote = char;
      current += char;
      continue;
    }

    if (char === '[' || char === '{' || char === '(') {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ']' || char === '}' || char === ')') {
      depth -= 1;
      current += char;
      continue;
    }

    if (char === ',' && depth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

/**
 * Splits a string into tokens at **top-level whitespace boundaries**.
 *
 * A "top-level" boundary is whitespace that occurs outside brackets, braces,
 * parentheses, and quoted strings.
 *
 * Examples:
 *   "[2,7,11,15] 9"          → ["[2,7,11,15]", "9"]
 *   "[-1,-2,-3,-4] -3"       → ["[-1,-2,-3,-4]", "-3"]
 *   '"babad"'                → ['"babad"']
 *   "123"                    → ["123"]
 *   '"abcde" "ace"'          → ['"abcde"', '"ace"']
 */
function splitTopLevelBySpace(source: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringQuote = char;
      current += char;
      continue;
    }

    if (char === '[' || char === '{' || char === '(') {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ']' || char === '}' || char === ')') {
      depth -= 1;
      current += char;
      continue;
    }

    // At depth 0 (outside brackets/strings), treat whitespace as a separator
    if ((char === ' ' || char === '\t') && depth === 0) {
      if (current.trim()) {
        tokens.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
}

function findTopLevelEquals(source: string): number {
  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === '[' || char === '{' || char === '(') {
      depth += 1;
      continue;
    }

    if (char === ']' || char === '}' || char === ')') {
      depth -= 1;
      continue;
    }

    if (char === '=' && depth === 0) {
      return i;
    }
  }

  return -1;
}

function convertSingleQuotedStrings(input: string): string {
  return input.replace(
    /'([^'\\]*(?:\\.[^'\\]*)*)'/g,
    (_match, content: string) => {
      const escaped = content.replace(/"/g, '\\"');
      return `"${escaped}"`;
    },
  );
}

function normalizeJsonLike(input: string): string {
  const withDoubleQuotes = convertSingleQuotedStrings(input);
  return withDoubleQuotes
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3');
}

function parsePrimitive(input: string): unknown {
  const value = input.trim();
  if (!value) return '';

  if (value.includes('->')) {
    const parts = value
      .split('->')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => parsePrimitive(part));
    if (parts.length > 0) return parts;
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value)) {
    return Number(value);
  }

  const lowered = value.toLowerCase();
  if (lowered === 'true') return true;
  if (lowered === 'false') return false;
  if (lowered === 'null' || lowered === 'none') return null;

  return value;
}

// ─── Public API ───────────────────────────────────────────────────

export function parseStructuredValue(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;

  const value = raw.trim();
  if (!value) return '';

  try {
    return JSON.parse(value);
  } catch {
    // Continue with tolerant parsing.
  }

  const normalized = normalizeJsonLike(value);
  try {
    return JSON.parse(normalized);
  } catch {
    // Continue with tolerant parsing.
  }

  if (value.startsWith('(') && value.endsWith(')')) {
    const tupleBody = value.slice(1, -1).trim();
    if (!tupleBody) return [];
    return splitTopLevelByComma(tupleBody).map((part) =>
      parseStructuredValue(part),
    );
  }

  return parsePrimitive(value);
}

/**
 * Parse a raw test-case input string into an array of typed arguments.
 *
 * Handles three input formats:
 *   1. Named comma-separated:   "nums = [2,7,11,15], target = 9"
 *   2. Space-separated values:  "[2,7,11,15] 9"
 *   3. Single raw value:        '"babad"'  or  "123"
 */
export function parseInputArguments(rawInput: unknown): unknown[] {
  if (Array.isArray(rawInput)) return rawInput;
  if (rawInput === null || rawInput === undefined) return [];

  if (typeof rawInput !== 'string') {
    return [rawInput];
  }

  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  // ── Strategy 1: Split by top-level commas ──────────────────────
  // This handles "nums = [2,7,11,15], target = 9" and "text1 = "abc", text2 = "def""
  const commaSegments = splitTopLevelByComma(trimmed);

  if (commaSegments.length > 1) {
    // Multiple comma-separated segments found – parse each one
    return commaSegments.map((segment) => {
      const equalsIndex = findTopLevelEquals(segment);
      const valuePortion =
        equalsIndex >= 0
          ? segment.slice(equalsIndex + 1).trim()
          : segment.trim();
      return parseStructuredValue(valuePortion);
    });
  }

  // ── Strategy 2: Single segment – try space-separated ───────────
  // This handles "[2,7,11,15] 9" and "[-1,-2,-3,-4] -3"
  const singleSegment = commaSegments[0] || trimmed;

  // Strip "name = " prefix if present (e.g., "s = \"babad\"")
  const equalsIndex = findTopLevelEquals(singleSegment);
  const valueOnly =
    equalsIndex >= 0
      ? singleSegment.slice(equalsIndex + 1).trim()
      : singleSegment.trim();

  // Try splitting by top-level spaces
  const spaceTokens = splitTopLevelBySpace(valueOnly);

  if (spaceTokens.length > 1) {
    // Multiple space-separated tokens found – parse each one as a separate argument
    return spaceTokens.map((token) => parseStructuredValue(token));
  }

  // ── Strategy 3: Single value ───────────────────────────────────
  // Just one value like "123", "[0,1]", '"babad"'
  return [parseStructuredValue(valueOnly)];
}

export function parseExpectedOutput(rawExpected: unknown): unknown {
  return parseStructuredValue(rawExpected);
}
