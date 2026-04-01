import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OnboardingModule } from './onboarding/onboarding.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemHealthModule } from './system-health/system-health.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SessionsModule } from './sessions/sessions.module';
import { SettingsModule } from './settings/settings.module';
import { AuditLogModule } from './audit-logs/audit-log.module';
import { AiModule } from './ai/ai.module';
import { ChallengeModule } from './challenges/challenge.module';
import { MaintenanceGuard } from './settings/guards/maintenance.guard';
import { ChallengesModule } from './challenges/challenges.module';
import { CacheModule } from './cache/cache.module';
import { BattlesModule } from './battles/battle.module';
import { JudgeModule } from './judge/judge.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/algoarena'),
    UserModule,
    AuthModule,
    SystemHealthModule,
    AnalyticsModule,
    SessionsModule,
    SettingsModule,
    OnboardingModule,
    AuditLogModule,
    ChallengesModule,
    BattlesModule,
    CacheModule,
    AiModule,
    ChallengeModule,
    JudgeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: MaintenanceGuard,
    },
  ],
})
export class AppModule {}
