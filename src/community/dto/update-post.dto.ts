import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdatePostDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(5000)
  content?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsString()
  @IsOptional()
  @IsIn(['bug', 'algorithm', 'help', 'optimization'])
  problemType?: string;

  @IsBoolean()
  @IsOptional()
  solved?: boolean;

  @IsBoolean()
  @IsOptional()
  pinned?: boolean;
}
