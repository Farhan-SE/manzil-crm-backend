import { IsDateString, IsNotEmpty, IsUUID, Matches } from 'class-validator';

export class CreateFollowUpDto {
    @IsUUID()
    lead_id: string;

    @IsNotEmpty()
    text: string;

    @IsDateString()
    due_date: string;

    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'due_time must be in HH:mm format' })
    due_time: string;
}
