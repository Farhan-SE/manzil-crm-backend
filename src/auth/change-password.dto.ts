import { IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
    @IsNotEmpty()
    current_password: string;

    @MinLength(8, { message: 'New password must be at least 8 characters' })
    new_password: string;
}
