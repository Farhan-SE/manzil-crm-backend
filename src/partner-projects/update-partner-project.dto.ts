import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

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
}
