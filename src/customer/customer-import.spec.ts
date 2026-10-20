import { describe, expect, it } from 'vitest';
import { assignProjects, readClientRows } from './customer-import.js';

const read = (rows: Record<string, string>[], sources = new Map<string, string>()) => readClientRows(rows, sources);

describe('readClientRows', () => {
    it('reads a row through any header alias', () => {
        const { drafts } = read([{ 'client name': 'Ali Khan', mobile: '0300-1234567', type: 'Seller', city: 'Lahore' }]);
        expect(drafts).toHaveLength(1);
        expect(drafts[0]).toMatchObject({
            row: 2,
            phoneKey: '3001234567',
            values: { customer_name: 'Ali Khan', contact_number: '0300-1234567', relation_type: 'seller', city: 'Lahore' },
        });
    });

    it('reports rows missing a name or phone by their spreadsheet line', () => {
        const { drafts, errors } = read([{ name: 'Ali', phone: '' }, { name: '', phone: '0300 1234567' }]);
        expect(drafts).toHaveLength(0);
        expect(errors).toEqual([
            { row: 2, reason: 'Missing name or phone' },
            { row: 3, reason: 'Missing name or phone' },
        ]);
    });

    it('keeps only the first row of a phone repeated in the file, however it is written', () => {
        const { drafts, errors } = read([
            { name: 'Ali', phone: '0300-1234567' },
            { name: 'Ali again', phone: '+92 300 1234567' },
        ]);
        expect(drafts.map((d) => d.values.customer_name)).toEqual(['Ali']);
        expect(errors).toEqual([{ row: 3, reason: 'Duplicate phone +92 300 1234567' }]);
    });

    it('takes the country from the phone code, defaulting to Pakistan', () => {
        const { drafts } = read([
            { name: 'Ali', phone: '0300-1234567' },
            { name: 'Hina', phone: '+971 50 555 1206' },
            { name: 'Sara', phone: '00966 55 123 4567' },
            { name: 'John', phone: '+1 212 555 0100' },
        ]);
        expect(drafts.map((d) => d.values.country)).toEqual(['PK', 'AE', 'SA', 'US']);
    });

    it('falls back to buyer for an unknown type and matches sources by name', () => {
        const { drafts } = read([{ name: 'Ali', phone: '03001234567', type: 'tenant', source: 'Facebook' }], new Map([['facebook', 's1']]));
        expect(drafts[0].values).toMatchObject({ relation_type: 'buyer', source_id: 's1' });
    });
});

describe('assignProjects', () => {
    const draftsFor = (...projects: string[]) =>
        read(projects.map((project, i) => ({ name: `Client ${i}`, phone: `030000000${i}`, project }))).drafts;

    it('joins existing projects, reporting a misspelling once', () => {
        const drafts = draftsFor('Pearl One', 'Perl One', 'Perl One');
        const { created, matched } = assignProjects(drafts, [{ id: 'p1', name: 'Pearl One' }]);
        expect(drafts.map((d) => d.project?.id)).toEqual(['p1', 'p1', 'p1']);
        expect(created).toEqual([]);
        expect(matched).toEqual([{ from: 'Perl One', to: 'Pearl One' }]);
    });

    it('creates an unknown project once and puts later spellings of it in the same one', () => {
        const drafts = draftsFor('Park View', 'park view', 'Park Viw');
        const { created } = assignProjects(drafts, []);
        expect(created).toEqual([{ name: 'Park View' }]);
        expect(new Set(drafts.map((d) => d.project))).toEqual(new Set([created[0]]));
    });

    it('leaves a client without a project when the row names none', () => {
        const drafts = draftsFor('');
        assignProjects(drafts, [{ id: 'p1', name: 'Pearl One' }]);
        expect(drafts[0].project).toBeNull();
    });
});
