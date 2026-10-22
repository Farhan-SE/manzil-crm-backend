import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AddWhatsappNumberDto {
    /** From Meta's WhatsApp → API Setup page, labelled "Phone number ID". */
    @Matches(/^\d{5,30}$/, { message: 'phone_number_id is the numeric ID Meta shows, not the phone number' })
    phone_number_id: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(30)
    display_phone?: string;
}
