import { IsNotEmpty } from 'class-validator';

export class UpdateInterestDto {
    @IsNotEmpty()
    name: string;
}
