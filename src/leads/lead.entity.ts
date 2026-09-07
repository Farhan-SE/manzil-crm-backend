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

@Entity()
export class Lead {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    client_name: string;

    @Column()
    client_number: string;

    @Column({ type: 'uuid', nullable: true })
    interest_id: string | null;

    @Column({ type: 'uuid', nullable: true })
    category_id: string | null;

    @Column({ type: 'text', nullable: true })
    city: string | null;

    @Column({ type: 'text', nullable: true })
    area: string | null;

    @Column({ type: 'numeric', nullable: true })
    budget: string | null;

    // Same as interest_id — bare column until the source lookup table exists.
    @Column({ type: 'uuid', nullable: true })
    source_id: string | null;

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
