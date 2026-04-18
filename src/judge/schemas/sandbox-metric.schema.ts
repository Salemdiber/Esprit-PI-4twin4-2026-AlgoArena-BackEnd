import { Schema } from 'mongoose';

export const SandboxMetricSchema = new Schema(
  {
    containerName: { type: String, required: true, index: true },
    containerId: { type: String, default: null },
    image: { type: String, default: null },
    status: { type: String, enum: ['success', 'failed'], required: true, index: true },
    startedAt: { type: Date, default: null, index: true },
    stoppedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
    peakCpuPercent: { type: Number, default: null },
    peakMemoryMb: { type: Number, default: null },
    statsSamplesCount: { type: Number, default: 0 },
    challengeId: { type: String, default: null, index: true },
    userId: { type: String, default: null, index: true },
  },
  {
    collection: 'sandbox_metrics',
    timestamps: true,
  },
);

SandboxMetricSchema.index({ createdAt: -1 });
