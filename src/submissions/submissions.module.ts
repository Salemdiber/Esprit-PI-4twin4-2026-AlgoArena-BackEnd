import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { CodeExecutorModule } from '../code-executor/code-executor.module';
import { ChallengeSchema } from '../challenges/schemas/challenge.schema';
import { UserSchema } from '../user/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
        { name: 'Challenge', schema: ChallengeSchema },
        { name: 'User', schema: UserSchema },
    ]),
    CodeExecutorModule,
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
