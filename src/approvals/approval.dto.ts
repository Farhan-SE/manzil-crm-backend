import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Min,
} from 'class-validator';
import { APPROVAL_DECISIONS, APPROVAL_PRIORITIES, APPROVAL_TYPES } from './approval.entity.js';

/** The `approved` tab also lists rejected requests: both are decided and closed. */
export const APPROVAL_TABS = ['pending', 'approved', 'returned'] as const;
export type ApprovalTab = (typeof APPROVAL_TABS)[number];

export class CreateApprovalDto {
    @IsIn(APPROVAL_TYPES)
    type: string;

    @IsNotEmpty()
    summary: string;

    @IsUUID()
    lead_id: string;

    @IsOptional()
    @IsIn(APPROVAL_PRIORITIES)
    priority?: string;

    @IsOptional()
    @IsDateString()
    due_date?: string;
}

export class FindApprovalsDto {
    @IsOptional()
    @IsIn(APPROVAL_TABS)
    tab?: ApprovalTab;

    @IsOptional()
    @IsIn(['true', 'false'])
    starred?: string;

    /** `asc` = oldest request first. */
    @IsOptional()
    @IsIn(['asc', 'desc'])
    sort?: 'asc' | 'desc';

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number;
}

export class DecideApprovalDto {
    @IsIn(APPROVAL_DECISIONS)
    decision: string;

    @IsOptional()
    @IsString()
    comment?: string;
}

export class StarApprovalDto {
    @IsBoolean()
    is_starred: boolean;
}
