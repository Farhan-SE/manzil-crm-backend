import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

export type CsvRow = Record<string, string>;

/** Only the fields we read off a multer upload — @types/multer v2 no longer augments Express. */
export type UploadedCsv = { buffer: Buffer; originalname: string; size: number };

export type ImportResult = {
    total: number;
    added: number;
    skipped: number;
    errors: { row: number; reason: string }[];
    /** Projects an import had to create because no project had a name close to it. */
    projects_created?: string[];
    /** Names in the file that were spelt differently from the existing project they were matched to. */
    projects_matched?: { from: string; to: string }[];
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

    rows = rows.filter((row) => Object.values(row).some((value) => String(value ?? '').trim() !== ''));
    if (rows.length === 0) throw new BadRequestException('That file has a header but no rows.');
    return rows;
}

/** An .xlsx is a zip archive, which always starts with these bytes. */
function isXlsx(buffer: Buffer) {
    return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

/**
 * Reads an uploaded .csv or .xlsx into rows keyed by lowercased header, the same shape either way.
 * For a workbook that is its first sheet, with the first non-empty row as the header.
 */
export async function parseSpreadsheet(buffer: Buffer): Promise<CsvRow[]> {
    if (!isXlsx(buffer)) return parseCsvBuffer(buffer);

    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
        throw new BadRequestException('That file could not be read as an Excel workbook.');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('That workbook has no sheets.');

    // cell.text is what Excel shows, so numbers keep their digits rather than becoming floats.
    const lines: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
        const values: string[] = [];
        for (let col = 1; col <= sheet.columnCount; col++) values.push(row.getCell(col).text.trim());
        if (values.some((value) => value !== '')) lines.push(values);
    });

    const [header, ...body] = lines;
    if (!header) throw new BadRequestException('That sheet is empty.');
    const keys = header.map((name) => name.toLowerCase());
    const rows = body.map((values) => Object.fromEntries(keys.map((key, i) => [key, values[i] ?? ''])) as CsvRow);
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
