import { Schema } from 'mongoose';

export const SettingsSchema = new Schema(
  {
    platformName: { type: String, default: 'AlgoArena' },
    supportEmail: { type: String, default: 'support@algoarena.com' },
    userRegistration: { type: Boolean, default: true },
    aiBattles: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    ollamaEnabled: { type: Boolean, default: true },
    disableCopyPaste: { type: Boolean, default: false },
    disableTabSwitch: { type: Boolean, default: false },
    disableSpeedChallenges: { type: Boolean, default: false },
    apiRateLimit: { type: Number, default: 1000 },
    codeExecutionLimit: { type: Number, default: 100 },
  },
  { timestamps: true },
);
