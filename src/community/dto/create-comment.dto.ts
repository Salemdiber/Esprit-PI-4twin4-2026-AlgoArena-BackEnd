import { IsNotEmpty, IsString, MaxLength, IsOptional, IsIn } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  text: string;

  @IsString()
  @IsOptional()
  @IsIn(['discussion', 'strategy'])
  type?: string = 'discussion';
}
