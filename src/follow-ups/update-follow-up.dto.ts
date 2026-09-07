import { IsDateString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class UpdateFollowUpDto {
    @IsOptional()
    @IsNotEmpty()
    text?: string;

    @IsOptional()
    @IsDateString()
    due_date?: string;

    @IsOptional()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'due_time must be in HH:mm format' })
    due_time?: string;
}
