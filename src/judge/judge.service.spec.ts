import { BadRequestException } from '@nestjs/common';
import { JudgeService } from './judge.service';

describe('JudgeService', () => {
  let svc: JudgeService;
  let docker: any;
  let ai: any;
  let mlComplexity: any;
  let challengeSvc: any;
  let userSvc: any;
  let audit: any;
  let i18n: any;

  beforeEach(() => {
    docker = { executeCode: jest.fn() };
    ai = { quickCodeCheck: jest.fn(), analyzeResults: jest.fn(), analyzeSubmissionDetails: jest.fn(), generateHint: jest.fn() };
    mlComplexity = { predict: jest.fn(), minConfidence: 0 };
    challengeSvc = { findById: jest.fn(), incrementSolvedCount: jest.fn() };
    userSvc = {
      findOne: jest.fn().mockResolvedValue(null),
      startChallengeAttempt: jest.fn(),
      leaveChallengeAttempt: jest.fn(),
      saveChallengeAttempt: jest.fn(),
      returnChallengeAttempt: jest.fn(),
      expireChallengeAttempt: jest.fn(),
      abandonChallengeAttempt: jest.fn(),
      getChallengeProgressEntry: jest.fn(),
      recordChallengeSubmission: jest.fn(),
      updateXpAndRank: jest.fn(),
      getChallengeProgress: jest.fn(),
      getChallengeProgressEntry: jest.fn(),
      consumeHintCredit: jest.fn(),
      expireChallengeAttempt: jest.fn(),
      getChallengeProgress: jest.fn(),
    };
    audit = { create: jest.fn() };
    i18n = { translate: jest.fn((k) => k) };

    svc = new JudgeService(docker, ai, mlComplexity, challengeSvc, userSvc, audit, i18n);
  });

  test('judgeSubmission: unsupported language throws', async () => {
    await expect(svc.judgeSubmission('u', 'c', 'code', 'ruby')).rejects.toThrow(BadRequestException);
  });

  test('judgeSubmission: missing challenge throws', async () => {
    challengeSvc.findById.mockResolvedValueOnce(null);
    await expect(svc.judgeSubmission('u', 'c', 'code', 'javascript')).rejects.toThrow(BadRequestException);
  });

  test('judgeSubmission: AI syntax error path returns error and records submission on submit', async () => {
    const ch = { _id: 'c', title: 'T', testCases: [{ input: '1', output: '2' }], xpReward: 10, difficulty: 'easy' };
    challengeSvc.findById.mockResolvedValueOnce(ch);
    userSvc.getChallengeProgressEntry.mockResolvedValueOnce(null);
    ai.quickCodeCheck.mockResolvedValueOnce({ hasSyntaxError: true, errorMessage: 'err', errorLine: 2 });
    userSvc.recordChallengeSubmission.mockResolvedValueOnce({ xpGranted: 0, progressEntry: {} });

    const res = await svc.judgeSubmission('u', 'c', 'bad', 'javascript', undefined, 'submit');
    expect(res.passed).toBe(false);
    expect(res.source).toBe('ai-syntax-check');
    expect(userSvc.recordChallengeSubmission).toHaveBeenCalled();
  });

  test('judgeSubmission: docker error path returns docker error and records submission on submit', async () => {
    const ch = { _id: 'c', title: 'T', testCases: [{ input: '1', output: '2' }], xpReward: 10, difficulty: 'easy' };
    challengeSvc.findById.mockResolvedValueOnce(ch);
    userSvc.getChallengeProgressEntry.mockResolvedValueOnce(null);
    ai.quickCodeCheck.mockResolvedValueOnce({ hasSyntaxError: false });
    docker.executeCode.mockResolvedValueOnce({ error: { message: 'runtime' }, results: [], executionTimeMs: 50 });
    userSvc.recordChallengeSubmission.mockResolvedValueOnce({ xpGranted: 0, progressEntry: {} });

    const res = await svc.judgeSubmission('u', 'c', 'code', 'javascript', undefined, 'submit');
    expect(res.passed).toBe(false);
    expect(res.source).toBe('docker');
    expect(userSvc.recordChallengeSubmission).toHaveBeenCalled();
  });

  test('judgeSubmission: success path grants xp and increments solvedCount', async () => {
    const ch = { _id: 'c', title: 'T', testCases: [{ input: '1', output: '2' }], xpReward: 10, difficulty: 'easy' };
    challengeSvc.findById.mockResolvedValueOnce(ch);
    userSvc.getChallengeProgressEntry.mockResolvedValueOnce(null);
    ai.quickCodeCheck.mockResolvedValueOnce({ hasSyntaxError: false });
    docker.executeCode.mockResolvedValueOnce({ error: null, results: [{ testCase: 0, passed: true, input: '1', output: '2', actualOutput: '2', executionTimeMs: 1 }], executionTimeMs: 10 });
    ai.analyzeResults.mockResolvedValueOnce('analysis');
    ai.analyzeSubmissionDetails.mockResolvedValueOnce({ timeComplexity: 'O(1)', codeQualityScore: 90, recommendations: [], aiDetection: 'MANUAL' });
    userSvc.recordChallengeSubmission.mockResolvedValueOnce({ xpGranted: 10, progressEntry: { wasReduced: false, totalElapsedTime: 5 } });

    const res = await svc.judgeSubmission('u', 'c', 'code', 'javascript', 12, 'submit');
    expect(res.passed).toBe(true);
    expect(res.xpGranted).toBe(10);
    expect(userSvc.updateXpAndRank).toHaveBeenCalledWith('u', 10);
    expect(challengeSvc.incrementSolvedCount).toHaveBeenCalledWith('c');
  });
});
