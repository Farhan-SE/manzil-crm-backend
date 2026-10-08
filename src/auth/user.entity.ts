import { Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column } from "typeorm";

@Entity()
export class User {

    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column()
    first_name: string;

    @Column()
    last_name: string;

    @Column({ unique: true })
    email: string;

    @Column()
    password: string;

    @Column({ default: 'agent' })
    user_role: string;

    @Column({ type: 'uuid', nullable: true })
    team_id: string | null;

    // A copy of the linked team's name, so lists can show it without a join. Kept in sync by the teams service.
    @Column({ type: 'text', nullable: true })
    team: string | null;

    // The sales region this person works, e.g. "Central 1".
    @Column({ type: 'text', nullable: true })
    region: string | null;

    @Column({ type: 'text', nullable: true })
    designation: string | null;

    @Column({ type: 'text', nullable: true })
    department: string | null;

    @Column({ type: 'text', nullable: true })
    office: string | null;

    // The line manager this person reports to.
    @Column({ type: 'int', nullable: true })
    manager_id: number | null;

    // When they joined the company. Falls back to the account's creation date when unset.
    @Column({ type: 'date', nullable: true })
    joined_on: string | null;

    @Column({ type: 'boolean', default: false })
    blocked: boolean;

    /** A temporary lock-out: like `blocked` they can't sign in, but they stay on the staff register. */
    @Column({ type: 'boolean', default: false })
    suspended: boolean;

    @Column({ type: 'boolean', default: false })
    is_starred: boolean;

    /** False until the user replaces the generated password handed out at add-user time. */
    @Column({ type: 'boolean', default: false })
    password_changed: boolean;

    @Column({ type: 'text', nullable: true })
    reset_token: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    reset_token_expires: Date | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}