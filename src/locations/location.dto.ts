import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export const LOCATION_TABS = ['all', 'active', 'inactive'] as const;
export type LocationTab = (typeof LOCATION_TABS)[number];

export class FindLocationsDto {
    /** Matches the location's name or its LOC number. */
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    city?: string;

    /** Locations this project sits in. */
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @IsOptional()
    @IsString()
    region?: string;

    @IsOptional()
    @IsIn(LOCATION_TABS)
    status?: LocationTab;

    @IsOptional()
    @IsIn(['true', 'false'])
    starred?: string;

    /** Direction of the LOC number ordering. */
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

export class UpdateLocationDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    region?: string;

    @IsOptional()
    @IsString()
    department?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

export class StarLocationDto {
    @IsBoolean()
    is_starred: boolean;
}
