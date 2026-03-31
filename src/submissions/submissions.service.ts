import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CodeExecutorService } from '../code-executor/code-executor.service';
import { Challenge } from '../challenges/schemas/challenge.schema';

@Injectable()
export class SubmissionsService {
    constructor(
        @InjectModel('User') private userModel: Model<any>,
        @InjectModel(Challenge.name) private challengeModel: Model<Challenge>,
        private codeExecutorService: CodeExecutorService,
    ) {}

    async runCode(code: string, language: string, challengeId: string, isSubmit: boolean, userId?: string) {
        const challenge = await this.challengeModel.findById(challengeId);
        if (!challenge) throw new NotFoundException('Challenge not found');

        // Extract test cases
        const testCases = challenge.examples || [];
        if (testCases.length === 0) {
            throw new Error('This challenge has no test cases configured.');
        }

        const start = Date.now();
        // Use the code execution engine
        const validationResult = await this.codeExecutorService.validateCode(code, language, testCases);
        const executionTime = Date.now() - start;

        // If it's a full submission and all tests passed, update user score
        if (isSubmit && validationResult.passed && userId) {
            const user = await this.userModel.findById(userId);
            if (user) {
                // Award points (we use an arbitrary 100 points, or challenge.xp if we implement it)
                const points = 100;
                user.xp = (user.xp || 0) + points;
                await user.save();
            }
        }

        return {
            success: validationResult.passed,
            output: validationResult.executionLog || 'Code executed successfully.',
            testResults: validationResult.results,
            executionTime,
            passedTests: validationResult.passedTests,
            totalTests: validationResult.totalTests,
        };
    }

    async getLeaderboard() {
        // Fetch top 100 users ordered by xp descending (could add tie-breakers)
        const users = await this.userModel.find({}, 'username xp email streak avatar')
            .sort({ xp: -1 })
            .limit(100)
            .exec();
        
        return users.map((u, i) => ({
            rank: i + 1,
            _id: u._id,
            username: u.username || u.email,
            xp: u.xp || 0,
            streak: u.streak || 0,
            avatar: u.avatar
        }));
    }
}
