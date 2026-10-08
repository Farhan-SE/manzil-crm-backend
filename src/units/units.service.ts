import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';
import { Unit, UNIT_STATUSES } from './unit.entity.js';
import { PartnerProject } from '../partner-projects/partner-project.entity.js';
import { User } from '../auth/user.entity.js';
import { CreateUnitDto, FindUnitsDto, UpdateUnitDto } from './unit.dto.js';
import { cell, parseCsvBuffer, type ImportResult } from '../common/csv.js';

/** Accepted CSV header spellings, lowercased. Order within a list does not matter. */
const UNIT_ALIASES = {
    unit_number: ['unit', 'unit number', 'unit no', 'unit #', 'number'],
    unit_type: ['type', 'unit type'],
    features: ['features', 'feat', 'feature'],
    floor: ['floor', 'location'],
    beds: ['beds', 'bedrooms'],
    price: ['price', 'price (pkr)', 'amount'],
    area_sqft: ['area', 'area (sqft)', 'sqft', 'size'],
    status: ['status'],
};

/** The long names a spreadsheet is likely to use for a status. */
const STATUS_ALIASES: Record<string, string> = {
    'partial down payment': 'pdp',
    'complete down payment': 'cdp',
    'closed won': 'sold',
    'scw': 'sold',
};

function toNumber(raw: string) {
    const cleaned = raw.replace(/[^\d.]/g, '');
    return cleaned ? cleaned : null;
}

@Injectable()
export class UnitsService {
    constructor(
        @InjectRepository(Unit)
        private unitRepository: Repository<Unit>,
        @InjectRepository(PartnerProject)
        private projectRepository: Repository<PartnerProject>,
    ) { }

    async create(dto: CreateUnitDto, createdById: number) {
        await this.assertProjectExists(dto.project_id);
        await this.assertUnitNumberIsFree(dto.project_id, dto.unit_number);

        const unit = this.unitRepository.create({
            project_id: dto.project_id,
            unit_number: dto.unit_number.trim(),
            unit_type: dto.unit_type?.trim() || null,
            features: dto.features?.trim() || null,
            floor: dto.floor?.trim() || null,
            beds: dto.beds ?? null,
            price: dto.price != null ? String(dto.price) : null,
            area_sqft: dto.area_sqft != null ? String(dto.area_sqft) : null,
            status: dto.status ?? 'available',
            created_by: { id: createdById } as User,
        });
        await this.unitRepository.save(unit);
        return this.findOne(unit.id);
    }

