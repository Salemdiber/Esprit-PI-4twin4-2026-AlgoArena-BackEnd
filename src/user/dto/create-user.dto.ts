import { Role } from '../entities/user.entity';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  MinLength,
  IsUrl,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsUrl()
  avatar?: string | null;

  @IsOptional()
  @IsString()
  bio?: string | null;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}
