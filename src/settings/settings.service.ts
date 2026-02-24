import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(@InjectModel('Settings') private settingsModel: Model<any>) {}

  /** Seed default settings document if none exists */
  async onModuleInit() {
    const count = await this.settingsModel.countDocuments().exec();
    if (count === 0) {
      await this.settingsModel.create({});
    }
  }

  async getSettings() {
    const settings = await this.settingsModel.findOne().lean().exec();
    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto) {
    const settings = await this.settingsModel
      .findOneAndUpdate({}, { $set: dto }, { new: true })
      .lean()
      .exec();
    return settings;
  }
}