    async findAll(query: FindUnitsDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;

        const [[data, total], counts, types] = await Promise.all([
            this.unitRepository.findAndCount({
                where: this.buildWhere(query, query.status),
                relations: { project: true, lead: true },
                order: { created_at: query.sort === 'asc' ? 'ASC' : 'DESC' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            // Counted per status with the other filters applied, so the tabs match the filters.
            Promise.all(
                UNIT_STATUSES.map((status) => this.unitRepository.count({ where: this.buildWhere(query, status) })),
            ),
            this.unitRepository
                .createQueryBuilder('unit')
                .select('DISTINCT unit.unit_type', 'unit_type')
                .where('unit.unit_type IS NOT NULL')
                .orderBy('unit_type', 'ASC')
                .getRawMany<{ unit_type: string }>(),
        ]);

        return {
            data: data.map((unit) => this.serialize(unit)),
            total,
            page,
            limit,
            status_counts: Object.fromEntries(UNIT_STATUSES.map((status, i) => [status, counts[i]])),
            unit_types: types.map((row) => row.unit_type),
        };
    }

    async findOne(id: string) {
        const unit = await this.unitRepository.findOne({ where: { id }, relations: { project: true, lead: true } });
        if (!unit) throw new NotFoundException('Unit not found');
        return this.serialize(unit);
    }

    async setStarred(id: string, isStarred: boolean) {
        const result = await this.unitRepository.update({ id }, { is_starred: isStarred });
        if (!result.affected) throw new NotFoundException('Unit not found');
        return { id, is_starred: isStarred };
    }

    async update(id: string, dto: UpdateUnitDto) {
        // project is deliberately not loaded — a loaded relation would win over project_id on save.
        const unit = await this.unitRepository.findOne({ where: { id } });
        if (!unit) throw new NotFoundException('Unit not found');

        const projectId = dto.project_id ?? unit.project_id;
        const unitNumber = dto.unit_number?.trim() ?? unit.unit_number;
        if (dto.project_id !== undefined) await this.assertProjectExists(dto.project_id);
        if (projectId !== unit.project_id || unitNumber !== unit.unit_number) {
            await this.assertUnitNumberIsFree(projectId, unitNumber, id);
        }

        unit.project_id = projectId;
        unit.unit_number = unitNumber;
        if (dto.unit_type !== undefined) unit.unit_type = dto.unit_type.trim() || null;
        if (dto.features !== undefined) unit.features = dto.features.trim() || null;
        if (dto.floor !== undefined) unit.floor = dto.floor.trim() || null;
        if (dto.beds !== undefined) unit.beds = dto.beds;
        if (dto.price !== undefined) unit.price = String(dto.price);
        if (dto.area_sqft !== undefined) unit.area_sqft = String(dto.area_sqft);
        if (dto.status !== undefined) {
            unit.status = dto.status;
            // Putting a unit back on the market releases it from whoever held it.
            if (dto.status === 'available') unit.lead_id = null;
        }

        await this.unitRepository.save(unit);
        return this.findOne(id);
    }

    async remove(id: string) {
        const unit = await this.unitRepository.findOne({ where: { id } });
        if (!unit) throw new NotFoundException('Unit not found');
        await this.unitRepository.remove(unit);
    }

    async importCsv(buffer: Buffer, projectId: string, createdById: number): Promise<ImportResult> {
        await this.assertProjectExists(projectId);
        const rows = parseCsvBuffer(buffer);

        const existing = await this.unitRepository.find({ where: { project_id: projectId } });
        const taken = new Set(existing.map((unit) => unit.unit_number.toLowerCase()));

        const result: ImportResult = { total: rows.length, added: 0, skipped: 0, errors: [] };

        for (const [index, row] of rows.entries()) {
            // +2 so the number matches the spreadsheet line the user sees (1 = header).
            const rowNumber = index + 2;
            const unitNumber = cell(row, UNIT_ALIASES.unit_number);

            if (!unitNumber) {
                result.skipped += 1;
                result.errors.push({ row: rowNumber, reason: 'Missing unit number' });
                continue;
            }
            if (taken.has(unitNumber.toLowerCase())) {
                result.skipped += 1;
                result.errors.push({ row: rowNumber, reason: `Duplicate unit ${unitNumber}` });
                continue;
            }

            const rawStatus = cell(row, UNIT_ALIASES.status).toLowerCase();
            const status = STATUS_ALIASES[rawStatus] ?? rawStatus;
            const beds = toNumber(cell(row, UNIT_ALIASES.beds));

            await this.unitRepository.save(
                this.unitRepository.create({
                    project_id: projectId,
                    unit_number: unitNumber,
                    unit_type: cell(row, UNIT_ALIASES.unit_type) || null,
                    features: cell(row, UNIT_ALIASES.features) || null,
                    floor: cell(row, UNIT_ALIASES.floor) || null,
                    beds: beds ? Math.trunc(Number(beds)) : null,
                    price: toNumber(cell(row, UNIT_ALIASES.price)),
                    area_sqft: toNumber(cell(row, UNIT_ALIASES.area_sqft)),
                    status: UNIT_STATUSES.includes(status) ? status : 'available',
                    created_by: { id: createdById } as User,
                }),
            );
            taken.add(unitNumber.toLowerCase());
            result.added += 1;
        }

        return result;
    }

    private buildWhere(query: FindUnitsDto, status?: string) {
        const where: Record<string, unknown> = {};
        if (status) where.status = status;
        if (query.project_id) where.project_id = query.project_id;
        if (query.unit_type) where.unit_type = query.unit_type;
        if (query.search) where.unit_number = ILike(`%${query.search}%`);
        if (query.starred === 'true') where.is_starred = true;
        return where;
    }

    private async assertProjectExists(id: string) {
        const project = await this.projectRepository.findOne({ where: { id } });
        if (!project) throw new BadRequestException('project_id does not match an existing project');
    }

    private async assertUnitNumberIsFree(projectId: string, unitNumber: string, excludeId?: string) {
        const existing = await this.unitRepository.findOne({
            where: {
                project_id: projectId,
                unit_number: unitNumber.trim(),
                ...(excludeId ? { id: Not(excludeId) } : {}),
            },
        });
        if (existing) throw new ConflictException('This project already has a unit with that number');
    }

    private serialize(unit: Unit) {
        return {
            id: unit.id,
            project_id: unit.project_id,
            project: unit.project ? { id: unit.project.id, name: unit.project.project_name } : null,
            unit_number: unit.unit_number,
            unit_type: unit.unit_type,
            features: unit.features,
            floor: unit.floor,
            beds: unit.beds,
            price: unit.price != null ? Number(unit.price) : null,
            area_sqft: unit.area_sqft != null ? Number(unit.area_sqft) : null,
            status: unit.status,
            is_starred: unit.is_starred,
            lead: unit.lead
                ? { id: unit.lead.id, lead_no: unit.lead.lead_no, client_name: unit.lead.client_name }
                : null,
            created_at: unit.created_at,
            updated_at: unit.updated_at,
        };
    }
}
