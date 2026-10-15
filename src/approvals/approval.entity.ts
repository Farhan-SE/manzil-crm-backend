import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Generated,
} from 'typeorm';
import { Lead } from '../leads/lead.entity.js';
import { User } from '../auth/user.entity.js';
import { Unit } from '../units/unit.entity.js';
import { Payment } from '../payments/payment.entity.js';

export const APPROVAL_TYPES = ['lead_transfer', 'inventory_approval', 'payment_verification'];
export const APPROVAL_PRIORITIES = ['normal', 'high'];
/** `returned` sends it back to the requester for more information; `rejected` closes it. */
export const APPROVAL_DECISIONS = ['approved', 'returned', 'rejected'];

/** Something a staff member needs management to sign off before it goes ahead. */
@Entity()
export class Approval {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    // The short, human-facing request ID, shown as APR-048.
    @Column({ type: 'int' })
    @Generated('increment')
    request_no: number;

    @Column({ type: 'text' })
    type: string;

    @Column({ type: 'text' })
    summary: string;

    @ManyToOne(() => Lead, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lead_id' })
    lead: Lead | null;

    /** The payment a `payment_verification` asks an admin to confirm. */
    @Column({ type: 'uuid', nullable: true })
    payment_id: string | null;

    @ManyToOne(() => Payment, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'payment_id' })
    payment: Payment | null;

    /** The unit an `inventory_approval` would put on sale. */
    @Column({ type: 'uuid', nullable: true })
    unit_id: string | null;

    @ManyToOne(() => Unit, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'unit_id' })
    unit: Unit | null;

    /** Who a `lead_transfer` hands the lead to. */
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'target_user_id' })
    target_user: User | null;

    @Column({ type: 'text', default: 'normal' })
    priority: string;

    @Column({ type: 'text', default: 'pending' })
    status: string;

    // The day management should have decided by.
    @Column({ type: 'date', nullable: true })
    due_date: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'submitted_by_id' })
    submitted_by: User | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'reviewer_id' })
    reviewer: User | null;

    @Column({ type: 'text', nullable: true })
    review_comment: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    decided_at: Date | null;

    /** What the requester added when sending a returned request back. */
    @Column({ type: 'text', nullable: true })
    requester_note: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    resubmitted_at: Date | null;

    @Column({ type: 'boolean', default: false })
    is_starred: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
