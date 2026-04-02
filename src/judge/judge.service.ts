import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DockerExecutionService } from './services/docker-execution.service';
import { AIAnalysisService } from './services/ai-analysis.service';
import { ChallengeService } from '../challenges/challenge.service';
import { UserService } from '../user/user.service';
import { AuditLogService } from '../audit-logs/audit-log.service';

@Injectable()
export class JudgeService {
  private readonly logger = new Logger(JudgeService.name);

  constructor(
    private readonly dockerService: DockerExecutionService,
    private readonly aiService: AIAnalysisService,
    private readonly challengeService: ChallengeService,
    private readonly userService: UserService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async startChallengeAttempt(userId: string, challengeId: string, ipAddress?: string | null) {
    const challenge = await this.challengeService.findById(challengeId);
    const userProfile: any = await this.userService.findOne(userId).catch(() => null);
    const actorName = userProfile?.username || `user:${userId}`;

    const attempt = await this.userService.startChallengeAttempt(userId, challengeId);
    await this.auditLogService.create({
      actionType: 'CHALLENGE_STARTED',
      actor: actorName,
      actorId: userId,
      entityType: 'challenge',
      targetId: challengeId,
      targetLabel: challenge.title,
      description: `${actorName} started challenge "${challenge.title}" (${challenge.difficulty})`,
      status: 'active',
      metadata: {
        difficulty: challenge.difficulty,
        ipAddress: ipAddress || null,
        attemptId: attempt.attemptId,
      },
    });
    return attempt;
  }

  async leaveChallengeAttempt(
    userId: string,
    challengeId: string,
    reason: 'left_page' | 'tab_closed' = 'left_page',
    ipAddress?: string | null,
  ) {
    const challenge = await this.challengeService.findById(challengeId);
    const userProfile: any = await this.userService.findOne(userId).catch(() => null);
    const actorName = userProfile?.username || `user:${userId}`;

    const result = await this.userService.leaveChallengeAttempt(userId, challengeId, reason);
    await this.auditLogService.create({
      actionType: 'CHALLENGE_ABANDONED',
      actor: actorName,
      actorId: userId,
      entityType: 'challenge',
      targetId: challengeId,
      targetLabel: challenge.title,
      description: `${actorName} left challenge "${challenge.title}" and entered grace period`,
      status: 'active',
      metadata: {
        difficulty: challenge.difficulty,
        ipAddress: ipAddress || null,
        reason,
        gracePeriodExpiresAt: result.gracePeriodExpiresAt,
      },
    });
    return result;
  }

  async returnChallengeAttempt(userId: string, challengeId: string, ipAddress?: string | null) {
    const challenge = await this.challengeService.findById(challengeId).catch(() => null);
    const userProfile: any = await this.userService.findOne(userId).catch(() => null);
    const actorName = userProfile?.username || `user:${userId}`;

    const result = await this.userService.returnChallengeAttempt(userId, challengeId);
    if (challenge) {
      await this.auditLogService.create({
        actionType: result.allowed ? 'CHALLENGE_STARTED' : 'CHALLENGE_ABANDONED',
        actor: actorName,
        actorId: userId,
        entityType: 'challenge',
        targetId: challengeId,
        targetLabel: challenge.title,
        description: result.allowed
          ? `${actorName} returned to challenge "${challenge.title}" within grace period`
          : `${actorName} failed to return to challenge "${challenge.title}" before grace period expiration`,
        status: 'active',
        metadata: {
          difficulty: challenge.difficulty,
          ipAddress: ipAddress || null,
          allowed: result.allowed,
          remainingTime: result.remainingTime,
          status: result.status,
        },
      });
    }

    return {
      ...result,
      remainingSeconds: Number(result?.remainingTime || 0),
    };
  }

  async expireChallengeAttempt(userId: string, challengeId: string) {
    return this.userService.expireChallengeAttempt(userId, challengeId);
  }

  async abandonChallengeAttempt(
    userId: string,
    challengeId: string,
    reason: 'timeout' | 'left_page' | 'tab_closed' = 'timeout',
    ipAddress?: string | null,
  ) {
    const challenge = await this.challengeService.findById(challengeId).catch(() => null);
    const userProfile: any = await this.userService.findOne(userId).catch(() => null);
    const actorName = userProfile?.username || `user:${userId}`;
    const result = await this.userService.abandonChallengeAttempt(userId, challengeId, reason);

    if (challenge) {
      await this.auditLogService.create({
        actionType: 'CHALLENGE_ABANDONED',
        actor: actorName,
        actorId: userId,
        entityType: 'challenge',
        targetId: challengeId,
        targetLabel: challenge.title,
        description: `${actorName} abandoned challenge "${challenge.title}" (${challenge.difficulty})`,
        status: 'active',
        metadata: {
          difficulty: challenge.difficulty,
          reason,
          ipAddress: ipAddress || null,
        },
      });
    }
    return result;
  }

  async judgeSubmission(
    userId: string,
    challengeId: string,
    userCode: string,
    language: string,
    solveTimeSeconds?: number,
    mode: 'run' | 'submit' = 'submit',
    ipAddress?: string | null,
  ) {
    const startedAt = Date.now();
    if (language !== 'javascript' && language !== 'python') {
      throw new BadRequestException("Unsupported language. Only 'javascript' and 'python' are allowed.");
    }

    const challenge = await this.challengeService.findById(challengeId);
    if (!challenge) {
      throw new BadRequestException("Challenge not found.");
    }
    const existingProgress = await this.userService.getChallengeProgressEntry(userId, challengeId);
    if (mode === 'submit' && existingProgress?.status === 'SOLVED') {
      const successful = (existingProgress.submissions || []).filter((submission: any) => submission.passed);
      const latest = successful[successful.length - 1] || null;
      return {
        success: true,
        passed: true,
        alreadySolved: true,
        message: 'Challenge already solved. Resubmission is disabled.',
        previousSubmission: latest,
        solveTimeSeconds: existingProgress.solveTimeSeconds ?? null,
      };
    }

    const userProfile: any = await this.userService.findOne(userId).catch(() => null);
    const actorName = userProfile?.username || `user:${userId}`;

    const testCases = challenge.testCases.map(tc => ({
      input: tc.input,
      expectedOutput: tc.output,
    }));

    this.logger.debug(`Judging challenge "${challenge.title}" with ${testCases.length} test cases, language=${language}`);
    this.logger.debug(`Test cases: ${JSON.stringify(testCases)}`);

    // AI fast check for syntax and signature
    const aiCheck = await this.aiService.quickCodeCheck(userCode, language, challenge.title, challenge.description || '');
    if (aiCheck.hasSyntaxError) {
      const submissionDetails = {
        submittedAt: new Date(),
        language,
        code: userCode,
        passed: false,
        passedCount: 0,
        total: testCases.length,
        executionTime: '0ms',
        executionTimeMs: 0,
        memoryAllocated: 'Not available',
        loadTime: `${Date.now() - startedAt}ms`,
        timeComplexity: 'Unknown',
        spaceComplexity: 'Unknown',
        aiDetection: 'MANUAL',
        recommendations: [],
        aiAnalysis: 'Syntax error prevented execution. Please fix and try again.',
        results: [],
        error: {
          type: "SyntaxError",
          message: aiCheck.errorMessage || "Syntax Error detected.",
          line: aiCheck.errorLine
        },
        source: 'ai-syntax-check',
      };
      if (mode === 'submit') {
        await this.userService.recordChallengeSubmission(userId, challengeId, submissionDetails, {
          xpReward: Number(challenge.xpReward || 0),
          solveTimeSeconds: solveTimeSeconds ?? null,
        });
        await this.auditLogService.create({
          actionType: 'CHALLENGE_SUBMITTED',
          actor: actorName,
          actorId: userId,
          entityType: 'challenge',
          targetId: challengeId,
          targetLabel: challenge.title,
          description: `${actorName} submitted an incorrect solution for "${challenge.title}" (${challenge.difficulty})`,
          status: 'active',
          metadata: {
            difficulty: challenge.difficulty,
            passed: false,
            solveTimeSeconds: solveTimeSeconds ?? null,
            ipAddress: ipAddress || null,
            passedCount: 0,
            total: testCases.length,
          },
        });
      }
      return {
        success: false,
        passed: false,
        passedCount: 0,
        total: testCases.length,
        results: [],
        error: {
          type: "SyntaxError",
          message: aiCheck.errorMessage || "Syntax Error detected.",
          line: aiCheck.errorLine
        },
        aiAnalysis: "Syntax error prevented execution. Please fix and try again.",
        source: "ai-syntax-check",
        executionTime: "0ms",
        submissionDetails,
      };
    }

    // Docker Execution
    const dockerResult = await this.dockerService.executeCode(
      userCode,
      language as 'javascript'|'python',
      testCases,
      {
        challengeTitle: challenge.title,
        challengeDescription: challenge.description || '',
        challengeId,
        userId,
      },
    );

    this.logger.debug(`Docker result: error=${JSON.stringify(dockerResult.error)}, resultCount=${dockerResult.results.length}`);

    if (dockerResult.error) {
      const submissionDetails = {
        submittedAt: new Date(),
        language,
        code: userCode,
        passed: false,
        passedCount: 0,
        total: testCases.length,
        executionTime: `${dockerResult.executionTimeMs}ms`,
        executionTimeMs: dockerResult.executionTimeMs,
        memoryAllocated: 'Not available',
        loadTime: `${Date.now() - startedAt}ms`,
        timeComplexity: 'Unknown',
        spaceComplexity: 'Unknown',
        aiDetection: 'MANUAL',
        recommendations: [],
        aiAnalysis: "A runtime error prevented completion. Review the error message.",
        results: [],
        error: dockerResult.error,
        source: 'docker',
      };
      if (mode === 'submit') {
        await this.userService.recordChallengeSubmission(userId, challengeId, submissionDetails, {
          xpReward: Number(challenge.xpReward || 0),
          solveTimeSeconds: solveTimeSeconds ?? null,
        });
        await this.auditLogService.create({
          actionType: 'CHALLENGE_SUBMITTED',
          actor: actorName,
          actorId: userId,
          entityType: 'challenge',
          targetId: challengeId,
          targetLabel: challenge.title,
          description: `${actorName} submitted an incorrect solution for "${challenge.title}" (${challenge.difficulty})`,
          status: 'active',
          metadata: {
            difficulty: challenge.difficulty,
            passed: false,
            solveTimeSeconds: solveTimeSeconds ?? null,
            ipAddress: ipAddress || null,
            passedCount: 0,
            total: testCases.length,
          },
        });
      }
      return {
        success: false,
        passed: false,
        passedCount: 0,
        total: testCases.length,
        results: [],
        error: dockerResult.error,
        aiAnalysis: "A runtime error prevented completion. Review the error message.",
        source: "docker",
        executionTime: `${dockerResult.executionTimeMs}ms`,
        submissionDetails,
      };
    }

    // Keep full result data for the frontend (input, expected, actual, etc.)
    const results = dockerResult.results.map(r => ({
      testCase: r.testCase,
      input: r.input,
      expected: r.expected ?? r.expectedOutput,
      output: r.output ?? r.actualOutput ?? r.got,
      got: r.got ?? r.actualOutput ?? r.output,
      expectedOutput: r.expectedOutput ?? r.expected,
      actualOutput: r.actualOutput ?? r.got ?? r.output,
      passed: r.passed,
      error: r.error,
      executionTime: r.executionTime ?? `${r.executionTimeMs ?? 0}ms`,
      executionTimeMs: r.executionTimeMs ?? 0,
      source: 'docker',
    }));

    const passedCount = results.filter(r => r.passed).length;
    const allPassed = passedCount === testCases.length;

    this.logger.debug(`Results: ${passedCount}/${testCases.length} passed`);
    for (const r of results) {
      this.logger.debug(`  TC${r.testCase}: passed=${r.passed}, expected=${JSON.stringify(r.expected)}, got=${JSON.stringify(r.got)}, error=${r.error}`);
    }

    // AI Analysis
    const aiAnalysis = await this.aiService.analyzeResults(
      userCode,
      language,
      challenge.title,
      challenge.description || '',
      results
    );
    const details = await this.aiService.analyzeSubmissionDetails(
      userCode,
      language,
      challenge.title,
      challenge.description || '',
      results,
    );
    const solveSecondsValue = Number.isFinite(solveTimeSeconds as number)
      ? Math.max(0, Number(solveTimeSeconds))
      : null;
    const submissionDetails = {
      submittedAt: new Date(),
      language,
      code: userCode,
      passed: allPassed,
      passedCount,
      total: testCases.length,
      executionTime: `${dockerResult.executionTimeMs}ms`,
      executionTimeMs: dockerResult.executionTimeMs,
      memoryAllocated: 'Not available',
      loadTime: `${Date.now() - startedAt}ms`,
      timeComplexity: details.timeComplexity || 'Unknown',
      spaceComplexity: details.spaceComplexity || 'Unknown',
      aiDetection: details.aiDetection || 'MANUAL',
      recommendations: details.recommendations || [],
      aiAnalysis,
      results,
      error: null,
      source: 'docker',
      solveTimeSeconds: solveSecondsValue,
    };
    let xpGranted = 0;
    if (mode === 'submit') {
      const persisted = await this.userService.recordChallengeSubmission(userId, challengeId, submissionDetails, {
        xpReward: Number(challenge.xpReward || 0),
        solveTimeSeconds: solveSecondsValue,
      });
      xpGranted = persisted.xpGranted;

      await this.auditLogService.create({
        actionType: 'CHALLENGE_SUBMITTED',
        actor: actorName,
        actorId: userId,
        entityType: 'challenge',
        targetId: challengeId,
        targetLabel: challenge.title,
        description: `${actorName} submitted a ${allPassed ? 'correct' : 'incorrect'} solution for "${challenge.title}" (${challenge.difficulty})`,
        status: 'active',
        metadata: {
          difficulty: challenge.difficulty,
          passed: allPassed,
          solveTimeSeconds: solveSecondsValue,
          ipAddress: ipAddress || null,
          passedCount,
          total: testCases.length,
          executionTime: `${dockerResult.executionTimeMs}ms`,
        },
      });

      if (allPassed && persisted.xpGranted > 0) {
        await this.userService.updateXpAndRank(userId, persisted.xpGranted);
        await this.challengeService.incrementSolvedCount(challengeId);
        await this.auditLogService.create({
          actionType: 'CHALLENGE_SOLVED',
          actor: actorName,
          actorId: userId,
          entityType: 'challenge',
          targetId: challengeId,
          targetLabel: challenge.title,
          description: `${actorName} solved "${challenge.title}" (${challenge.difficulty})${solveSecondsValue != null ? ` in ${solveSecondsValue}s` : ''}`,
          status: 'active',
          metadata: {
            difficulty: challenge.difficulty,
            solveTimeSeconds: solveSecondsValue,
            xpGranted: persisted.xpGranted,
            ipAddress: ipAddress || null,
            executionTime: `${dockerResult.executionTimeMs}ms`,
          },
        });
      }
    }

    return {
      success: allPassed,
      passed: allPassed,
      passedCount,
      total: testCases.length,
      results,
      error: null,
      aiAnalysis,
      source: "docker",
      executionTime: `${dockerResult.executionTimeMs}ms`,
      submissionDetails,
      solveTimeSeconds: solveSecondsValue,
      xpGranted,
      mode,
    };
  }

  async getHint(challengeId: string, attemptCount: number, elapsedTimeSeconds: number) {
    const challenge = await this.challengeService.findById(challengeId);
    if (!challenge) {
      throw new BadRequestException("Challenge not found.");
    }

    const isUnlocked = attemptCount >= 3 || elapsedTimeSeconds >= 300;
    
    if (!isUnlocked) {
      return { unlocked: false, hint: null };
    }

    let hintLevel = 1;
    if (attemptCount >= 5 || elapsedTimeSeconds >= 600) hintLevel = 2;
    if (attemptCount >= 7 || elapsedTimeSeconds >= 900) hintLevel = 3;

    const hint = await this.aiService.generateHint(challenge.title, challenge.description || '', hintLevel);

    return { unlocked: true, hint };
  }

  async getUserChallengeProgress(userId: string) {
    const progress = await this.userService.getChallengeProgress(userId);
    return {
      progress: progress.map((entry: any) => ({
        challengeId: entry.challengeId,
        status: entry.status || 'UNSOLVED',
        failedAttempts: Number(entry.failedAttempts || 0),
        solveTimeSeconds: entry.solveTimeSeconds ?? null,
        xpAwarded: Number(entry.xpAwarded || 0),
        solvedAt: entry.solvedAt || null,
        attemptId: entry.attemptId || null,
        attemptStatus: entry.attemptStatus || 'completed',
        attemptStartedAt: entry.attemptStartedAt || null,
        leftAt: entry.leftAt || null,
        gracePeriodExpiresAt: entry.gracePeriodExpiresAt || null,
        returnedAt: entry.returnedAt || null,
        abandonmentReason: entry.abandonmentReason || null,
        incompleteAttemptCount: Number(entry.incompleteAttemptCount || 0),
        latestSubmission: Array.isArray(entry.submissions) && entry.submissions.length
          ? entry.submissions[entry.submissions.length - 1]
          : null,
        latestSuccessfulSubmission: Array.isArray(entry.submissions)
          ? [...entry.submissions].reverse().find((submission: any) => submission.passed) || null
          : null,
      })),
    };
  }

  async getChallengeProgress(
    userId: string,
    challengeId: string,
    ipAddress?: string | null,
    logStart = false,
  ) {
    await this.userService.expireChallengeAttempt(userId, challengeId);
    const challenge = await this.challengeService.findById(challengeId).catch(() => null);
    const userProfile: any = await this.userService.findOne(userId).catch(() => null);
    const actorName = userProfile?.username || `user:${userId}`;
    if (logStart && challenge) {
      await this.auditLogService.create({
        actionType: 'CHALLENGE_STARTED',
        actor: actorName,
        actorId: userId,
        entityType: 'challenge',
        targetId: challengeId,
        targetLabel: challenge.title,
        description: `${actorName} started challenge "${challenge.title}" (${challenge.difficulty})`,
        status: 'active',
        metadata: {
          difficulty: challenge.difficulty,
          ipAddress: ipAddress || null,
        },
      });
    }

    const entry = await this.userService.getChallengeProgressEntry(userId, challengeId);
    if (!entry) {
      return {
        challengeId,
        status: 'UNSOLVED',
        failedAttempts: 0,
        solveTimeSeconds: null,
        xpAwarded: 0,
        solvedAt: null,
        submissions: [],
      };
    }

    return {
      challengeId,
      status: entry.status || 'UNSOLVED',
      failedAttempts: Number(entry.failedAttempts || 0),
      solveTimeSeconds: entry.solveTimeSeconds ?? null,
      xpAwarded: Number(entry.xpAwarded || 0),
      solvedAt: entry.solvedAt || null,
      attemptId: entry.attemptId || null,
      attemptStatus: entry.attemptStatus || 'completed',
      attemptStartedAt: entry.attemptStartedAt || null,
      leftAt: entry.leftAt || null,
      gracePeriodExpiresAt: entry.gracePeriodExpiresAt || null,
      returnedAt: entry.returnedAt || null,
      abandonmentReason: entry.abandonmentReason || null,
      incompleteAttemptCount: Number(entry.incompleteAttemptCount || 0),
      submissions: Array.isArray(entry.submissions) ? entry.submissions : [],
    };
  }
}
