import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A link that shows one unit's photos and videos to a client, without logging in, until it expires. */
@Entity('media_share')
export class MediaShare {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    tenant_id: string;

    @Column({ type: 'uuid' })
    unit_id: string;

    @Column({ type: 'uuid', nullable: true })
    lead_id: string | null;

    /** SHA-256 of the token in the link; the token itself is never stored. */
    @Column({ type: 'text', unique: true, select: false })
    token_hash: string;

    @Column({ type: 'timestamptz' })
    expires_at: Date;

    @Column({ type: 'timestamptz', nullable: true })
    revoked_at: Date | null;

    @Column({ type: 'int', default: 0 })
    open_count: number;

    @Column({ type: 'timestamptz', nullable: true })
    last_opened_at: Date | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;
}
