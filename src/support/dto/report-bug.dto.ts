import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Priority } from './schedule-meeting.dto';

export enum BugSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export class ReportBugDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  description: string;

  @IsEnum(Priority)
  priority: Priority;

  @IsEnum(BugSeverity)
  severity: BugSeverity;

  @IsString()
  @IsNotEmpty()
  pageUrl: string;

  @IsString()
  @IsNotEmpty()
  browserInfo: string;

  @IsString()
  @IsNotEmpty()
  operatingSystem: string;

  @IsBoolean()
  reproducible: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  stepsToReproduce: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  expectedBehavior?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  actualBehavior?: string;

  @IsOptional()
  @IsObject()
  reproductionBundle?: Record<string, unknown>;
}
