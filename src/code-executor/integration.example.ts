import { Injectable, BadRequestException } from '@nestjs/common';
import { CodeExecutorService } from './code-executor.service';
import { PlagiarismDetectionService } from './plagiarism-detection.service';

/**
 * Integration Example: Speed Challenge Submission with Plagiarism Check
 * 
 * This shows how to integrate plagiarism detection into the speed challenge workflow
 */

export interface SpeedChallengeSubmission {
    userId: string;
    challengeId: string;
    code: string;
    language: 'javascript' | 'python';
    timestamp: Date;
}

export interface SubmissionResult {
    valid: boolean;
    testsPassed: number;
    totalTests: number;
    plagiarismCheck: {
        completed: boolean;
        suspicious: boolean;
        similarity: number;
        recommendation: 'clear' | 'review' | 'suspicious';
        details: string[];
    };
    message: string;
}

@Injectable()
export class SpeedChallengeIntegrationExample {
    constructor(
        private codeExecutor: CodeExecutorService,
        private plagiarismDetection: PlagiarismDetectionService,
    ) {}

    /**
     * Complete submission flow with code validation + plagiarism check
     */
    async submitSolution(
        submission: SpeedChallengeSubmission,
        testCases: Array<{ input: string; output: string }>,
        previousSubmissions: SpeedChallengeSubmission[],
    ): Promise<SubmissionResult> {
        try {
            // Step 1: Validate code executes correctly
            console.log(`✅ Step 1: Validating code for user ${submission.userId}...`);
            const validation = await this.codeExecutor.validateCode(
                submission.code,
                submission.language,
                testCases,
            );

            if (!validation.passed) {
                return {
                    valid: false,
                    testsPassed: validation.passedTests,
                    totalTests: validation.totalTests,
                    plagiarismCheck: {
                        completed: false,
                        suspicious: false,
                        similarity: 0,
                        recommendation: 'clear',
                        details: ['Code failed validation - not checking plagiarism'],
                    },
                    message: `❌ Code validation failed: ${validation.passedTests}/${validation.totalTests} tests passed`,
                };
            }

            // Step 2: Check plagiarism against previous submissions
            console.log(
                `🔍 Step 2: Checking plagiarism against ${previousSubmissions.length} previous submissions...`,
            );

            const plagiarismChecks = await Promise.all(
                previousSubmissions.map((prev) =>
                    this.plagiarismDetection
                        .detectPlagiarism(
                            submission.code,
                            prev.code,
                            submission.userId,
                        )
                        .then((result) => ({
                            vsUserId: prev.userId,
                            ...result,
                        })),
                ),
            );

            // Step 3: Analyze plagiarism results
            const suspiciousMatches = plagiarismChecks.filter(
                (check) => check.isSuspicious,
            );
            const highSimilarityMatches = plagiarismChecks.filter(
                (check) => check.overallSimilarity > 60,
            );

            const maxSimilarity =
                plagiarismChecks.length > 0
                    ? Math.max(...plagiarismChecks.map((c) => c.overallSimilarity))
                    : 0;

            const detailedReport = this.generateDetailedReport(
                suspiciousMatches,
                maxSimilarity,
            );

            return {
                valid: true,
                testsPassed: validation.passedTests,
                totalTests: validation.totalTests,
                plagiarismCheck: {
                    completed: true,
                    suspicious: suspiciousMatches.length > 0,
                    similarity: maxSimilarity,
                    recommendation:
                        suspiciousMatches.length > 0
                            ? 'suspicious'
                            : highSimilarityMatches.length > 0
                              ? 'review'
                              : 'clear',
                    details: detailedReport,
                },
                message:
                    suspiciousMatches.length > 0
                        ? `⚠️ ALERT: Possible plagiarism detected! (${suspiciousMatches.length} suspicious matches)`
                        : highSimilarityMatches.length > 0
                          ? `📋 Review: Code has similarities with ${highSimilarityMatches.length} submissions`
                          : `✅ Code is valid and original!`,
            };
        } catch (error) {
            throw new BadRequestException(
                `Submission processing error: ${error.message}`,
            );
        }
    }

