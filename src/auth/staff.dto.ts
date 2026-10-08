import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateIf,
} from 'class-validator';

export const STAFF_TABS = ['active', 'suspended', 'blocked'] as const;
export type StaffTab = (typeof STAFF_TABS)[number];

export const STAFF_SEARCH_FIELDS = ['employee_id', 'name'] as const;
export type StaffSearchField = (typeof STAFF_SEARCH_FIELDS)[number];

export class FindStaffDto {
    @IsOptional()
    @IsString()
    search?: string;

    /** Limits `search` to one field. Without it both are matched. */
    @IsOptional()
    @IsIn(STAFF_SEARCH_FIELDS)
    search_by?: StaffSearchField;

    @IsOptional()
    @IsString()
    department?: string;

    @IsOptional()
    @IsString()
    designation?: string;

    @IsOptional()
    @IsString()
    region?: string;

    /** Staff reporting to this line manager. */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    manager_id?: number;

    @IsOptional()
    @IsUUID()
    team_id?: string;

    @IsOptional()
    @IsIn(STAFF_TABS)
    status?: StaffTab;

    @IsOptional()
    @IsIn(['true', 'false'])
    starred?: string;

    /** Direction of the employee ID ordering. */
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

/** The staff-register details an admin maintains. An empty string clears a field. */
export class UpdateStaffProfileDto {
    @IsOptional()
    @IsString()
    designation?: string;

    @IsOptional()
    @IsString()
    department?: string;

    @IsOptional()
    @IsString()
    region?: string;

    @IsOptional()
    @IsString()
    office?: string;

    /** Null leaves the member without a line manager. */
    @IsOptional()
    @ValidateIf((dto: UpdateStaffProfileDto) => dto.manager_id !== null)
    @IsInt()
    manager_id?: number | null;

    @IsOptional()
    @ValidateIf((dto: UpdateStaffProfileDto) => dto.joined_on !== null)
    @IsDateString()
    joined_on?: string | null;
}

export class SuspendUserDto {
    @IsBoolean()
    suspended: boolean;
}

export class StarUserDto {
    @IsBoolean()
    is_starred: boolean;
}
