import { IsOptional, IsString, IsEnum, IsObject } from 'class-validator';

export class CreateAuditLogDto {
    @IsString()
    actionType: string;

    @IsString()
    actor: string;

    @IsOptional()
    @IsString()
    actorId?: string;

    @IsString()
    entityType: string;

    @IsOptional()
    @IsString()
    targetId?: string;

    @IsOptional()
    @IsString()
    targetLabel?: string;

    @IsOptional()
    @IsObject()
    previousState?: Record<string, any>;

    @IsOptional()
    @IsObject()
    newState?: Record<string, any>;

    @IsString()
    description: string;

    @IsOptional()
    @IsEnum(['active', 'confirmed', 'rolled_back', 'pending'])
    status?: string;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}
