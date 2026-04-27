import { UserService } from './user.service';

describe('UserService.updateXpAndRank', () => {
  const fakeUser = { _id: 'u1', xp: 100, rank: null };
  const mockModel: any = {
    findById: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(fakeUser),
    findByIdAndUpdate: jest.fn().mockReturnThis(),
  };

  const svc: any = new (UserService as any)(mockModel, { translate: () => '' });

  it('updates xp and returns rank change info', async () => {
    const res = await svc.updateXpAndRank('507f1f77bcf86cd799439011', 1000);
    expect(res.newXp).toBeGreaterThanOrEqual(0);
    expect(res.newRank).toBeDefined();
  });
});
