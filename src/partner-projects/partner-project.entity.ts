import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from '../auth/user.entity.js';

export const PROJECT_TYPES = ['exclusive', 'non_exclusive'];

/** A developer's project the team markets — company-wide inventory, no private contact. */
@Entity()
export class PartnerProject {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    project_name: string;

    @Column({ type: 'text', nullable: true })
    developer: string | null;

    @Column({ type: 'uuid', nullable: true })
    category_id: string | null;

    @Column({ type: 'uuid', nullable: true })
    interest_id: string | null;

    @Column({ type: 'text', nullable: true })
    city: string | null;

    @Column({ type: 'text', nullable: true })
    location: string | null;

    @Column({ type: 'numeric', nullable: true })
    price: string | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'text', default: 'exclusive' })
    project_type: string;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: false })
    is_starred: boolean;

    @Column({ type: 'text', nullable: true })
    grade: string | null;

    // Booking terms: a fixed token, then the partial and complete down payments as a % of the price.
    @Column({ type: 'numeric', nullable: true })
    token_amount: string | null;

    @Column({ type: 'numeric', nullable: true })
    pdp_percent: string | null;

    @Column({ type: 'numeric', nullable: true })
    cdp_percent: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'created_by_id' })
    created_by: User | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
