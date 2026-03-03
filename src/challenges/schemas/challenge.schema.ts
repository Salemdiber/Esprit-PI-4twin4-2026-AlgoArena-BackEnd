import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ChallengeType, Difficulty } from '../challenge.enums';

@Schema({ timestamps: true })
export class Challenge {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, enum: ChallengeType })
  type: ChallengeType;

  @Prop({ required: true, enum: Difficulty })
  difficulty: Difficulty;

  @Prop({ required: true })
  maxScore: number;
}

export type ChallengeDocument = Challenge & Document;
export const ChallengeSchema = SchemaFactory.createForClass(Challenge);
