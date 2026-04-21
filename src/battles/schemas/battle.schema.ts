import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BattleStatus, BattleType, BotDifficulty } from '../battle.enums';

export type BattleDocument = Battle & Document;

@Schema({ _id: false })
export class PvpRoundResult {
  @Prop({ required: true })
  roundIndex: number;

  @Prop({ required: true })
  userId: string;

  @Prop({ type: Object, required: true })
  result: Record<string, any>;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

const PvpRoundResultSchema = SchemaFactory.createForClass(PvpRoundResult);

@Schema({ timestamps: true })
export class Battle {
  @Prop({ required: true, index: true })
  idBattle: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ default: null })
  opponentId: string;

  @Prop({ required: true })
  roundNumber: number;

  @Prop({ required: true, enum: BattleStatus, default: BattleStatus.PENDING })
  battleStatus: BattleStatus;

  @Prop({ required: true })
  challengeId: string;

  @Prop({ required: true })
  selectChallengeType: string;

  @Prop({ required: true, enum: BotDifficulty, default: BotDifficulty.MEDIUM })
  botDifficulty: BotDifficulty;

  @Prop({ default: null })
  winnerUserId: string;

  @Prop({ type: Date, default: Date.now })
  startedAt: Date;

  @Prop({ type: Date })
  endedAt: Date;

  @Prop({ required: true, enum: BattleType })
  battleType: BattleType;

  @Prop({ type: [PvpRoundResultSchema], default: [] })
  pvpRoundResults: PvpRoundResult[];
}

export const BattleSchema = SchemaFactory.createForClass(Battle);
