import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import * as path from 'path';
import { existsSync } from 'fs';
import { I18nModule, AcceptLanguageResolver } from 'nestjs-i18n';
import { I18nJsonLoader } from 'nestjs-i18n/dist/loaders';
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
import { ChatModule } from './chat/chat.module';
import { SupportModule } from './support/support.module';
import { CommunityModule } from './community/community.module';
import { AiAgentsModule } from './ai-agents/ai-agents.module';
import { BillingModule } from './billing/billing.module';

const i18nPath = (() => {
  const distPath = path.join(__dirname, 'i18n');
  const srcPath = path.join(process.cwd(), 'src', 'i18n');
  const hasDistLocales =
    existsSync(path.join(distPath, 'en')) || existsSync(path.join(distPath, 'fr'));
  return hasDistLocales ? distPath : srcPath;
})();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(__dirname, '../.env.local'),
        path.resolve(__dirname, '../.env'),
        '.env.local',
        '.env',
      ],
      expandVariables: true,
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loader: I18nJsonLoader,
      loaderOptions: {
        path: i18nPath,
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [AcceptLanguageResolver],
    }),
    MongooseModule.forRoot(
      process.env.MONGO_URI || 'mongodb://localhost:27017/algoarena',
    ),
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
    ChatModule,
    SupportModule,
    CommunityModule,
    AiAgentsModule,
    BillingModule,
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
