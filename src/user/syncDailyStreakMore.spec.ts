import { UserService } from './user.service';

describe('UserService.syncDailyStreak edge cases', () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  const mockUser = {
    _id: 'u1',
    lastLoginDate: yesterday.toISOString(),
    currentStreak: 1,
    longestStreak: 1,
    loginActivityDates: [new Date().toISOString().slice(0, 10)],
  };

  const mockModel: any = {
    findById: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(mockUser),
    findByIdAndUpdate: jest.fn().mockReturnThis(),
  };

  const svc: any = new (UserService as any)(mockModel, { translate: () => '' });

  it('increments streak when last login was yesterday', async () => {
    const res = await svc.syncDailyStreak('507f1f77bcf86cd799439011');
    expect(res.currentStreak).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.recentActivity)).toBe(true);
  });
});
