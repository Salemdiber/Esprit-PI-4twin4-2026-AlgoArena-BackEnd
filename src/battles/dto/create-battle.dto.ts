import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { BattleStatus, BattleType, BotDifficulty } from '../battle.enums';

export class CreateBattleDto {
  @IsString()
  @IsOptional()
  idBattle?: string;

  @IsString()
  userId: string;

  @IsString()
  @IsOptional()
  opponentId?: string;

  @IsNumber()
  roundNumber: number;

  @IsEnum(BattleStatus)
  @IsOptional()
  battleStatus?: BattleStatus;

  @IsString()
  challengeId: string;

  @IsString()
  selectChallengeType: string;

  @IsEnum(BotDifficulty)
  @IsOptional()
  botDifficulty?: BotDifficulty;

  @IsString()
  @IsOptional()
  winnerUserId?: string;

  @IsDateString()
  @IsOptional()
  startedAt?: string;

  @IsDateString()
  @IsOptional()
  endedAt?: string;

  @IsEnum(BattleType)
  battleType: BattleType;
}
