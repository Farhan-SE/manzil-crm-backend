import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { PERMISSION_KEYS, SCOPES } from './permissions.js';

export class GrantDto {
    @IsIn(PERMISSION_KEYS)
    permission: string;

    /** Required for a scoped permission, left out for a plain one. */
    @ValidateIf((grant: GrantDto) => grant.scope !== undefined && grant.scope !== null)
    @IsIn(SCOPES)
    scope?: string | null;
}

export class CreateRoleDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(60)
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(300)
    description?: string;

    @IsArray()
    @ArrayUnique((grant: GrantDto) => grant.permission)
    @ValidateNested({ each: true })
    @Type(() => GrantDto)
    permissions: GrantDto[];

    /** Make this the role new staff get. */
    @IsOptional()
    @IsBoolean()
    is_default?: boolean;
}

export class UpdateRoleDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(60)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(300)
    description?: string;

    @IsOptional()
    @IsArray()
    @ArrayUnique((grant: GrantDto) => grant.permission)
    @ValidateNested({ each: true })
    @Type(() => GrantDto)
    permissions?: GrantDto[];

    @IsOptional()
    @IsBoolean()
    is_default?: boolean;
}
