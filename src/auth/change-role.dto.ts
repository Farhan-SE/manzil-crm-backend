import { IsIn } from 'class-validator';

export class ChangeRoleDto {
    @IsIn(['admin', 'agent'])
    user_role: string;
}
