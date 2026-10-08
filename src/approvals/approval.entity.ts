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

export const APPROVAL_TYPES = ['booking_approval', 'lead_allocation', 'payment_verification'];
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

    @ManyToOne(() => Lead, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lead_id' })
    lead: Lead;

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

    @Column({ type: 'boolean', default: false })
    is_starred: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
