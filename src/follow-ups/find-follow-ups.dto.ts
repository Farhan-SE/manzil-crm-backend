import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export const FOLLOW_UP_STATUSES = ['upcoming', 'overdue', 'completed'] as const;

export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export class FindFollowUpsDto {
    @IsOptional()
    @IsUUID()
    lead_id?: string;

    @IsOptional()
    @IsIn(FOLLOW_UP_STATUSES)
    status?: FollowUpStatus;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    assigned_to_id?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number;
}
