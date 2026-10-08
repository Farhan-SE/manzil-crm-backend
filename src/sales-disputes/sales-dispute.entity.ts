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

export const DISPUTE_STATUSES = ['open', 'under_review', 'awaiting_evidence', 'escalated', 'resolved'];

export const DISPUTE_CATEGORIES = [
    'allocation_conflict',
    'commission_attribution',
    'duplicate_client_ownership',
    'booking_reassignment',
    'lead_source_correction',
    'other',
];

/** A disagreement over who owns a lead or sale, raised for a reviewer to settle. */
@Entity()
export class SalesDispute {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    // The short, human-facing case ID, shown as DSP-024.
    @Column({ type: 'int' })
    @Generated('increment')
    case_no: number;

    @ManyToOne(() => Lead, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lead_id' })
    lead: Lead;

    @Column({ type: 'text' })
    category: string;

    @Column({ type: 'text' })
    subject: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'text', nullable: true })
    requested_resolution: string | null;

    @Column({ type: 'text', default: 'open' })
    status: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'raised_by_id' })
    raised_by: User | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'review_owner_id' })
    review_owner: User | null;

    @Column({ type: 'date', nullable: true })
    resolution_due: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    resolved_at: Date | null;

    @Column({ type: 'boolean', default: false })
    is_starred: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
