import { IsNotEmpty } from 'class-validator';

export class CreateSourceDto {
    @IsNotEmpty()
    name: string;
}
