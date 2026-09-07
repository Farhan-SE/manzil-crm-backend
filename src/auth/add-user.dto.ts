import { IsEmail, IsIn, IsNotEmpty } from 'class-validator';

export class AddUserDto {
    @IsNotEmpty()
    first_name: string;

    @IsNotEmpty()
    last_name: string;

    @IsEmail()
    email: string;

    @IsIn(['admin', 'agent'])
    user_role: string;
}
