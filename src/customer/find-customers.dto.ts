import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { CUSTOMER_STAGES } from './customer.entity.js';

export class StarCustomerDto {
    @IsBoolean()
    is_starred: boolean;
}

export class FindCustomersDto {
    @IsOptional()
    @IsString()
    search?: string;

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
