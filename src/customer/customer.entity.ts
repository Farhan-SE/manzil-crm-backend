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
export class Customers {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    customer_name: string;

    @Column()
    cnic_number: string;

    @Column()
    contact_number: string;

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

    @Column({type: 'date' , nullable: true})
    customer_since: Date | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;


    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'assigned_to_id' })
    assigned_to: User | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
