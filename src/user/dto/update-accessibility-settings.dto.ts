import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateAccessibilitySettingsDto {
  @IsOptional()
  @IsBoolean()
  highContrast?: boolean;

  @IsOptional()
  @IsBoolean()
  reducedMotion?: boolean;

  @IsOptional()
  @IsBoolean()
  dyslexiaFont?: boolean;

  @IsOptional()
  @IsIn(['small', 'medium', 'large'])
  fontScale?: 'small' | 'medium' | 'large';

  @IsOptional()
  @IsBoolean()
  voiceMode?: boolean;

  @IsOptional()
  @IsBoolean()
  voiceCommandsEnabled?: boolean;
}