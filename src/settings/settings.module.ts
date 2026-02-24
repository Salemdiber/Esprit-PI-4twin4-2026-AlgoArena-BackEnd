import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SettingsSchema } from './schemas/settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Settings', schema: SettingsSchema }]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
