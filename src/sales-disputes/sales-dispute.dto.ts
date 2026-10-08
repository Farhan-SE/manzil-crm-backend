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
import { DISPUTE_CATEGORIES, DISPUTE_STATUSES } from './sales-dispute.entity.js';

export const DISPUTE_TABS = ['all', 'open', 'under_review', 'escalated', 'resolved'] as const;
export type DisputeTab = (typeof DISPUTE_TABS)[number];

export class CreateSalesDisputeDto {
    @IsUUID()
    lead_id: string;

    @IsIn(DISPUTE_CATEGORIES)
    category: string;

    @IsNotEmpty()
    subject: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    requested_resolution?: string;

    @IsOptional()
    @IsInt()
    review_owner_id?: number;

    @IsOptional()
    @IsDateString()
    resolution_due?: string;
}

export class FindSalesDisputesDto {
    /** Matches the case number, its subject or the client's name. */
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    review_owner_id?: number;

    /** One exact status, on top of whichever tab is showing. */
    @IsOptional()
    @IsIn(DISPUTE_STATUSES)
    status?: string;

    @IsOptional()
    @IsDateString()
    created_from?: string;

    @IsOptional()
    @IsDateString()
    created_to?: string;

    @IsOptional()
    @IsIn(DISPUTE_TABS)
    tab?: DisputeTab;

    @IsOptional()
    @IsIn(['true', 'false'])
    starred?: string;

    /** Direction of the case number ordering. */
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

export class SetDisputeStatusDto {
    @IsIn(DISPUTE_STATUSES)
    status: string;
}

export class StarDisputeDto {
    @IsBoolean()
    is_starred: boolean;
}
