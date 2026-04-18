import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SupportCategory } from '../enums/support-category.enum';
import { SupportStatus } from '../enums/support-status.enum';

export type SupportRequestDocument = HydratedDocument<SupportRequest>;

@Schema({ _id: false })
class MeetingDetails {
  @Prop({ type: Date })
  preferredDate?: Date;
  @Prop()
  preferredTimeSlot?: string;
  @Prop()
  timezone?: string;
  @Prop()
  meetingType?: string;
  @Prop({ type: Date, default: null })
  alternativeDate?: Date | null;
  @Prop({ type: Date, default: null })
  confirmedAt?: Date | null;
  @Prop({ type: String, default: null })
  meetingLink?: string | null;
}

@Schema({ _id: false })
class BugDetails {
  @Prop() pageUrl?: string;
  @Prop() browserInfo?: string;
  @Prop() operatingSystem?: string;
  @Prop() severity?: string;
  @Prop() reproducible?: boolean;
  @Prop() stepsToReproduce?: string;
  @Prop() expectedBehavior?: string;
  @Prop() actualBehavior?: string;
  @Prop({
    type: {
      route: { type: String },
      fullUrl: { type: String },
      device: {
        browser: { type: String },
        os: { type: String },
        userAgent: { type: String },
      },
      viewport: {
        width: { type: Number },
        height: { type: Number },
        pixelRatio: { type: Number },
      },
      locale: { type: String },
      timezone: { type: String },
      buildVersion: { type: String },
      featureFlags: [{ type: String }],
      consoleErrors: [
        {
          message: { type: String },
          source: { type: String },
          line: { type: Number },
          col: { type: Number },
          timestamp: { type: Number },
        },
      ],
      networkFailures: [
        {
          url: { type: String },
          method: { type: String },
          status: { type: Number },
          timestamp: { type: Number },
        },
      ],
      clientTimestamp: { type: Number },
      sessionId: { type: String },
    },
    default: null,
  })
  reproductionBundle?: {
    route?: string;
    fullUrl?: string;
    device?: { browser?: string; os?: string; userAgent?: string };
    viewport?: { width?: number; height?: number; pixelRatio?: number };
    locale?: string;
    timezone?: string;
    buildVersion?: string;
    featureFlags?: string[];
    consoleErrors?: Array<{ message: string; source?: string; line?: number; col?: number; timestamp: number }>;
    networkFailures?: Array<{ url: string; method: string; status: number; timestamp: number }>;
    clientTimestamp?: number;
    sessionId?: string;
  } | null;
}

@Schema({ timestamps: true })
export class SupportRequest {
  @Prop({ enum: Object.values(SupportCategory), required: true })
  category: SupportCategory;

  @Prop({ enum: Object.values(SupportStatus), default: SupportStatus.PENDING })
  status: SupportStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true }) userEmail: string;
  @Prop({ required: true }) userName: string;
  @Prop({ required: true, maxlength: 200 }) subject: string;
  @Prop({ required: true, maxlength: 3000 }) description: string;
  @Prop({ enum: ['low', 'medium', 'high'], required: true }) priority: string;
  @Prop({ type: [String], default: [] }) attachmentUrls: string[];
  @Prop({ type: MeetingDetails, default: null }) meetingDetails: MeetingDetails | null;
  @Prop({ type: BugDetails, default: null }) bugDetails: BugDetails | null;
  @Prop({ type: Date, default: null }) resolvedAt: Date | null;
  @Prop({ required: true, unique: true }) referenceNumber: string;
}

export const SupportRequestSchema = SchemaFactory.createForClass(SupportRequest);
SupportRequestSchema.index({ userId: 1, category: 1, status: 1, createdAt: -1 });

