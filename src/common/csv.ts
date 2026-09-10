import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

export type CsvRow = Record<string, string>;

/** Only the fields we read off a multer upload — @types/multer v2 no longer augments Express. */
export type UploadedCsv = { buffer: Buffer; originalname: string; size: number };

export type ImportResult = {
    total: number;
    added: number;
    skipped: number;
    errors: { row: number; reason: string }[];
};

/**
 * Parses an uploaded CSV into rows keyed by lowercased header. Header order does not
 * matter; unknown columns are ignored by the callers' alias maps.
 */
export function parseCsvBuffer(buffer: Buffer): CsvRow[] {
    let rows: CsvRow[];
    try {
        rows = parse(buffer, {
            columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true,
            bom: true,
        });
    } catch {
        throw new BadRequestException('That file could not be read as CSV.');
    }

    if (rows.length === 0) throw new BadRequestException('That file has a header but no rows.');
    return rows;
}

/** Returns the first non-empty value among the aliases for a field. */
export function cell(row: CsvRow, aliases: string[]) {
    for (const alias of aliases) {
        const value = row[alias];
        if (value != null && String(value).trim() !== '') return String(value).trim();
    }
    return '';
}
