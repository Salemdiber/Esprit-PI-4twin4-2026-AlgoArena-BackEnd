import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { SettingsModule } from '../settings/settings.module';
import { AiModule } from '../ai/ai.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [SettingsModule, AiModule, CacheModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
