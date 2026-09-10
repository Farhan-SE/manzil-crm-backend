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
import { Interest } from '../interests/interest.entity.js';
import { Category } from '../categories/category.entity.js';
import { Source } from '../sources/source.entity.js';

@Entity()
export class Lead {

    @PrimaryGeneratedColumn('uuid')
    id: string;

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
