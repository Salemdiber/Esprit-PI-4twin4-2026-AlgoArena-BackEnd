import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiAgentsController } from './ai-agents.controller';
import { AiAgentsService } from './ai-agents.service';
import { UserSchema } from '../user/schemas/user.schema';
import { ChallengeSchema } from '../challenges/schemas/challenge.schema';
import { Battle, BattleSchema } from '../battles/schemas/battle.schema';
import { CommunityPostSchema } from '../community/schemas/community-post.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Challenge', schema: ChallengeSchema },
      { name: Battle.name, schema: BattleSchema },
      { name: 'CommunityPost', schema: CommunityPostSchema },
    ]),
  ],
  controllers: [AiAgentsController],
  providers: [AiAgentsService],
})
export class AiAgentsModule {}
