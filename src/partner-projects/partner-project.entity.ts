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

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'created_by_id' })
    created_by: User | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
