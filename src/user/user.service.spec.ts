import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UserService } from './user.service';

describe('UserService - speed challenge submissions', () => {
  const makeUserModel = (user: any) => {
    const findById = jest.fn(() => ({
      lean: () => ({
        exec: () => Promise.resolve(user),
      }),
    }));

    const findByIdAndUpdate = jest.fn(() => ({
      exec: () => Promise.resolve(null),
    }));

    return { findById, findByIdAndUpdate };
  };

  const makeI18n = () => ({
    translate: jest.fn((key: string) => key),
  });

  it('accepts a submission and stores it with solved status', async () => {
    const userId = new Types.ObjectId().toHexString();
    const challengeId = 'challenge-123';
    const user = { _id: userId, challengeProgress: [] };
    const userModel = makeUserModel(user);
    const service = new UserService(userModel as any, makeI18n() as any);

    const submission = {
      code: 'function solve() { return 42; }',
      passed: true,
      executionTimeMs: 1200,
    };

    const result = await service.recordChallengeSubmission(
      userId,
      challengeId,
      submission,
      { xpReward: 100, solveTimeSeconds: 90 },
    );

    expect(result.xpGranted).toBe(100);
    expect(result.progressEntry.status).toBe('SOLVED');
    expect(result.progressEntry.submissions).toHaveLength(1);
    expect(result.progressEntry.submissions[0].code).toBe(submission.code);
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid (empty) code submissions', async () => {
    const userId = new Types.ObjectId().toHexString();
    const challengeId = 'challenge-123';
    const user = { _id: userId, challengeProgress: [] };
    const userModel = makeUserModel(user);
    const service = new UserService(userModel as any, makeI18n() as any);

    await expect(
      service.recordChallengeSubmission(userId, challengeId, {
        code: '   ',
        passed: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('returns a failure result when the submission does not pass', async () => {
    const userId = new Types.ObjectId().toHexString();
    const challengeId = 'challenge-123';
    const user = {
      _id: userId,
      challengeProgress: [
        {
          challengeId,
          status: 'ATTEMPTED',
          failedAttempts: 1,
          totalElapsedTime: 10,
          submissions: [],
          mode: 'challenge',
        },
      ],
    };
    const userModel = makeUserModel(user);
    const service = new UserService(userModel as any, makeI18n() as any);

    const result = await service.recordChallengeSubmission(
      userId,
      challengeId,
      { code: 'console.log("oops")', passed: false },
      { solveTimeSeconds: 50 },
    );

    expect(result.xpGranted).toBe(0);
    expect(result.progressEntry.status).toBe('ATTEMPTED');
    expect(result.progressEntry.failedAttempts).toBe(2);
    expect(result.progressEntry.attemptStatus).toBe('in_progress');
    expect(result.progressEntry.savedCode).toBe('console.log("oops")');
  });
});
