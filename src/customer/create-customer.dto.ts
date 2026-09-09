import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCustomerDto {
    @IsNotEmpty()
    customer_name: string;

    @IsNotEmpty()
    cnic_number: string;

    @IsNotEmpty()
    contact_number: string;

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

    @IsString()
    relation_type: string;
    
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
