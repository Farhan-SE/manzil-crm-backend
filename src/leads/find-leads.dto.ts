import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export const LEAD_TABS = ['all', 'new', 'watchlist'] as const;
export type LeadTab = (typeof LEAD_TABS)[number];

export class StarLeadDto {
    @IsBoolean()
    is_starred: boolean;
}

export class FindLeadsDto {
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

    @IsOptional()
    @IsString()
    search?: string;

    /** `new` = no follow-up logged yet, `watchlist` = starred. */
    @IsOptional()
    @IsIn(LEAD_TABS)
    tab?: LeadTab;

    /** Direction of the lead ID ordering. */
    @IsOptional()
    @IsIn(['asc', 'desc'])
    sort?: 'asc' | 'desc';

    @IsOptional()
    @IsString()
    stage?: string;

    @IsOptional()
    @IsString()
    temperature?: string;

    @IsOptional()
    @IsUUID()
    interest_id?: string;

    @IsOptional()
    @IsUUID()
    category_id?: string;

    @IsOptional()
    @IsUUID()
    source_id?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    assigned_to_id?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    budget_min?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    budget_max?: number;
}
