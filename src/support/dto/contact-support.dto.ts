import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Priority } from './schedule-meeting.dto';

export class ContactSupportDto {
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
}

