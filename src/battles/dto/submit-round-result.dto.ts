import { IsInt, IsObject, Min } from 'class-validator';

export class SubmitRoundResultDto {
  @IsInt()
  @Min(0)
  roundIndex: number;

  @IsObject()
  result: Record<string, any>;
}
