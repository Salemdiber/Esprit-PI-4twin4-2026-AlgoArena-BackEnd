import { IsEnum } from 'class-validator';
import { SupportStatus } from '../enums/support-status.enum';

export class UpdateSupportStatusDto {
  @IsEnum(SupportStatus)
  status: SupportStatus;
}
