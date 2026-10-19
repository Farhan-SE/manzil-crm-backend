import { HttpException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { CustomerImport } from './customer-import.entity.js';
import { importClients } from './import-clients.js';

/** How many skipped rows a job keeps with their reasons; the count covers the rest. */
const KEPT_ERRORS = 100;

// A job "processing" for this long was dropped by a crashed or timed-out worker and may be taken again.
const STALE_AFTER = "interval '20 minutes'";

/**
 * Runs one queued import to the end and records the outcome on the job. Safe to call twice for the
 * same job, as a queue may deliver a message more than once: only one caller gets to claim it.
 */
export async function processImport(db: EntityManager, jobId: string, readFile: (key: string) => Promise<Buffer>) {
    const [claimed]: CustomerImport[] = await db.query(
        `UPDATE "customer_import" SET status = 'processing', started_at = now(), updated_at = now()
         WHERE id = $1 AND (status = 'queued' OR (status = 'processing' AND started_at < now() - ${STALE_AFTER}))
         RETURNING *`,
        [jobId],
    ).then(([rows]) => rows);
    if (!claimed) return;

    try {
        const result = await importClients(db, await readFile(claimed.file_key), {
            tenantId: claimed.tenant_id,
            createdById: claimed.created_by_id,
            onProgress: (processed, total) =>
                db.update(CustomerImport, jobId, { processed_rows: processed, total_rows: total }).then(() => undefined),
        });
        await db.update(CustomerImport, jobId, {
            status: 'completed',
            total_rows: result.total,
            processed_rows: result.total,
            added: result.added,
            skipped: result.skipped,
            errors: result.errors.slice(0, KEPT_ERRORS),
            projects_created: result.projects_created ?? [],
            projects_matched: result.projects_matched ?? [],
            finished_at: new Date(),
        });
    } catch (error) {
        // A file we can't read is the user's to fix; anything else is ours and shouldn't leak details.
        const message = error instanceof HttpException ? error.message : 'The import stopped unexpectedly. Please try again.';
        await db.update(CustomerImport, jobId, { status: 'failed', error_message: message, finished_at: new Date() });
        if (!(error instanceof HttpException)) console.error(`Import ${jobId} failed`, error);
    }
}
