import { BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';

describe('UserService.recordChallengeSubmission (simple)', () => {
  let service: UserService;
  const mockModel: any = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn().mockImplementation(() => ({ exec: async () => ({}) })),
    create: jest.fn(),
    find: jest.fn(),
  };
  const mockI18n: any = { translate: (k: string) => k };

  beforeEach(() => {
    mockModel.findById.mockReset();
    mockModel.findByIdAndUpdate.mockClear();
    service = new UserService(mockModel as any, mockI18n as any);
  });

  it('throws BadRequestException when submission code is empty (failure case)', async () => {
    await expect(
      service.recordChallengeSubmission('000000000000000000000000', 'c1', { code: '   ' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a simple valid submission for existing user (success case)', async () => {
    // mock a user record (mock mongoose chain .lean().exec())
    const userObj = {
      _id: '000000000000000000000000',
      challengeProgress: [],
      xp: 0,
    };
    mockModel.findById.mockImplementationOnce(() => ({
      lean: () => ({ exec: async () => userObj }),
    }));

    const result = await service.recordChallengeSubmission(
      '000000000000000000000000',
      'c1',
      { code: 'console.log(1);', passed: false },
      { xpReward: 0 },
    );

    expect(result).toBeDefined();
    expect(typeof result.xpGranted).toBe('number');
  });
});
