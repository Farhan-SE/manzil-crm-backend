import { IsNotEmpty } from 'class-validator';

export class CreateInterestDto {
    @IsNotEmpty()
    name: string;
}
