import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export const TENANT_STATUSES = ['active', 'suspended'] as const;

/** A company using the CRM. Everything its staff create belongs to it. */
@Entity()
export class Tenant {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text' })
    name: string;

    @Column({ type: 'text', unique: true })
    slug: string;

    @Column({ type: 'text', default: 'active' })
    status: string;

    /** Shown in place of the manzil.com wordmark for the company's staff. Left out of normal reads. */
    @Column({ type: 'bytea', nullable: true, select: false })
    logo: Buffer | null;

    @Column({ type: 'text', nullable: true })
    logo_mime: string | null;

    /** Also the logo URL's cache-buster, so a new upload shows straight away. */
    @Column({ type: 'timestamptz', nullable: true })
    logo_updated_at: Date | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
