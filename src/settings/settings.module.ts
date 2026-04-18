import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SettingsSchema } from './schemas/settings.schema';
import { AuditLogModule } from '../audit-logs/audit-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Settings', schema: SettingsSchema }]),
    AuditLogModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
