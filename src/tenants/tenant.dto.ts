import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { TENANT_STATUSES } from './tenant.entity.js';

/** A new company and the admin who will run it. */
export class CreateTenantDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name: string;

    /** Defaults to one made from the name. */
    @IsOptional()
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug may only hold lowercase letters, digits and single dashes' })
    @MaxLength(60)
    slug?: string;

    @IsNotEmpty()
    admin_first_name: string;

    @IsNotEmpty()
    admin_last_name: string;

    @IsEmail()
    admin_email: string;
}

export class UpdateTenantDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name?: string;

    @IsOptional()
    @IsIn(TENANT_STATUSES)
    status?: string;
}

export class FindTenantsDto {
    /** Matches the company's name or slug. */
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsIn(TENANT_STATUSES)
    status?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}
