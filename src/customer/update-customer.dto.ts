import { IsDateString, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateCustomerDto {
    @IsOptional()
    @IsString()
    customer_name?: string;

    @IsOptional()
    @IsString()
    cnic_number?: string;

    @IsOptional()
    @IsString()
    contact_number?: string;

    @IsOptional()
    @IsString()
    alternate_contact_number?: string;

    @IsOptional()
    @IsString()
    email?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    relation_type?: string;

    @IsOptional()
    @IsUUID()
    source_id?: string;

    @IsOptional()
    @IsDateString()
    customer_since?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsInt()
    assigned_to_id?: number;
}
