import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  platformName?: string;

  @IsOptional()
  @IsString()
  supportEmail?: string;

  @IsOptional()
  @IsBoolean()
  userRegistration?: boolean;

  @IsOptional()
  @IsBoolean()
  aiBattles?: boolean;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsBoolean()
  // Backwards-compatible flag name kept for DB schema; represents AI classification toggle
  ollamaEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  disableCopyPaste?: boolean;

  @IsOptional()
  @IsBoolean()
  disableTabSwitch?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  apiRateLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  codeExecutionLimit?: number;
}
