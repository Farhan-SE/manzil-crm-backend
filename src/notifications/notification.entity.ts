import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../auth/user.entity.js';

/** Something one user should see in the bell panel. */
@Entity()
export class Notification {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'int' })
    user_id: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'text' })
    title: string;

    @Column({ type: 'text', nullable: true })
    body: string | null;

    // Where in the app the notification leads, e.g. "/tasks".
    @Column({ type: 'text', nullable: true })
    link: string | null;

    @Column({ type: 'boolean', default: false })
    is_read: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

}
