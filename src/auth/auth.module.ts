import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { RolesGuard } from './roles.guard';
import { SpeedChallengeGuard } from './speed-challenge.guard';
import { RecaptchaService } from './recaptcha.service';
import { EmailService } from './email.service';
import { EmailDeliverabilityService } from './email-deliverability.service';
import { SettingsModule } from '../settings/settings.module';
import { CacheModule } from '../cache/cache.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtSecret =
          configService.get<string>('JWT_SECRET') || 'defaultJwtSecret';
        return {
          secret: jwtSecret,
          signOptions: { expiresIn: '1h' },
        };
      },
    }),
    UserModule,
    SettingsModule,
    CacheModule,
    AiModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    GithubStrategy,
    RolesGuard,
    SpeedChallengeGuard,
    RecaptchaService,
    EmailService,
    EmailDeliverabilityService,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
