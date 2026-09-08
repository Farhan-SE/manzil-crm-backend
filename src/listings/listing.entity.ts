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

/** A seller lead — a client who wants us to sell their property. */
@Entity()
export class Listing {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    area_name: string;

    @Column()
    client_name: string;

    @Column()
    client_number: string;

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
