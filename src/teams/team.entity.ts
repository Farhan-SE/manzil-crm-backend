import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Generated } from 'typeorm';

@Entity()
export class Team {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    // The short, human-facing ID, shown as TEAM-01.
    @Column({ type: 'int' })
    @Generated('increment')
    team_no: number;

    @Column({ type: 'text', unique: true })
    name: string;

    // The member who runs the team.
    @Column({ type: 'int', nullable: true })
    lead_id: number | null;

    @Column({ type: 'text', nullable: true })
    department: string | null;

    @Column({ type: 'text', nullable: true })
    region: string | null;

    @Column({ type: 'text', nullable: true })
    office: string | null;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: false })
    is_starred: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
