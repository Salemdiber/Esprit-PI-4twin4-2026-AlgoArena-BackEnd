import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BattlesController } from './battle.controller';
import { BattlesService } from './battle.service';
import { Battle, BattleSchema } from './schemas/battle.schema';
import { BattleHistory, BattleHistorySchema } from './schemas/battle-history.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Battle.name, schema: BattleSchema },
      { name: BattleHistory.name, schema: BattleHistorySchema },
    ]),
  ],
  controllers: [BattlesController],
  providers: [BattlesService],
  exports: [BattlesService],
})
export class BattlesModule {}
