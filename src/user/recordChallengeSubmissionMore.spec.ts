import { UserService } from './user.service';

describe('UserService.recordChallengeSubmission deeper', () => {
  const baseEntry = {
    challengeProgress: [],
  };

  const mockModel: any = {
    findById: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(baseEntry),
    findByIdAndUpdate: jest.fn().mockReturnThis(),
  };

  const svc: any = new (UserService as any)(mockModel, { translate: () => '' });

  it('handles passed submission and grants xp', async () => {
    const submission = { code: 'x', passed: true };
    const res = await svc.recordChallengeSubmission('507f1f77bcf86cd799439011', 'c1', submission, { xpReward: 100 });
    expect(res).toHaveProperty('progressEntry');
    expect(typeof res.xpGranted).toBe('number');
  });
});
