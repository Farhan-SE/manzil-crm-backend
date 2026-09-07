import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateLeadDto {
    @IsNotEmpty()
    client_name: string;

    @IsNotEmpty()
    client_number: string;

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
    temperature?: string;

    @IsOptional()
    @IsInt()
    assigned_to_id?: number;
}
