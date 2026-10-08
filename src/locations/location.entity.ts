import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Generated,
} from 'typeorm';

/** A place the team sells in — the area within a city that one or more projects sit in. */
@Entity()
export class Location {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    // The short, human-facing ID, shown as LOC-001.
    @Column({ type: 'int' })
    @Generated('increment')
    location_no: number;

    @Column({ type: 'text' })
    name: string;

    @Column({ type: 'text', nullable: true })
    city: string | null;

    @Column({ type: 'text', nullable: true })
    region: string | null;

    @Column({ type: 'text', nullable: true })
    department: string | null;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: false })
    is_starred: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
