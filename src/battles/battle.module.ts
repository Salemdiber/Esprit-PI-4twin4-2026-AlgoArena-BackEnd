import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BattlesController } from './battle.controller';
import { BattlesService } from './battle.service';
import { BattleAiService } from './battle-ai.service';
import { Battle, BattleSchema } from './schemas/battle.schema';
import {
  BattleHistory,
  BattleHistorySchema,
} from './schemas/battle-history.schema';
import { ChallengeModule } from '../challenges/challenge.module';
import { JudgeModule } from '../judge/judge.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Battle.name, schema: BattleSchema },
      { name: BattleHistory.name, schema: BattleHistorySchema },
    ]),
    ChallengeModule,
    JudgeModule,
  ],
  controllers: [BattlesController],
  providers: [BattlesService, BattleAiService],
  exports: [BattlesService],
})
export class BattlesModule {}
