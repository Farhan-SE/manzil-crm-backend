import { cell, type CsvRow, type ImportResult } from '../common/csv.js';
import { closestName, normalizeName } from '../common/fuzzy-name.js';
import { countryFromPhone } from '../common/country-code.js';

/** A phone number reduced to its national digits, so 0300-1234567 and +92 300 1234567 compare equal. */
export function normalizePhone(phone: string) {
    return phone.replace(/\D/g, '').replace(/^(0092|92|0)/, '');
}

// The same rule in SQL, for a query aliasing customers as "customer"; the unique index uses this expression.
export const NORMALIZED_PHONE = "regexp_replace(regexp_replace(customer.contact_number, '[^0-9]', '', 'g'), '^(0092|92|0)', '')";

const RELATION_TYPES =['buyer', 'seller', 'investor'];

/** Accepted CSV header spellings, lowercased. Order within a list does not matter. */
const CUSTOMER_ALIASES = {
    customer_name: ['name', 'full name', 'customer', 'customer name', 'client name'],
    cnic_number: ['cnic', 'nic', 'id', 'id card'],
    contact_number: ['phone', 'number', 'mobile', 'contact', 'phone number', 'whatsapp'],
    alternate_contact_number: ['alt phone', 'alternate phone', 'phone 2', 'landline'],
    email: ['email', 'email address'],
    address: ['address', 'street'],
    city: ['city'],
    relation_type: ['type', 'customer type'],
    customer_since: ['since', 'customer since', 'date'],
    source: ['source', 'lead source'],
    notes: ['notes', 'remarks', 'comments'],
    project: ['project', 'project name'],
};

export type ImportError = ImportResult['errors'][number];

/** A project an imported client joins. `id` is missing until a project the import creates is saved. */
export type ImportProject = { id?: string; name: string };

export type ClientDraft = {
    row: number;
    phoneKey: string;
    projectName: string;
    project: ImportProject | null;
    values: {
        customer_name: string;
        cnic_number: string | null;
        contact_number: string;
        country: string;
        alternate_contact_number: string | null;
        email: string | null;
        address: string | null;
        city: string | null;
        relation_type: string;
        source_id: string | null;
        customer_since: Date | null;
        notes: string | null;
    };
};

export const duplicatePhone = (draft: ClientDraft): ImportError => ({
    row: draft.row,
    reason: `Duplicate phone ${draft.values.contact_number}`,
});

/** Turns spreadsheet rows into clients to add. A phone repeated in the file keeps its first row only. */
export function readClientRows(rows: CsvRow[], sourceIdByName: Map<string, string>) {
    const drafts: ClientDraft[] = [];
    const errors: ImportError[] = [];
    const seen = new Set<string>();

    for (const [index, row] of rows.entries()) {
        // +2 so the number matches the spreadsheet line the user sees (1 = header).
        const rowNumber = index + 2;
        const name = cell(row, CUSTOMER_ALIASES.customer_name);
        const phone = cell(row, CUSTOMER_ALIASES.contact_number);
        if (!name || !phone) {
            errors.push({ row: rowNumber, reason: 'Missing name or phone' });
            continue;
        }

        const rawType = cell(row, CUSTOMER_ALIASES.relation_type).toLowerCase();
        const since = cell(row, CUSTOMER_ALIASES.customer_since);
        const draft: ClientDraft = {
            row: rowNumber,
            phoneKey: normalizePhone(phone),
            projectName: cell(row, CUSTOMER_ALIASES.project).replace(/\s+/g, ' '),
            project: null,
            values: {
                customer_name: name,
                cnic_number: cell(row, CUSTOMER_ALIASES.cnic_number) || null,
                contact_number: phone,
                country: countryFromPhone(phone),
                alternate_contact_number: cell(row, CUSTOMER_ALIASES.alternate_contact_number) || null,
                email: cell(row, CUSTOMER_ALIASES.email) || null,
                address: cell(row, CUSTOMER_ALIASES.address) || null,
                city: cell(row, CUSTOMER_ALIASES.city) || null,
                relation_type: RELATION_TYPES.includes(rawType) ? rawType : 'buyer',
                source_id: sourceIdByName.get(cell(row, CUSTOMER_ALIASES.source).toLowerCase()) ?? null,
                customer_since: since && !Number.isNaN(Date.parse(since)) ? new Date(since) : null,
                notes: cell(row, CUSTOMER_ALIASES.notes) || null,
            },
        };

        if (seen.has(draft.phoneKey)) {
            errors.push(duplicatePhone(draft));
            continue;
        }
        seen.add(draft.phoneKey);
        drafts.push(draft);
    }
    return { drafts, errors };
}

/**
 * Points each client at the project its name means, allowing for case, punctuation and small misspellings.
 * A name nothing is close to becomes a new project, which later rows spelling it differently join too.
 */
export function assignProjects(drafts: ClientDraft[], existing: ImportProject[]) {
    const projects = [...existing];
    const created: ImportProject[] = [];
    const matched: { from: string; to: string }[] = [];

    for (const draft of drafts) {
        if (!draft.projectName) continue;
        let project = closestName(draft.projectName, projects);
        if (!project) {
            project = { name: draft.projectName };
            projects.push(project);
            created.push(project);
        } else if (
            // A name that only matched by being close is reported once, so a wrong guess can be spotted.
            normalizeName(project.name) !== normalizeName(draft.projectName) &&
            !matched.some((m) => m.from === draft.projectName)
        ) {
            matched.push({ from: draft.projectName, to: project.name });
        }
        draft.project = project;
    }
    return { created, matched };
}
