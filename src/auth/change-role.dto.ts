import { IsIn, IsUUID, ValidateIf } from 'class-validator';

export class ChangeRoleDto {
    @ValidateIf((dto: ChangeRoleDto) => dto.user_role === undefined)
    @IsUUID()
    role_id?: string;

    /** Older clients send 'admin' or 'agent': the Admin role, or the company's default role. */
    @ValidateIf((dto: ChangeRoleDto) => dto.role_id === undefined)
    @IsIn(['admin', 'agent'])
    user_role?: string;
}
