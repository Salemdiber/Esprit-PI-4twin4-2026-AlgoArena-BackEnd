export const PASSWORD_SECURITY_MESSAGE =
  'Password cannot contain your username or email for security reasons';

const MIN_TOKEN_LENGTH = 3;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function toAlphaNumeric(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function collectSensitiveTokens(username: string, email: string): string[] {
  const normalizedUsername = normalize(username);
  const normalizedEmail = normalize(email);

  const [emailLocalPart = '', emailDomain = ''] = normalizedEmail.split('@');
  const domainName = emailDomain.split('.')[0] ?? '';

  const candidateTokens = new Set<string>([
    normalizedUsername,
    toAlphaNumeric(normalizedUsername),
    normalizedEmail,
    emailLocalPart,
    toAlphaNumeric(emailLocalPart),
    emailDomain,
    domainName,
    toAlphaNumeric(normalizedEmail),
  ]);

  for (const part of normalizedUsername.split(/[^a-z0-9]+/g)) {
    candidateTokens.add(part);
  }
  for (const part of normalizedEmail.split(/[^a-z0-9]+/g)) {
    candidateTokens.add(part);
  }

  return [...candidateTokens].filter((token) => token.length >= MIN_TOKEN_LENGTH);
}

export function passwordContainsIdentityData(
  password: string,
  username: string,
  email: string,
): boolean {
  const normalizedPassword = normalize(password);
  const passwordAlphaNumeric = toAlphaNumeric(password);
  const sensitiveTokens = collectSensitiveTokens(username, email);

  return sensitiveTokens.some(
    (token) =>
      normalizedPassword.includes(token) ||
      (passwordAlphaNumeric.includes(toAlphaNumeric(token)) && toAlphaNumeric(token).length >= MIN_TOKEN_LENGTH),
  );
}
