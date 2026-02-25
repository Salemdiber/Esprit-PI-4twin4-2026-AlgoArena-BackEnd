import { Schema } from 'mongoose';

export const SettingsSchema = new Schema(
  {
    userRegistration: { type: Boolean, default: true },
    aiBattles: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    apiRateLimit: { type: Number, default: 1000 },
    codeExecutionLimit: { type: Number, default: 100 },
  },
  { timestamps: true },
);
