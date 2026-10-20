import type { EntityManager } from 'typeorm';
import { parseSpreadsheet, type ImportResult } from '../common/csv.js';
import { Customers } from './customer.entity.js';
import { Source } from '../sources/source.entity.js';
import { PartnerProject } from '../partner-projects/partner-project.entity.js';
import type { User } from '../auth/user.entity.js';
import { assignProjects, duplicatePhone, NORMALIZED_PHONE, normalizePhone, readClientRows } from './customer-import.js';

// Rows per INSERT. 1000 clients × 15 values stays well under Postgres's 65535 parameter limit.
const CHUNK = 1000;

type ImportOptions = {
    tenantId: string;
    createdById: number | null;
    /** Called after each batch is written, with how many of the file's rows are done. */
    onProgress?: (processed: number, total: number) => Promise<void>;
};

/**
 * Adds clients from a .csv or .xlsx. A row's project is matched to an existing one by name, allowing
 * for case, punctuation and small misspellings; only a name nothing is close to becomes a new project.
 * No lead is opened, unlike adding a client from the form. Shared by the API and the import Lambda,
 * so it takes the company explicitly rather than from the request.
 */
export async function importClients(db: EntityManager, buffer: Buffer, options: ImportOptions): Promise<ImportResult> {
    const { tenantId, onProgress } = options;
    const createdBy = options.createdById ? ({ id: options.createdById } as User) : null;
    const rows = await parseSpreadsheet(buffer);
    // Round trips dominate an import, so every query here covers the whole file rather than one row.
    const [sources, existingProjects] = await Promise.all([
        db.find(Source, { where: { tenant_id: tenantId } }),
        db.find(PartnerProject, { where: { tenant_id: tenantId }, select: { id: true, project_name: true } }),
    ]);
    const sourceIdByName = new Map(sources.map((s) => [s.name.toLowerCase(), s.id]));

    const { drafts, errors } = readClientRows(rows, sourceIdByName);
    const taken = await takenPhones(db, tenantId, drafts.map((draft) => draft.phoneKey));
    const fresh = drafts.filter((draft) => {
        if (taken.has(draft.phoneKey)) errors.push(duplicatePhone(draft));
        return !taken.has(draft.phoneKey);
    });
    const { created, matched } = assignProjects(
        fresh,
        existingProjects.map((project) => ({ id: project.id, name: project.project_name })),
    );

    let added = 0;
    await db.transaction(async (manager) => {
        if (created.length) {
            const { identifiers } = await manager.insert(
                PartnerProject,
                created.map((project) => ({ project_name: project.name, tenant_id: tenantId, created_by: createdBy })),
            );
            created.forEach((project, i) => (project.id = identifiers[i].id));
        }

        for (let start = 0; start < fresh.length; start += CHUNK) {
            const chunk = fresh.slice(start, start + CHUNK);
            // Skipping conflicts covers a number someone else added since takenPhones ran.
            const { raw } = await manager
                .createQueryBuilder()
                .insert()
                .into(Customers)
                .values(chunk.map((draft) => ({
                    ...draft.values,
                    project_id: draft.project?.id ?? null,
                    tenant_id: tenantId,
                    created_by: createdBy,
                })))
                .orIgnore()
                .returning('contact_number')
                .updateEntity(false)
                .execute();
            const inserted = new Set((raw as { contact_number: string }[]).map((r) => normalizePhone(r.contact_number)));
            for (const draft of chunk) if (!inserted.has(draft.phoneKey)) errors.push(duplicatePhone(draft));
            added += inserted.size;
            await onProgress?.(rows.length - fresh.length + start + chunk.length, rows.length);
        }
    });

    return {
        total: rows.length,
        added,
        skipped: errors.length,
        errors: errors.sort((a, b) => a.row - b.row),
        projects_created: created.map((project) => project.name),
        projects_matched: matched,
    };
}

/** The phones among `phoneKeys` that already belong to a client of the company. */
async function takenPhones(db: EntityManager, tenantId: string, phoneKeys: string[]) {
    if (!phoneKeys.length) return new Set<string>();
    const rows: { phone: string }[] = await db
        .createQueryBuilder(Customers, 'customer')
        .select(NORMALIZED_PHONE, 'phone')
        .where('customer.tenant_id = :tenantId', { tenantId })
        .andWhere(`${NORMALIZED_PHONE} = ANY(:phoneKeys)`, { phoneKeys })
        .getRawMany();
    return new Set(rows.map((row) => row.phone));
}
