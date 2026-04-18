import { IsOptional, IsNumber, IsArray, IsObject, IsString, IsEnum } from 'class-validator';

export class SaveSpeedTestSessionDto {
  @IsEnum(['INTRO', 'CHALLENGE', 'RESULT'])
  phase: string;

  @IsNumber()
  @IsOptional()
  secondsLeft?: number;

  @IsNumber()
  @IsOptional()
  currentIndex?: number;

  @IsArray()
  @IsOptional()
  solvedIds?: string[];

  @IsObject()
  @IsOptional()
  codes?: Record<string, Record<string, string>>;

  @IsObject()
  @IsOptional()
  languages?: Record<string, string>;

  @IsNumber()
  @IsOptional()
  elapsedSeconds?: number;
}
