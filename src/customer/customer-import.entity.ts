import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { ImportResult } from '../common/csv.js';

/**
 * uploading → queued → processing → completed | failed. A job waits in "uploading" until the browser
 * has put the file in S3 and asked for it to start.
 */
export const IMPORT_STATUSES = ['uploading', 'queued', 'processing', 'completed', 'failed'] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/** One spreadsheet of clients being imported in the background. */
@Entity('customer_import')
export class CustomerImport {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    tenant_id: string;

    @Column({ type: 'int', nullable: true })
    created_by_id: number | null;

    /** Where the upload lives in the imports bucket. */
    @Column({ type: 'text' })
    file_key: string;

    @Column({ type: 'text' })
    file_name: string;

    @Column({ type: 'text', default: 'uploading' })
    status: ImportStatus;

    /** Known once the file has been read. */
    @Column({ type: 'int', nullable: true })
    total_rows: number | null;

    @Column({ type: 'int', default: 0 })
    processed_rows: number;

    @Column({ type: 'int', default: 0 })
    added: number;

    @Column({ type: 'int', default: 0 })
    skipped: number;

    /** The first rows that were skipped, with why; `skipped` has the full count. */
    @Column({ type: 'jsonb', default: () => "'[]'" })
    errors: ImportResult['errors'];

    @Column({ type: 'jsonb', default: () => "'[]'" })
    projects_created: string[];

    @Column({ type: 'jsonb', default: () => "'[]'" })
    projects_matched: { from: string; to: string }[];

    /** Why the whole import failed, such as a file that isn't a spreadsheet. */
    @Column({ type: 'text', nullable: true })
    error_message: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    started_at: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    finished_at: Date | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;
}
