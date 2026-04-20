import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MeetingTimeSlot } from '../enums/meeting-time-slot.enum';

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum MeetingType {
  VIDEO_CALL = 'video_call',
  VOICE_CALL = 'voice_call',
  CHAT_SESSION = 'chat_session',
}

export class ScheduleMeetingDto {
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

  @IsDateString()
  preferredDate: string;

  @IsEnum(MeetingTimeSlot)
  preferredTimeSlot: MeetingTimeSlot;

  @IsString()
  @IsNotEmpty()
  timezone: string;

  @IsEnum(MeetingType)
  meetingType: MeetingType;

  @IsOptional()
  @IsDateString()
  alternativeDate?: string;
}
