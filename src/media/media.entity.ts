import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type MediaKind = 'image' | 'video';

/** A photo or video of a project (shown with all its units) or of one unit. The file lives in S3. */
@Entity('inventory_media')
@Index(['tenant_id', 'project_id'])
@Index(['tenant_id', 'unit_id'])
export class InventoryMedia {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    tenant_id: string;

    @Column({ type: 'uuid', nullable: true })
    project_id: string | null;

    @Column({ type: 'uuid', nullable: true })
    unit_id: string | null;

    @Column({ type: 'text' })
    kind: MediaKind;

    @Column({ type: 'text' })
    mime: string;

    @Column({ type: 'int' })
    size_bytes: number;

    @Column({ type: 'text' })
    file_key: string;

    @Column({ type: 'text' })
    file_name: string;

    /** `uploading` until the browser has put the file in S3 and its bytes were checked. */
    @Column({ type: 'text', default: 'uploading' })
    status: 'uploading' | 'ready';

    @Column({ type: 'int', nullable: true })
    created_by_id: number | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;
}
