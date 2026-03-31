import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ValidateCodeDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    code: string;

    @IsString()
    @IsNotEmpty()
    language: string;
}
