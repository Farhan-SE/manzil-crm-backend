import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsUUID, Matches, ValidateIf, ValidateNested } from 'class-validator';
import { LEAD_STAGES } from '../leads/lead.entity.js';
import { StagePaymentDto } from '../leads/stage-change.js';

/** Completing one of these with `received` moves the lead's unit to the mapped status. */
export const PAYMENT_TASKS: Record<string, string> = {
    receive_token_payment: 'token',
    receive_partial_down_payment: 'pdp',
    receive_complete_down_payment: 'cdp',
};

export const TASK_TYPES = ['call', 'whatsapp', 'meeting', 'site_visit', ...Object.keys(PAYMENT_TASKS)];
export const SUB_TASKS = ['followed_up', 'not_answered', 'interested', 'not_interested', 'received', 'not_received'];

/** Value → the text stored on the follow-up created for it. */
export const NEXT_TASKS: Record<string, string> = {
    do_nothing: 'Do Nothing',
    follow_up: 'Follow Up',
    contact_client: 'Contact Client',
    arrange_meeting: 'Arrange Meeting',
    meet_client: 'Meet Client',
    receive_token_payment: 'Receive Token Payment',
    receive_partial_down_payment: 'Receive Partial Down Payment',
    receive_complete_down_payment: 'Receive Complete Down Payment',
    sign_sale_agreement: 'Sign Sale Agreement',
    closed_won: 'Closed (Won)',
};

/** Next tasks that end the conversation, so nothing is scheduled for them. */
export const TERMINAL_NEXT_TASKS = ['do_nothing', 'closed_won'];

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class LogTaskDto {
    @IsUUID()
    lead_id: string;

    @IsIn(TASK_TYPES)
    task_type: string;

    @IsIn(SUB_TASKS)
    sub_task: string;

    @IsDateString()
    completed_date: string;

    @Matches(TIME, { message: 'completed_time must be in HH:mm format' })
    completed_time: string;

    @IsNotEmpty()
    comment: string;

    @IsIn(Object.keys(NEXT_TASKS))
    next_task: string;

    @ValidateIf((dto: LogTaskDto) => !TERMINAL_NEXT_TASKS.includes(dto.next_task))
    @IsDateString()
    deadline_date?: string;

    @ValidateIf((dto: LogTaskDto) => !TERMINAL_NEXT_TASKS.includes(dto.next_task))
    @Matches(TIME, { message: 'deadline_time must be in HH:mm format' })
    deadline_time?: string;

    @IsOptional()
    @IsUUID()
    project_id?: string;

    @IsOptional()
    @IsUUID()
    unit_id?: string;

    @IsIn(['HOT', 'WARM', 'COLD'])
    temperature: string;

    /** Moves the lead to this stage along with the task. Closed (Won) implies Sold. */
    @IsOptional()
    @IsIn(LEAD_STAGES)
    stage?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => StagePaymentDto)
    payment?: StagePaymentDto;
}

export class WeekLoadDto {
    @IsDateString()
    from: string;
}
