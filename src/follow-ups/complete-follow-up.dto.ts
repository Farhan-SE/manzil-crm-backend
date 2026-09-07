import { IsBoolean } from 'class-validator';

export class CompleteFollowUpDto {
    @IsBoolean()
    completed: boolean;
}
