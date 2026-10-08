import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsIn,
    IsInt,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    IsUUID,
    Matches,
    Min,
} from 'class-validator';
import { PAYMENT_TYPES } from './payment.entity.js';

export const PAYMENT_TABS = ['all', 'received', 'pending', 'overdue', 'unverified'] as const;
export type PaymentTab = (typeof PAYMENT_TABS)[number];

export class CreatePaymentDto {
    @IsUUID()
    lead_id: string;

    @IsIn(PAYMENT_TYPES)
    payment_type: string;

    @IsDateString()
    due_date: string;

    @IsNumber()
    @IsPositive()
    amount: number;
}

export class FindPaymentsDto {
    /** Matches the PAY reference or the client's name. */
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsUUID()
    project_id?: string;

    @IsOptional()
    @IsIn(PAYMENT_TYPES)
    payment_type?: string;

    /** The month the payment falls due, as YYYY-MM. */
    @IsOptional()
    @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period must be in YYYY-MM format' })
    period?: string;

    @IsOptional()
    @IsIn(PAYMENT_TABS)
    tab?: PaymentTab;

    @IsOptional()
    @IsIn(['true', 'false'])
    starred?: string;

    /** Direction of the PAY reference ordering. */
    @IsOptional()
    @IsIn(['asc', 'desc'])
    sort?: 'asc' | 'desc';

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number;
}

export class RecordPaymentDto {
    @IsNumber()
    @IsPositive()
    amount: number;

    @IsOptional()
    @IsString()
    method?: string;

    @IsOptional()
    @IsString()
    reference?: string;

    @IsOptional()
    @IsString()
    note?: string;
}

export class StarPaymentDto {
    @IsBoolean()
    is_starred: boolean;
}
