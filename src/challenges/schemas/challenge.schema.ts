import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Challenge extends Document {
    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    description: string;

    @Prop({ type: [Object], default: [] })
    examples: { input: string; output: string }[];

    @Prop({ type: Object, default: {} })
    starterCode: { [key: string]: string };

    @Prop({ type: [String], default: ["javascript"] })
    languages: string[];

    @Prop({ type: String, enum: ['draft', 'published'], default: 'draft' })
    status: string;
}

export const ChallengeSchema = SchemaFactory.createForClass(Challenge);
