import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateSettingsDto {
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
  @IsNumber()
  @Min(1)
  apiRateLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  codeExecutionLimit?: number;
}
