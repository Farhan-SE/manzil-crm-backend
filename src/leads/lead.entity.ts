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
import { User } from '../auth/user.entity.js';
import { Interest } from '../interests/interest.entity.js';
import { Category } from '../categories/category.entity.js';
import { Source } from '../sources/source.entity.js';
import { PartnerProject } from '../partner-projects/partner-project.entity.js';
import { Customers } from '../customer/customer.entity.js';

@Entity()
export class Lead {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    // The short, human-facing lead ID. The uuid stays the key used in URLs and relations.
    @Column({ type: 'int' })
    @Generated('increment')
    lead_no: number;

    // Null only on leads imported or created before leads were linked to customers.
    @Column({ type: 'uuid', nullable: true })
    customer_id: string | null;

    @ManyToOne(() => Customers, { nullable: true, createForeignKeyConstraints: false })
    @JoinColumn({ name: 'customer_id' })
    customer: Customers | null;

    // Copied from the customer so search and the call links work without a join; kept in sync on customer edits.
    @Column()
    client_name: string;

    @Column()
    client_number: string;

    // The id columns stay writable; the relations below are read-only joins over the same
    // columns so responses can carry the name without a second round trip.
    @Column({ type: 'uuid', nullable: true })
    interest_id: string | null;

    @ManyToOne(() => Interest, { nullable: true, createForeignKeyConstraints: false })
    @JoinColumn({ name: 'interest_id' })
    interest: Interest | null;

    @Column({ type: 'uuid', nullable: true })
    category_id: string | null;

    @ManyToOne(() => Category, { nullable: true, createForeignKeyConstraints: false })
    @JoinColumn({ name: 'category_id' })
    category: Category | null;

    @Column({ type: 'text', nullable: true })
    city: string | null;

    @Column({ type: 'text', nullable: true })
    area: string | null;

    @Column({ type: 'numeric', nullable: true })
    budget: string | null;

    @Column({ type: 'uuid', nullable: true })
    source_id: string | null;

    @ManyToOne(() => Source, { nullable: true, createForeignKeyConstraints: false })
    @JoinColumn({ name: 'source_id' })
    source: Source | null;

    @Column({ type: 'text', nullable: true })
    sub_source: string | null;

    @Column({ type: 'uuid', nullable: true })
    project_id: string | null;

    @ManyToOne(() => PartnerProject, { nullable: true, createForeignKeyConstraints: false })
    @JoinColumn({ name: 'project_id' })
    project: PartnerProject | null;

    // The unit this lead is interested in. A string relation target avoids a circular import with Unit.
    @Column({ type: 'uuid', nullable: true })
    unit_id: string | null;

    @ManyToOne('Unit', { nullable: true, createForeignKeyConstraints: false })
    @JoinColumn({ name: 'unit_id' })
    unit: { id: string; unit_number: string; status: string } | null;

    @Column({ type: 'boolean', default: false })
    is_starred: boolean;

    @Column({ default: 'WARM' })
    temperature: string;

    @Column({ default: 'inquiry' })
    stage: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'assigned_to_id' })
    assigned_to: User | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'created_by_id' })
    created_by: User | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
