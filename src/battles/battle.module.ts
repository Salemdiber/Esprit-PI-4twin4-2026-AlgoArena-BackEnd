import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { BattlesController } from './battle.controller';
import { BattlesService } from './battle.service';
import { BattleAiService } from './battle-ai.service';
import { BattleGateway } from './battle.gateway';
import { Battle, BattleSchema } from './schemas/battle.schema';
import {
  BattleHistory,
  BattleHistorySchema,
} from './schemas/battle-history.schema';
import { UserSchema } from '../user/schemas/user.schema';
import { ChallengeModule } from '../challenges/challenge.module';
import { JudgeModule } from '../judge/judge.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Battle.name, schema: BattleSchema },
      { name: BattleHistory.name, schema: BattleHistorySchema },
      { name: 'User', schema: UserSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'defaultJwtSecret',
    }),
    ChallengeModule,
    JudgeModule,
  ],
  controllers: [BattlesController],
  providers: [BattlesService, BattleAiService, BattleGateway],
  exports: [BattlesService],
})
export class BattlesModule {}
