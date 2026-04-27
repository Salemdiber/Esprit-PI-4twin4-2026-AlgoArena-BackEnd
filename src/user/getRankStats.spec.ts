import { UserService } from './user.service';

describe('UserService.getRankStats', () => {
  const fakeUser = { _id: 'u1', xp: 1500, currentStreak: 2 };
  const mockModel: any = {
    findById: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(fakeUser),
  };

  const svc: any = new (UserService as any)(mockModel, { translate: () => '' });

  it('returns rank stats for a user with xp', async () => {
    const stats = await svc.getRankStats('507f1f77bcf86cd799439011');
    expect(stats.totalXP).toBe(1500);
    expect(stats.rank).toBeDefined();
    expect(typeof stats.progressPercent).toBe('number');
  });
});
