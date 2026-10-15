import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Length, ValidateIf } from 'class-validator';
import { CUSTOMER_STAGES, GENDERS } from './customer.entity.js';

export class CreateCustomerDto {
    // The form sends first and last name; a CSV import may send only the full name.
    @ValidateIf((dto: CreateCustomerDto) => !dto.first_name)
    @IsNotEmpty()
    customer_name?: string;

    @ValidateIf((dto: CreateCustomerDto) => !dto.customer_name)
    @IsNotEmpty()
    first_name?: string;

    @IsOptional()
    @IsString()
    last_name?: string;

    @IsOptional()
    @IsString()
    cnic_number?: string;

    /** The project the client is interested in. A lead for it is opened with the client. */
    @IsUUID(undefined, { message: 'Select the project the client is interested in' })
    project_id: string;

    @IsNotEmpty()
    contact_number: string;

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

    @IsString()
    relation_type: string;
    
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
