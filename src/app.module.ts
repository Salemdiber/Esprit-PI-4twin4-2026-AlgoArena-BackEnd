import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/algoarena'),
    MailerModule.forRoot({
      transport: (() => {
        const host = process.env.SMTP_HOST || process.env.MAILTRAP_HOST;
        const port = Number(process.env.SMTP_PORT || process.env.MAILTRAP_PORT || 2525);
        const secure = (process.env.SMTP_SECURE ?? 'false') === 'true' || port === 465;
        const user = process.env.SMTP_USER || process.env.MAILTRAP_USER;
        const pass = process.env.SMTP_PASS || process.env.MAILTRAP_PASS;

        return {
          host,
          port,
          secure,
          auth: user && pass ? { user, pass } : undefined,
        };
      })(),
    }),
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
