import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';
import { DUE_WINDOWS, type DueWindow } from '../follow-ups/due-windows.js';

export const LEAD_TABS = ['all', 'new', 'recommended', 'watchlist'] as const;
export type LeadTab = (typeof LEAD_TABS)[number];

export const LEAD_SEARCH_FIELDS = ['lead_id', 'name', 'number', 'city'] as const;
export type LeadSearchField = (typeof LEAD_SEARCH_FIELDS)[number];

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

    /** Limits `search` to one field. Without it every searchable field is matched. */
    @IsOptional()
    @IsIn(LEAD_SEARCH_FIELDS)
    search_by?: LeadSearchField;

    @IsOptional()
    @IsUUID()
    project_id?: string;

    /** Leads with an open task due in this window. */
    @IsOptional()
    @IsIn(DUE_WINDOWS)
    task_due?: DueWindow;

    /** Leads whose most recent task is of this type. */
    @IsOptional()
    @IsString()
    last_task?: string;

    @IsOptional()
    @IsIn(['true', 'false'])
    starred?: string;

    /** `new` = no follow-up logged yet, `recommended` = hot and still open, `watchlist` = starred. */
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

/** Filters for the pipeline board. Unlike the list it has no paging: each stage returns its first few deals. */
export class FindPipelineDto {
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    assigned_to_id?: number;

    /** The month the lead came in, as YYYY-MM. */
    @IsOptional()
    @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period must be in YYYY-MM format' })
    period?: string;

    /** The assigned staff member's region. */
    @IsOptional()
    @IsString()
    region?: string;

    /** Only the caller's own leads. */
    @IsOptional()
    @IsIn(['true', 'false'])
    mine?: string;

    @IsOptional()
    @IsIn(['true', 'false'])
    starred?: string;

    /** `recent` = newest lead first, `value` = largest budget first. */
    @IsOptional()
    @IsIn(['recent', 'value'])
    sort?: 'recent' | 'value';

    /** How many deals to return for each stage. */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(500)
    per_stage?: number;
}
