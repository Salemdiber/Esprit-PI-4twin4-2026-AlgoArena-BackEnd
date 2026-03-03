import { IsString, IsNotEmpty, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ChallengeType, Difficulty } from '../challenge.enums';

export class CreateChallengeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(ChallengeType)
  type: ChallengeType;

  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxScore: number;
}
