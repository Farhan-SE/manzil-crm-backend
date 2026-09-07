import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Lead } from '../leads/lead.entity.js';
import { User } from '../auth/user.entity.js';

@Entity()
export class FollowUp {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Lead, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lead_id' })
    lead: Lead;

    @Column({ type: 'text' })
    text: string;

    @Column({ type: 'date' })
    due_date: string;

    @Column({ type: 'time' })
    due_time: string;

    @Column({ type: 'boolean', default: false })
    completed: boolean;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'created_by_id' })
    created_by: User | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
