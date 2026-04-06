import {
    IsString,
    IsIn,
    IsArray,
    IsOptional,
    IsNumber,
    IsBoolean,
    ValidateNested,
    Min,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class ExampleDto {
    @IsString() input: string;
    @IsString() output: string;
    @IsString() @IsOptional() explanation?: string;
}

class TestCaseDto {
    @IsString() input: string;
    @IsString() output: string;
}

export class CreateChallengeDto {
    @IsString()
    title: string;

    @IsString()
    @IsIn(['Easy', 'Medium', 'Hard', 'Expert'])
    difficulty: string;

    @IsArray()
    @IsString({ each: true })
    tags: string[];

    @IsString()
    description: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    constraints?: string[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ExampleDto)
    @IsOptional()
    examples?: ExampleDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TestCaseDto)
    @ArrayMinSize(1)
    testCases: TestCaseDto[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    hints?: string[];

    @IsNumber()
    @Min(0)
    @IsOptional()
    xpReward?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    estimatedTime?: number;

    @IsOptional()
    starterCode?: Record<string, string>;

    @IsBoolean()
    @IsOptional()
    aiGenerated?: boolean;

    @IsString()
    @IsIn(['draft', 'published'])
    @IsOptional()
    status?: string;

    @IsString()
    @IsIn(['challenge', 'practice', 'contest'])
    @IsOptional()
    mode?: string;
}
