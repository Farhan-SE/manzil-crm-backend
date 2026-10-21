import { IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @IsNotEmpty()
    token: string;

    @MinLength(8, { message: 'New password must be at least 8 characters' })
    new_password: string;
}
