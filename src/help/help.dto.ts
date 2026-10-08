import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { HELP_TOPICS, TICKET_CONTACTS, TICKET_IMPACTS } from './help.entity.js';

export class FindHelpDto {
    /** Matches article titles and bodies. */
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsIn(HELP_TOPICS)
    topic?: string;
}

export class ArticleFeedbackDto {
    @IsBoolean()
    helpful: boolean;
}

// Sent as multipart form fields alongside the attachments, so every value arrives as a string.
export class CreateSupportTicketDto {
    @IsIn(HELP_TOPICS)
    category: string;

    @IsNotEmpty()
    topic: string;

    @IsNotEmpty()
    contact_name: string;

    @IsEmail()
    reply_email: string;

    @IsNotEmpty()
    subject: string;

    @IsNotEmpty()
    details: string;

    @IsOptional()
    @IsString()
    related_record?: string;

    @IsOptional()
    @IsString()
    steps?: string;

    @IsOptional()
    @IsIn(TICKET_IMPACTS)
    impact?: string;

    @IsOptional()
    @IsIn(TICKET_CONTACTS)
    preferred_contact?: string;
}
