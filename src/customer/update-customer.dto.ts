import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CUSTOMER_STAGES, GENDERS } from './customer.entity.js';

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
    @IsIn(GENDERS)
    gender?: string;

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
    @IsString()
    sub_source?: string;

    @IsOptional()
    @IsString()
    @Length(2, 2)
    country?: string;

    @IsOptional()
    @IsIn(CUSTOMER_STAGES)
    stage?: string;

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
