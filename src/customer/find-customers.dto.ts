import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { CUSTOMER_STAGES } from './customer.entity.js';

export class StarCustomerDto {
    @IsBoolean()
    is_starred: boolean;
}

export const CUSTOMER_SEARCH_FIELDS = ['cell', 'name', 'client_id', 'cnic'] as const;
export type CustomerSearchField = (typeof CUSTOMER_SEARCH_FIELDS)[number];

export class FindCustomersDto {
    @IsOptional()
    @IsString()
    search?: string;

    /** Limits `search` to one field. Without it every searchable field is matched. */
    @IsOptional()
    @IsIn(CUSTOMER_SEARCH_FIELDS)
    search_by?: CustomerSearchField;

    /** The day the client was added, as YYYY-MM-DD. */
    @IsOptional()
    @IsDateString()
    created_date?: string;

    /** Clients with at least one lead on this project. */
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @IsOptional()
    @IsIn(['true', 'false'])
    starred?: string;

    @IsOptional()
    @IsString()
    relation_type?: string;

    @IsOptional()
    @IsIn(CUSTOMER_STAGES)
    stage?: string;

    /** Direction of the client ID ordering. */
    @IsOptional()
    @IsIn(['asc', 'desc'])
    sort?: 'asc' | 'desc';

    @IsOptional()
    @IsUUID()
    source_id?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    assigned_to_id?: number;

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
