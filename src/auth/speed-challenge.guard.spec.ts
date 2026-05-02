import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { SpeedChallengeGuard } from './speed-challenge.guard';

describe('SpeedChallengeGuard', () => {
  const makeContext = (user: any) => ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  });

  let users: any;
  let i18n: any;
  let guard: SpeedChallengeGuard;

  beforeEach(() => {
    users = { hasCompletedSpeedChallenge: jest.fn() };
    i18n = { translate: jest.fn((key) => key) };
    guard = new SpeedChallengeGuard(users, i18n);
  });

  it('rejects requests without a user or token payload', async () => {
    await expect(guard.canActivate(makeContext(null) as any)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(makeContext({}) as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows access when the user already completed the speed challenge', async () => {
    users.hasCompletedSpeedChallenge.mockResolvedValue(true);

    await expect(guard.canActivate(makeContext({ sub: 'user-1' }) as any)).resolves.toBe(true);
    expect(users.hasCompletedSpeedChallenge).toHaveBeenCalledWith('user-1');
  });

  it('blocks users who have not completed the speed challenge', async () => {
    users.hasCompletedSpeedChallenge.mockResolvedValue(false);

    await expect(guard.canActivate(makeContext({ userId: 'user-2' }) as any)).rejects.toBeInstanceOf(ForbiddenException);
  });
});