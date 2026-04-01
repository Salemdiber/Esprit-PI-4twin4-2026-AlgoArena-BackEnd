import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ChallengeDocument = Challenge & Document;

@Schema({ timestamps: true })
export class Challenge {
    @Prop({ required: true })
    title: string;

    @Prop({ required: true, enum: ['Easy', 'Medium', 'Hard', 'Expert'] })
    difficulty: string;

    @Prop({ type: [String], default: [] })
    tags: string[];

    @Prop({ required: true })
    description: string;

    @Prop({ type: [String], default: [] })
    constraints: string[];

    @Prop({
        type: [{ input: String, output: String, explanation: String }],
        default: [],
    })
    examples: { input: string; output: string; explanation: string }[];

    @Prop({
        type: [{ input: String, output: String }],
        default: [],
    })
    testCases: { input: string; output: string }[];

    @Prop({ type: [String], default: [] })
    hints: string[];

    @Prop({ default: 50 })
    xpReward: number;

    @Prop({ default: 0 })
    acceptanceRate: number;

    @Prop({ default: 15 })
    estimatedTime: number;

    @Prop({ default: 0 })
    solvedCount: number;

    @Prop({ type: Object, default: {} })
    starterCode: Record<string, string>;

    @Prop({ default: false })
    aiGenerated: boolean;

    @Prop({ default: 'draft', enum: ['draft', 'published'] })
    status: string;

    @Prop()
    createdBy: string;
}

export const ChallengeSchema = SchemaFactory.createForClass(Challenge);

// Performance Indexes for backend querying
ChallengeSchema.index({ status: 1, difficulty: 1 });
ChallengeSchema.index({ tags: 1 });
ChallengeSchema.index({ createdAt: -1 });
ChallengeSchema.index({ title: 'text', description: 'text', tags: 'text' });
