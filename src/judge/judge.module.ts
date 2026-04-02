import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JudgeService } from './judge.service';
import { JudgeController } from './judge.controller';
import { ChallengeModule } from '../challenges/challenge.module';
import { DockerExecutionService } from './services/docker-execution.service';
import { AIAnalysisService } from './services/ai-analysis.service';
import { UserModule } from '../user/user.module';
import { AuditLogModule } from '../audit-logs/audit-log.module';
import { SandboxAdminController } from './sandbox-admin.controller';
import { SandboxMetricSchema } from './schemas/sandbox-metric.schema';
import { ChallengeAttemptController } from './challenge-attempt.controller';

@Module({
  imports: [
    ChallengeModule,
    UserModule,
    AuditLogModule,
    MongooseModule.forFeature([{ name: 'SandboxMetric', schema: SandboxMetricSchema }]),
  ],
  providers: [JudgeService, DockerExecutionService, AIAnalysisService],
  controllers: [JudgeController, SandboxAdminController, ChallengeAttemptController],
  exports: [JudgeService, DockerExecutionService],
})
export class JudgeModule {}
