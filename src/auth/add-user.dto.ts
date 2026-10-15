import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class AddUserDto {
    @IsNotEmpty()
    first_name: string;

    @IsNotEmpty()
    last_name: string;

    @IsEmail()
    email: string;

    /** Choosing a role takes roles.manage; without one the member gets the company's default role. */
    @IsOptional()
    @IsUUID()
    role_id?: string;

    /** Older clients send 'admin' or 'agent' instead of a role id. */
    @IsOptional()
    @IsIn(['admin', 'agent'])
    user_role?: string;

    @IsOptional()
    @IsUUID()
    team_id?: string;
}

export class SetTeamDto {
    /** Null takes the member out of their team. */
    @ValidateIf((dto: SetTeamDto) => dto.team_id !== null)
    @IsUUID()
    team_id: string | null;
}
