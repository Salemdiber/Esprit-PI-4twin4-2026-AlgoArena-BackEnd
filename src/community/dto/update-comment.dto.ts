import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(1500)
  text?: string;
}
