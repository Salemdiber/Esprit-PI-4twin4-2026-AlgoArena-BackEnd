import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { CacheModule } from '../cache/cache.module';
import { JudgeModule } from '../judge/judge.module';

@Module({
  imports: [CacheModule, JudgeModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
