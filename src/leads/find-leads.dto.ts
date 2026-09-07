import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

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