    /**
     * Bulk check all submissions in a challenge for plagiarism
     * (Run after challenge ends)
     */
    async bulkCheckChallenge(
        challengeId: string,
        submissions: SpeedChallengeSubmission[],
    ): Promise<{
        totalSubmissions: number;
        suspiciousPairs: Array<{
            user1: string;
            user2: string;
            similarity: number;
            recommendation: string;
        }>;
        summary: string;
    }> {
        console.log(
            `🔍 Running bulk plagiarism check on ${submissions.length} submissions...`,
        );

        const suspiciousPairs: Array<{
            user1: string;
            user2: string;
            similarity: number;
            recommendation: 'clear' | 'review' | 'suspicious';
        }> = [];

        // Compare all pairs
        for (let i = 0; i < submissions.length; i++) {
            for (let j = i + 1; j < submissions.length; j++) {
                const result = await this.plagiarismDetection.detectPlagiarism(
                    submissions[i].code,
                    submissions[j].code,
                    submissions[i].userId,
                );

                if (result.isSuspicious || result.overallSimilarity > 60) {
                    suspiciousPairs.push({
                        user1: submissions[i].userId,
                        user2: submissions[j].userId,
                        similarity: result.overallSimilarity,
                        recommendation: result.recommendation,
                    });
                }
            }
        }

        // Sort by similarity
        suspiciousPairs.sort((a, b) => b.similarity - a.similarity);

        const suspiciousCount = suspiciousPairs.filter(
            (p) => p.recommendation === 'suspicious',
        ).length;
        const reviewCount = suspiciousPairs.filter(
            (p) => p.recommendation === 'review',
        ).length;

        return {
            totalSubmissions: submissions.length,
            suspiciousPairs,
            summary: `Challenge ${challengeId}: ${suspiciousCount} suspicious pairs, ${reviewCount} pairs needing review`,
        };
    }

    /**
     * Generate detailed report for a user
     */
    private generateDetailedReport(
        suspiciousMatches: any[],
        maxSimilarity: number,
    ): string[] {
        const report: string[] = [];

        if (suspiciousMatches.length === 0) {
            report.push(
                '✅ No suspicious plagiarism detected compared to previous submissions',
            );
            return report;
        }

        report.push(
            `⚠️ Found ${suspiciousMatches.length} suspicious match(es) with overall similarity ${maxSimilarity}%`,
        );

        suspiciousMatches.forEach((match, idx) => {
            report.push(
                `  ${idx + 1}. Comparison ${idx + 1}: ${match.overallSimilarity}% similar`,
            );
            report.push(`     Recommendation: ${match.recommendation}`);
            report.push(`     Details: ${match.details.join('; ')}`);
        });

        return report;
    }
}

/**
 * Example Usage:
 * 
 * Usage 1: Submit solution with plagiarism check
 * ============================================
 * const submission: SpeedChallengeSubmission = {
 *     userId: 'user123',
 *     challengeId: 'challenge456',
 *     code: `
 *         function solution(n) {
 *             let sum = 0;
 *             for (let i = 0; i < n; i++) {
 *                 sum += i;
 *             }
 *             return sum;
 *         }
 *     `,
 *     language: 'javascript',
 *     timestamp: new Date(),
 * };
 *
 * const testCases = [
 *     { input: '5', output: '10' },
 *     { input: '10', output: '45' },
 * ];
 *
 * const previousSubmissions = [
 *     // ... previous submissions from other users
 * ];
 *
 * const result = await integration.submitSolution(
 *     submission,
 *     testCases,
 *     previousSubmissions,
 * );
 *
 * console.log(result);
 * // Output:
 * // {
 * //   valid: true,
 * //   testsPassed: 2,
 * //   totalTests: 2,
 * //   plagiarismCheck: {
 * //     completed: true,
 * //     suspicious: false,
 * //     similarity: 28,
 * //     recommendation: 'clear',
 * //     details: ['✅ No suspicious plagiarism detected...']
 * //   },
 * //   message: '✅ Code is valid and original!'
 * // }
 *
 *
 * Usage 2: Bulk check after challenge ends
 * ========================================
 * const allSubmissions = [
 *     { userId: 'user1', code: '...', ... },
 *     { userId: 'user2', code: '...', ... },
 *     { userId: 'user3', code: '...', ... },
 * ];
 *
 * const bulkResult = await integration.bulkCheckChallenge(
 *     'challenge456',
 *     allSubmissions,
 * );
 *
 * console.log(bulkResult);
 * // Output:
 * // {
 * //   totalSubmissions: 3,
 * //   suspiciousPairs: [
 * //     {
 * //       user1: 'user1',
 * //       user2: 'user2',
 * //       similarity: 78,
 * //       recommendation: 'suspicious'
 * //     }
 * //   ],
 * //   summary: 'Challenge challenge456: 1 suspicious pairs, 0 pairs needing review'
 * // }
 */
