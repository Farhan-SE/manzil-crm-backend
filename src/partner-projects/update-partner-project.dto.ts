import { IsBoolean, IsIn, Max, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PROJECT_TYPES } from './partner-project.entity.js';

export class UpdatePartnerProjectDto {
    @IsOptional()
    @IsString()
    project_name?: string;

    @IsOptional()
    @IsString()
    developer?: string;

    @IsOptional()
    @IsUUID()
    category_id?: string;

    @IsOptional()
    @IsUUID()
    interest_id?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    location?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsIn(PROJECT_TYPES)
    project_type?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsString()
    grade?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    token_amount?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    pdp_percent?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    cdp_percent?: number;
}
