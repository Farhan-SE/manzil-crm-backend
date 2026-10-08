import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Min,
    ValidateIf,
} from 'class-validator';

export class TeamDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    /** When present, the team ends up with exactly these members. Omitted leaves membership alone. */
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    member_ids?: number[];

    /** Null leaves the team without a lead. */
    @IsOptional()
    @ValidateIf((dto: TeamDto) => dto.lead_id !== null)
    @IsInt()
    lead_id?: number | null;

    @IsOptional()
    @IsString()
    department?: string;

    @IsOptional()
    @IsString()
    region?: string;

    @IsOptional()
    @IsString()
    office?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

export const TEAM_TABS = ['active', 'inactive', 'all'] as const;
export type TeamTab = (typeof TEAM_TABS)[number];

export class FindTeamsDto {
    /** Matches the team's name or its TEAM number. */
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    department?: string;

    @IsOptional()
    @IsString()
    region?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    lead_id?: number;

    @IsOptional()
    @IsIn(TEAM_TABS)
    status?: TeamTab;

    @IsOptional()
    @IsIn(['true', 'false'])
    starred?: string;

    /** Direction of the TEAM number ordering. */
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

export class TeamStatusDto {
    @IsBoolean()
    is_active: boolean;
}

export class StarTeamDto {
    @IsBoolean()
    is_starred: boolean;
}
