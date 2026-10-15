import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { EntityManager } from 'typeorm';
import { Lead, PIPELINE_STAGES } from './lead.entity.js';
import { Customers } from '../customer/customer.entity.js';
import { Payment, PAYMENT_TYPES } from '../payments/payment.entity.js';
import { Approval } from '../approvals/approval.entity.js';
import { User } from '../auth/user.entity.js';

/** Reaching these stages means money has changed hands, so the move must say what was received. */
export const PAYMENT_STAGES = ['pre_closure', 'sold'];

const PAYMENT_LABELS: Record<string, string> = { token: 'token', down_payment: 'down payment', instalment: 'instalment' };

export class StagePaymentDto {
    @IsIn(PAYMENT_TYPES)
    payment_type: string;

    @Type(() => Number)
    @IsNumber()
    @Min(1)
    amount: number;

    @IsString()
    method: string;

    @IsOptional()
    @IsString()
    reference?: string;

    /** When the money was received, as YYYY-MM-DD. */
    @IsDateString()
    received_on: string;

    @IsOptional()
    @IsString()
    note?: string;
}

export const CNIC_REQUIRED = "Add the client's CNIC before recording a payment";

/** Money is only recorded against a client whose CNIC is on file. */
export async function assertClientHasCnic(manager: EntityManager, customerId: string | null) {
    const customer = customerId ? await manager.findOne(Customers, { where: { id: customerId } }) : null;
    if (!customer?.cnic_number?.trim()) throw new BadRequestException(CNIC_REQUIRED);
}

const rank = (stage: string) => PIPELINE_STAGES.indexOf(stage as (typeof PIPELINE_STAGES)[number]);

/** Whether moving a lead from one stage to the next needs a payment recorded with it. */
export function needsPayment(from: string, to: string) {
    return PAYMENT_STAGES.includes(to) && rank(to) > rank(from);
}

/**
 * Moves a lead to a new stage and keeps its client on the same stage. Moving forward into
 * Pre-Closure or Sold records the payment that justifies it and asks an admin to verify it.
 */
export async function applyLeadStage(
    manager: EntityManager,
    lead: Lead,
    stage: string,
    payment: StagePaymentDto | undefined,
    requesterId: number,
) {
    if (stage === lead.stage) return;
    if (needsPayment(lead.stage, stage) && !payment) {
        throw new BadRequestException(
            `Add the payment received to move this lead to ${stage === 'sold' ? 'Sold' : 'Pre-Closure'}`,
        );
    }
    if (payment) await assertClientHasCnic(manager, lead.customer_id);

    await manager.update(Lead, { id: lead.id }, {
        stage,
        sold_at: stage === 'sold' ? (lead.sold_at ?? new Date()) : null,
    });
    if (lead.customer_id) await manager.update(Customers, { id: lead.customer_id }, { stage });
    lead.stage = stage;

    if (!payment) return;
    const receivedAt = new Date(`${payment.received_on}T12:00:00`);
    const saved = await manager.save(
        manager.create(Payment, {
            lead: { id: lead.id } as Lead,
            payment_type: payment.payment_type,
            due_date: payment.received_on,
            amount: String(payment.amount),
            received_amount: String(payment.amount),
            received_at: receivedAt,
            method: payment.method.trim(),
            reference: payment.reference?.trim() || null,
            note: payment.note?.trim() || null,
            verified: false,
            created_by: { id: requesterId } as User,
        }),
    );
    await manager.save(
        manager.create(Approval, {
            type: 'payment_verification',
            summary: `Verify the ${PAYMENT_LABELS[payment.payment_type]} of PKR ${payment.amount.toLocaleString('en-US')} from ${lead.client_name}${
                payment.reference?.trim() ? ` (ref ${payment.reference.trim()})` : ''
            }`,
            lead: { id: lead.id } as Lead,
            payment_id: saved.id,
            submitted_by: { id: requesterId } as User,
        }),
    );
}
