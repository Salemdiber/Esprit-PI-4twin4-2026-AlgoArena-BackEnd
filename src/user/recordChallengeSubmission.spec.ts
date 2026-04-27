import { UserService } from './user.service';

describe('recordChallengeSubmission logic (unit-ish)', () => {
  const mockModel: any = {
    findById: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue({}),
    findByIdAndUpdate: jest.fn().mockReturnThis(),
  };
  const svc: any = new (UserService as any)(mockModel, { translate: () => '' });

  test('recordChallengeSubmission rejects empty code', async () => {
    await expect(
      svc.recordChallengeSubmission('507f1f77bcf86cd799439011', 'c1', { code: '' }, {}),
    ).rejects.toThrow();
  });
});
