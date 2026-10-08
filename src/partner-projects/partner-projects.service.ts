import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartnerProject } from './partner-project.entity.js';
import { User } from '../auth/user.entity.js';
import { CreatePartnerProjectDto } from './create-partner-project.dto.js';
import { UpdatePartnerProjectDto } from './update-partner-project.dto.js';
import { FindPartnerProjectsDto } from './find-partner-projects.dto.js';
import { LocationsService } from '../locations/locations.service.js';

type UnitStats = {
    unit_types: string[];
    total_units: number;
    available_units: number;
    price_min: number | null;
    price_max: number | null;
};

const NO_UNITS: UnitStats = { unit_types: [], total_units: 0, available_units: 0, price_min: null, price_max: null };

@Injectable()
export class PartnerProjectsService {
    constructor(
        @InjectRepository(PartnerProject)
        private projectRepository: Repository<PartnerProject>,
        private locationsService: LocationsService,
    ) { }

    async create(dto: CreatePartnerProjectDto, createdById: number) {
        const project = this.projectRepository.create({
            project_name: dto.project_name,
            developer: dto.developer ?? null,
            category_id: dto.category_id ?? null,
            interest_id: dto.interest_id ?? null,
            city: dto.city ?? null,
            location: dto.location ?? null,
            location_id: await this.locationsService.ensure(dto.location ?? null, dto.city ?? null),
            price: dto.price != null ? String(dto.price) : null,
            description: dto.description ?? null,
            project_type: dto.project_type ?? 'exclusive',
            is_active: dto.is_active ?? true,
            grade: dto.grade?.trim() || null,
            token_amount: dto.token_amount != null ? String(dto.token_amount) : null,
            pdp_percent: dto.pdp_percent != null ? String(dto.pdp_percent) : null,
            cdp_percent: dto.cdp_percent != null ? String(dto.cdp_percent) : null,
            created_by: { id: createdById } as User,
        });
        await this.projectRepository.save(project);
        return this.findOne(project.id);
    }

    /** Every project's id and name, for filter dropdowns. */
    findOptions() {
        return this.projectRepository.find({ select: { id: true, project_name: true }, order: { project_name: 'ASC' } });
    }

    async findAll(query: FindPartnerProjectsDto) {
        const qb = this.projectRepository
            .createQueryBuilder('project')
            .orderBy('project.created_at', 'DESC');

        if (query.search) {
            qb.andWhere(
                '(project.project_name ILIKE :search OR project.developer ILIKE :search OR project.city ILIKE :search OR project.location ILIKE :search)',
                { search: `%${query.search}%` },
            );
        }
        if (query.category_id) qb.andWhere('project.category_id = :categoryId', { categoryId: query.category_id });
        if (query.interest_id) qb.andWhere('project.interest_id = :interestId', { interestId: query.interest_id });
        if (query.city) qb.andWhere('project.city ILIKE :city', { city: `%${query.city}%` });
        if (query.price_min != null) qb.andWhere('project.price >= :priceMin', { priceMin: query.price_min });
        if (query.price_max != null) qb.andWhere('project.price <= :priceMax', { priceMax: query.price_max });

        qb.take(query.limit ?? 100);

        const projects = await qb.getMany();
        const stats = await this.unitStats(projects.map((project) => project.id));
        return projects.map((project) => this.serialize(project, stats));
    }

    async findOne(id: string) {
        const project = await this.projectRepository.findOne({ where: { id } });
        if (!project) throw new NotFoundException('Partner project not found');
        return this.serialize(project, await this.unitStats([id]));
    }

    async setStarred(id: string, isStarred: boolean) {
        const result = await this.projectRepository.update({ id }, { is_starred: isStarred });
        if (!result.affected) throw new NotFoundException('Partner project not found');
        return { id, is_starred: isStarred };
    }

    async update(id: string, dto: UpdatePartnerProjectDto) {
        const project = await this.projectRepository.findOne({ where: { id } });
        if (!project) throw new NotFoundException('Partner project not found');

        if (dto.project_name !== undefined) project.project_name = dto.project_name;
        if (dto.developer !== undefined) project.developer = dto.developer;
        if (dto.category_id !== undefined) project.category_id = dto.category_id;
        if (dto.interest_id !== undefined) project.interest_id = dto.interest_id;
        if (dto.city !== undefined) project.city = dto.city;
        if (dto.location !== undefined) project.location = dto.location;
        if (dto.city !== undefined || dto.location !== undefined) {
            project.location_id = await this.locationsService.ensure(project.location, project.city);
        }
        if (dto.price !== undefined) project.price = String(dto.price);
        if (dto.description !== undefined) project.description = dto.description;
        if (dto.project_type !== undefined) project.project_type = dto.project_type;
        if (dto.is_active !== undefined) project.is_active = dto.is_active;
        if (dto.grade !== undefined) project.grade = dto.grade.trim() || null;
        if (dto.token_amount !== undefined) project.token_amount = String(dto.token_amount);
        if (dto.pdp_percent !== undefined) project.pdp_percent = String(dto.pdp_percent);
        if (dto.cdp_percent !== undefined) project.cdp_percent = String(dto.cdp_percent);

        await this.projectRepository.save(project);
        return this.findOne(id);
    }

    async remove(id: string) {
        const project = await this.projectRepository.findOne({ where: { id } });
        if (!project) throw new NotFoundException('Partner project not found');
        await this.projectRepository.remove(project);
    }

    /** What each project's units add up to — the list shows these instead of making callers page through units. */
    private async unitStats(projectIds: string[]) {
        const stats = new Map<string, UnitStats>();
        if (projectIds.length === 0) return stats;

        const rows: {
            project_id: string;
            unit_types: string[] | null;
            total_units: string;
            available_units: string;
            price_min: string | null;
            price_max: string | null;
        }[] = await this.projectRepository.query(
            `SELECT u.project_id,
                    array_agg(DISTINCT u.unit_type) FILTER (WHERE u.unit_type IS NOT NULL) AS unit_types,
                    COUNT(*) AS total_units,
                    COUNT(*) FILTER (WHERE u.status = 'available') AS available_units,
                    MIN(u.price) AS price_min,
                    MAX(u.price) AS price_max
             FROM "unit" u
             WHERE u.project_id = ANY($1::uuid[])
             GROUP BY u.project_id`,
            [projectIds],
        );

        for (const row of rows) {
            stats.set(row.project_id, {
                unit_types: row.unit_types ?? [],
                total_units: Number(row.total_units),
                available_units: Number(row.available_units),
                price_min: row.price_min != null ? Number(row.price_min) : null,
                price_max: row.price_max != null ? Number(row.price_max) : null,
            });
        }
        return stats;
    }

    private serialize(project: PartnerProject, stats: Map<string, UnitStats>) {
        return {
            ...(stats.get(project.id) ?? NO_UNITS),
            project_type: project.project_type,
            is_active: project.is_active,
            is_starred: project.is_starred,
            grade: project.grade,
            token_amount: project.token_amount != null ? Number(project.token_amount) : null,
            pdp_percent: project.pdp_percent != null ? Number(project.pdp_percent) : null,
            cdp_percent: project.cdp_percent != null ? Number(project.cdp_percent) : null,
            id: project.id,
            project_name: project.project_name,
            developer: project.developer,
            category_id: project.category_id,
            interest_id: project.interest_id,
            city: project.city,
            location: project.location,
            price: project.price != null ? Number(project.price) : null,
            description: project.description,
            created_at: project.created_at,
            updated_at: project.updated_at,
        };
    }
}
