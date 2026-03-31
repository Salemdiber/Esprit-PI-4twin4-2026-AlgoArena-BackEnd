
import { Module } from '@nestjs/common';
import { PlaygroundController } from './playground.controller';
import { PlaygroundService } from './playground.service';
import { ChallengesModule } from '../challenges/challenges.module';

@Module({
  imports: [ChallengesModule],
  controllers: [PlaygroundController],
  providers: [PlaygroundService],
})
export class PlaygroundModule {}

