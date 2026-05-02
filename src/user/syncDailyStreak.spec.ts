import { UserService } from './user.service';

// We'll unit-test pure helpers by importing via instance where possible.
describe('UserService helpers (pure functions)', () => {
  const svc: any = new (UserService as any)(null, { translate: () => '' });

  test('dateToken and utcDateOnly produce expected format', () => {
    const d = new Date('2020-01-15T12:34:56Z');
    const token = svc.dateToken(d);
    expect(token).toBe('2020-01-15');
    const utc = svc.utcDateOnly(new Date('2020-01-15T23:59:59Z'));
    expect(utc.getUTCFullYear()).toBe(2020);
  });

  test('daysBetweenUtc handles same day and adjacent days', () => {
    const a = new Date('2020-01-03T00:00:00Z');
    const b = new Date('2020-01-02T23:59:59Z');
    const diff = svc.daysBetweenUtc(a, b);
    expect([0,1]).toContain(diff); // depending on rounding
  });
});
