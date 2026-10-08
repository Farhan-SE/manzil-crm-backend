import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { UNIT_STATUSES } from './unit.entity.js';

export class CreateUnitDto {
    @IsUUID()
    project_id: string;

    @IsNotEmpty()
    unit_number: string;

    @IsOptional()
    @IsString()
    unit_type?: string;

    @IsOptional()
    @IsString()
    features?: string;

    @IsOptional()
    @IsString()
    floor?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    beds?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    area_sqft?: number;

    @IsOptional()
    @IsIn(UNIT_STATUSES)
    status?: string;
}

export class UpdateUnitDto {
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @IsOptional()
    @IsNotEmpty()
    unit_number?: string;

    @IsOptional()
    @IsString()
    unit_type?: string;

    @IsOptional()
    @IsString()
    features?: string;

    @IsOptional()
    @IsString()
    floor?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    beds?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    area_sqft?: number;

    @IsOptional()
    @IsIn(UNIT_STATUSES)
    status?: string;
}

export class FindUnitsDto {
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @IsOptional()
    @IsString()
    unit_type?: string;

    /** Matches the unit number. */
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsIn(UNIT_STATUSES)
    status?: string;

    @IsOptional()
    @IsIn(['true', 'false'])
    starred?: string;

    /** Direction of the date-created ordering. */
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

export class StarUnitDto {
    @IsBoolean()
    is_starred: boolean;
}

export class ImportUnitsDto {
    @IsUUID()
    project_id: string;
}
