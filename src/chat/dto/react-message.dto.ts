import { IsMongoId, IsString } from 'class-validator';

export class ReactMessageDto {
  @IsMongoId()
  messageId: string;

  @IsString()
  emoji: string;
}
