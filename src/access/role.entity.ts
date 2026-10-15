import {
    Entity,
    PrimaryGeneratedColumn,
    PrimaryColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';

/** A set of permissions a company gives its staff. Each company builds its own. */
@Entity()
@Unique(['tenant_id', 'name'])
export class Role {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    tenant_id: string;

    @Column({ type: 'text' })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    /** The company's Admin role: it holds every permission and can't be changed or deleted. */
    @Column({ type: 'boolean', default: false })
    is_system: boolean;

    /** What a new staff member gets when whoever adds them can't choose a role. */
    @Column({ type: 'boolean', default: false })
    is_default: boolean;

    @OneToMany(() => RolePermission, (grant) => grant.role, { cascade: true })
    permissions: RolePermission[];

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}

@Entity()
export class RolePermission {

    @PrimaryColumn({ type: 'uuid' })
    role_id: string;

    @PrimaryColumn({ type: 'text' })
    permission: string;

    /** own, team or all for a scoped permission; null for a plain yes. */
    @Column({ type: 'text', nullable: true })
    scope: string | null;

    @ManyToOne(() => Role, (role) => role.permissions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'role_id' })
    role: Role;

}
