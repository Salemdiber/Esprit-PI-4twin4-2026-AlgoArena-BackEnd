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
    // normalize SMTP host to avoid sandbox.* DNS issues
    MailerModule.forRoot({
      transport: (() => {
        let host = process.env.SMTP_HOST || process.env.MAILTRAP_HOST || 'smtp.mailtrap.io';
        if (host && host.startsWith('sandbox.')) host = host.replace('sandbox.', '');
        const port = Number(process.env.SMTP_PORT || process.env.MAILTRAP_PORT || 2525);
        const user = process.env.SMTP_USER || process.env.MAILTRAP_USER || '758cf6d1025805';
        const pass = process.env.SMTP_PASS || process.env.MAILTRAP_PASS || '9ea78c0bf11184';
        return { host, port, auth: { user, pass } };
      })(),
    }),
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
