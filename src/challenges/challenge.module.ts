import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Challenge, ChallengeSchema } from './schemas/challenge.schema';
import { ChallengeController } from './challenge.controller';
import { ChallengeService } from './challenge.service';
import { AuditLogModule } from '../audit-logs/audit-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Challenge.name, schema: ChallengeSchema },
    ]),
    AuditLogModule,
  ],
  controllers: [ChallengeController],
  providers: [ChallengeService],
  exports: [ChallengeService],
})
export class ChallengeModule {}
