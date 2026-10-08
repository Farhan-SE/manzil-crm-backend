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

export const TASK_STATUSES = ['open', 'in_progress', 'scheduled'];
export const TASK_PRIORITIES = ['low', 'normal', 'high'];

@Entity()
export class FollowUp {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    // The short, human-facing task ID, shown as TSK-<n>.
    @Column({ type: 'int' })
    @Generated('increment')
    task_no: number;

    // Where an unfinished task stands. `completed` and the due time take precedence when it is shown.
    @Column({ type: 'text', default: 'open' })
    status: string;

    @Column({ type: 'text', default: 'normal' })
    priority: string;

    @Column({ type: 'boolean', default: false })
    is_starred: boolean;

    @ManyToOne(() => Lead, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lead_id' })
    lead: Lead;

    @Column({ type: 'text' })
    text: string;

    // Null on follow-ups written before tasks had a type, and on free-text ones.
    @Column({ type: 'text', nullable: true })
    task_type: string | null;

    @Column({ type: 'text', nullable: true })
    sub_task: string | null;

    @Column({ type: 'date' })
    due_date: string;

    @Column({ type: 'time' })
    due_time: string;

    @Column({ type: 'boolean', default: false })
    completed: boolean;

    @Column({ type: 'timestamptz', nullable: true })
    completed_at: Date | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'created_by_id' })
    created_by: User | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
