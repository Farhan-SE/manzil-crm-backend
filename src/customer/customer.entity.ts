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
import { Source } from '../sources/source.entity.js';

export const CUSTOMER_STAGES = ['inquiry', 'prospect', 'mature', 'pre_closure', 'sold', 'lost'];
export const GENDERS = ['male', 'female'];

@Entity()
export class Customers {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    tenant_id: string;

    // The short, human-facing client ID. The uuid stays the key used in URLs and relations.
    @Column({ type: 'int' })
    @Generated('increment')
    customer_no: number;

    /** The display name, kept as first and last name joined. */
    @Column()
    customer_name: string;

    @Column({ type: 'text', nullable: true })
    first_name: string | null;

    @Column({ type: 'text', nullable: true })
    last_name: string | null;

    @Column({ type: 'text', nullable: true })
    cnic_number: string | null;

    @Column()
    contact_number: string;

    @Column({ type: 'text', nullable: true })
    gender: string | null;

    @Column({ type: 'text', nullable: true })
    alternate_contact_number: string | null;

    @Column({ type: 'text', nullable: true })
    email: string | null;

    @Column({ type: 'text', nullable: true })
    address: string | null;

    @Column({ type: 'text', nullable: true })
    city: string | null;

    @Column({ type: 'text', nullable: true })
    relation_type: string | null;

    @Column({ type: 'uuid', nullable: true })
    source_id: string | null;

    // Read-only join over source_id so responses carry the name, not just the id.
    @ManyToOne(() => Source, { nullable: true, createForeignKeyConstraints: false })
    @JoinColumn({ name: 'source_id' })
    source: Source | null;

    @Column({ type: 'text', nullable: true })
    sub_source: string | null;

    @Column({ type: 'text', default: 'PK' })
    country: string;

    @Column({ type: 'text', default: 'inquiry' })
    stage: string;

    @Column({ type: 'boolean', default: false })
    is_starred: boolean;

    @Column({type: 'date' , nullable: true})
    customer_since: Date | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;


    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'assigned_to_id' })
    assigned_to: User | null;

    /** Who added the client. An agent sees the clients they added and the ones assigned to them. */
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'created_by_id' })
    created_by: User | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
