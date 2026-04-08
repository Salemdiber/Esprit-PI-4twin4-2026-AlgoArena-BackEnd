import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  roomId: string;

  @IsString()
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsMongoId()
  replyTo?: string;
}
