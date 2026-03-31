import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BattleHistoryDocument = BattleHistory & Document;

@Schema({ timestamps: true })
export class BattleHistory {
  @Prop({ required: true })
  historyId: string;

  @Prop({ required: true })
  battleId: string;

  @Prop({ required: true })
  roundNumber: number;

  @Prop({ required: true })
  userId: string;

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;
}

export const BattleHistorySchema = SchemaFactory.createForClass(BattleHistory);
