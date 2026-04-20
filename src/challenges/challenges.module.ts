import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';
import { ChallengeAiDetectionController } from './challenge-ai-detection.controller';
import { ChallengeAiDetectionService } from './challenge-ai-detection.service';
import { Challenge, ChallengeSchema } from './schemas/challenge.schema';
import { UserModule } from '../user/user.module';
import { SpeedChallengeGuard } from '../auth/speed-challenge.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Challenge.name, schema: ChallengeSchema },
    ]),
    UserModule,
  ],
  controllers: [ChallengesController, ChallengeAiDetectionController],
  providers: [
    ChallengesService,
    SpeedChallengeGuard,
    ChallengeAiDetectionService,
  ],
  exports: [ChallengesService],
})
export class ChallengesModule {}
