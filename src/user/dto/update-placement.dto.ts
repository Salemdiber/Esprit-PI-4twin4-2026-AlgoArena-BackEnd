import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum PlayerRank {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND',
}

export class UpdatePlacementDto {
  @IsEnum(PlayerRank)
  rank: PlayerRank;

  @IsInt()
  @Min(0)
  xp: number;

  @IsOptional()
  @IsString()
  level?: string;
}
