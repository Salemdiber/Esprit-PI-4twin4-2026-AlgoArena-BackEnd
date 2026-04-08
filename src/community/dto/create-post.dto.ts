import { IsNotEmpty, IsString, MaxLength, IsOptional, IsIn, IsArray } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  videoUrl?: string;

  @IsString()
  @IsOptional()
  @IsIn(['discussion', 'strategy', 'normal', 'problem'])
  type?: string = 'normal';

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsString()
  @IsOptional()
  @IsIn(['bug', 'algorithm', 'help', 'optimization'])
  problemType?: string;
}
