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

export const PAYMENT_TYPES = ['token', 'down_payment', 'instalment'];

/** One amount a client owes on a deal, and what has come in against it. */
@Entity()
export class Payment {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    // The short, human-facing reference, shown as PAY-1036.
    @Column({ type: 'int' })
    @Generated('increment')
    payment_no: number;

    @ManyToOne(() => Lead, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lead_id' })
    lead: Lead;

    @Column({ type: 'text' })
    payment_type: string;

    @Column({ type: 'date' })
    due_date: string;

    @Column({ type: 'numeric' })
    amount: string;

    @Column({ type: 'numeric', default: 0 })
    received_amount: string;

    @Column({ type: 'timestamptz', nullable: true })
    received_at: Date | null;

    @Column({ type: 'text', nullable: true })
    method: string | null;

    // The bank or transaction reference on the receipt.
    @Column({ type: 'text', nullable: true })
    reference: string | null;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    /** Money recorded by sales only counts as received once Accounts has confirmed the receipt. */
    @Column({ type: 'boolean', default: false })
    verified: boolean;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'verified_by_id' })
    verified_by: User | null;

    @Column({ type: 'boolean', default: false })
    is_starred: boolean;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'created_by_id' })
    created_by: User | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
