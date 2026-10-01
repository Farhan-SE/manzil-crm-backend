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
import { PartnerProject } from '../partner-projects/partner-project.entity.js';
import { Lead } from '../leads/lead.entity.js';

// In sale order: token, partial down payment, complete down payment, sold (closed won).
export const UNIT_STATUSES = ['available', 'token', 'pdp', 'cdp', 'sold'];

/** One sellable unit of a project — a shop, apartment or plot. */
@Entity()
export class Unit {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    project_id: string;

    @ManyToOne(() => PartnerProject, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project: PartnerProject;

    @Column({ type: 'text' })
    unit_number: string;

    @Column({ type: 'text', nullable: true })
    unit_type: string | null;

    @Column({ type: 'text', nullable: true })
    features: string | null;

    @Column({ type: 'text', nullable: true })
    floor: string | null;

    @Column({ type: 'int', nullable: true })
    beds: number | null;

    @Column({ type: 'numeric', nullable: true })
    price: string | null;

    @Column({ type: 'numeric', nullable: true })
    area_sqft: string | null;

    @Column({ type: 'text', default: 'available' })
    status: string;

    // The lead that has paid towards this unit. Null while the unit is available.
    @Column({ type: 'uuid', nullable: true })
    lead_id: string | null;

    @ManyToOne(() => Lead, { nullable: true, createForeignKeyConstraints: false })
    @JoinColumn({ name: 'lead_id' })
    lead: Lead | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'created_by_id' })
    created_by: User | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
