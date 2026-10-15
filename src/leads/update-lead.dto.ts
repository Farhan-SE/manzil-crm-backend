import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { StagePaymentDto } from './stage-change.js';
import { LEAD_STAGES } from './lead.entity.js';

export class UpdateLeadDto {
    @IsOptional()
    @IsString()
    client_name?: string;

    @IsOptional()
    @IsString()
    client_number?: string;

    @IsOptional()
    @IsUUID()
    interest_id?: string;

    @IsOptional()
    @IsUUID()
    category_id?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    area?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    budget?: number;

    @IsOptional()
    @IsUUID()
    source_id?: string;

    @IsOptional()
    @IsString()
    sub_source?: string;

    @IsOptional()
    @IsString()
    temperature?: string;

    @IsOptional()
    @IsIn(LEAD_STAGES)
    stage?: string;

    /** Required when `stage` moves the lead forward into Pre-Closure or Sold. */
    @IsOptional()
    @ValidateNested()
    @Type(() => StagePaymentDto)
    payment?: StagePaymentDto;

    @IsOptional()
    @IsInt()
    assigned_to_id?: number;
}
