import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity.js';

/** A Meta WhatsApp Business number and the company whose customers message it. */
@Entity()
export class WhatsappNumber {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    tenant_id: string;

    @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'tenant_id' })
    tenant: Tenant;

    /** Meta's id for the number, sent with every webhook — not the phone number itself. */
    @Column({ type: 'text', unique: true })
    phone_number_id: string;

    @Column({ type: 'text', nullable: true })
    display_phone: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}
