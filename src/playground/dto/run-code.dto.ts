import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RunCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  language: string;

  @IsString()
  @IsOptional()
  input?: string;

  @IsString()
  @IsOptional()
  challengeId?: string;
}
