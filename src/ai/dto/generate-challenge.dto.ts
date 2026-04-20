import {
  IsString,
  IsIn,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';

export const ALLOWED_DIFFICULTIES = [
  'Easy',
  'Medium',
  'Hard',
  'Expert',
] as const;
export const ALLOWED_TOPICS = [
  'Arrays',
  'Strings',
  'Hash Table',
  'Dynamic Programming',
  'Graphs',
  'Trees',
] as const;

export class GenerateChallengeDto {
  @IsString()
  @MinLength(10, { message: 'Description must be at least 10 characters' })
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description: string;

  @IsString()
  @IsIn(ALLOWED_DIFFICULTIES, {
    message: `Difficulty must be one of: ${ALLOWED_DIFFICULTIES.join(', ')}`,
  })
  difficulty: (typeof ALLOWED_DIFFICULTIES)[number];

  @IsString()
  @IsIn(ALLOWED_TOPICS, {
    message: `Topic must be one of: ${ALLOWED_TOPICS.join(', ')}`,
  })
  topic: (typeof ALLOWED_TOPICS)[number];

  @IsInt({ message: 'testCases must be an integer' })
  @Min(1, { message: 'At least 1 test case is required' })
  @Max(10, { message: 'Maximum 10 test cases allowed' })
  testCases: number;
}
