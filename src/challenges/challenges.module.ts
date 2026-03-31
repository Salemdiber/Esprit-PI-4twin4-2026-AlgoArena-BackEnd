
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChallengesService } from './challenges.service';
import { Challenge, ChallengeSchema } from './schemas/challenge.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Challenge.name, schema: ChallengeSchema }])],
  providers: [ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}

