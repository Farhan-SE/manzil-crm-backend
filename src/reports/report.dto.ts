import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';
import { TARGET_METRICS } from './report.entity.js';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export class ReportQueryDto {
    /** The month to report on, as YYYY-MM. Defaults to the current month. */
    @IsOptional()
    @Matches(PERIOD, { message: 'period must be in YYYY-MM format' })
    period?: string;

    @IsOptional()
    @IsUUID()
    project_id?: string;

    /** The assigned staff member's region. */
    @IsOptional()
    @IsString()
    region?: string;

    /** The first day of the range, as YYYY-MM-DD. Takes precedence over `period`. */
    @IsOptional()
    @IsDateString()
    from?: string;

    /** The last day of the range, inclusive. */
    @IsOptional()
    @IsDateString()
    to?: string;

    /** Only this staff member's leads, payments or activity. */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    staff_id?: number;
}

export class SetTargetDto {
    @Matches(PERIOD, { message: 'period must be in YYYY-MM format' })
    period: string;

    @IsIn(TARGET_METRICS)
    metric: string;

    @IsNumber()
    @Min(0)
    value: number;
}
