import 'reflect-metadata';
import { DataSource } from 'typeorm';
import AppDataSource from '../data-source.js';
import { processImport } from '../customer/process-import.js';
import { readUpload } from '../customer/import-files.js';

type SqsEvent = { Records: { body: string }[] };

// Kept across invocations of a warm Lambda. Query logging would print every imported row.
const db = new DataSource({ ...AppDataSource.options, logging: false, migrations: [] });

/** Runs the client imports the API queued, one SQS message per job. */
export async function handler(event: SqsEvent) {
    if (!db.isInitialized) await db.initialize();
    for (const record of event.Records) {
        const { jobId } = JSON.parse(record.body) as { jobId: string };
        await processImport(db.manager, jobId, readUpload);
    }
}
