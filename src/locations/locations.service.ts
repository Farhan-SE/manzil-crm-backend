import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './location.entity.js';
import { FindLocationsDto, LOCATION_TABS, UpdateLocationDto, type LocationTab } from './location.dto.js';

type Coverage = { projects: number; available_units: number; project: string | null; unit_types: string | null };

const NO_COVERAGE: Coverage = { projects: 0, available_units: 0, project: null, unit_types: null };

@Injectable()
export class LocationsService {
    constructor(
        @InjectRepository(Location)
        private locationRepository: Repository<Location>,
    ) { }

    async findAll(query: FindLocationsDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;

        const inTab = (tab: LocationTab) => {
            const qb = this.locationRepository.createQueryBuilder('location');
            if (tab !== 'all') qb.andWhere('location.is_active = :isActive', { isActive: tab === 'active' });
            if (query.city) qb.andWhere('location.city = :city', { city: query.city });
            if (query.region) qb.andWhere('location.region = :region', { region: query.region });
            if (query.starred === 'true') qb.andWhere('location.is_starred = true');
            if (query.project_id) {
                qb.andWhere(
                    'EXISTS (SELECT 1 FROM "partner_project" p WHERE p.location_id = location.id AND p.id = :projectId)',
                    { projectId: query.project_id },
                );
            }
            if (query.search) {
                // "LOC-001", "loc1" and "1" all find the location by its number.
                const locationNo = /^(?:loc-?)?0*(\d{1,9})$/i.exec(query.search.trim())?.[1];
                qb.andWhere('(location.name ILIKE :search OR location.location_no = :locationNo)', {
                    search: `%${query.search}%`,
                    locationNo: locationNo ? Number(locationNo) : -1,
                });
            }
            return qb;
        };

        const [[rows, total], counts, cities, regions] = await Promise.all([
            inTab(query.status ?? 'all')
                .orderBy('location.location_no', query.sort === 'desc' ? 'DESC' : 'ASC')
                .skip((page - 1) * limit)
                .take(limit)
                .getManyAndCount(),
            // Counted per tab with the other filters applied, so the tabs match the search.
            Promise.all(LOCATION_TABS.map((tab) => inTab(tab).getCount())),
            this.distinct('city'),
            this.distinct('region'),
        ]);

        const coverage = await this.coverageFor(rows.map((row) => row.id));
        return {
            data: rows.map((row) => this.serialize(row, coverage)),
            total,
            page,
            limit,
            status_counts: Object.fromEntries(LOCATION_TABS.map((tab, i) => [tab, counts[i]])),
            cities,
            regions,
        };
    }

    async update(id: string, dto: UpdateLocationDto) {
        const location = await this.locationRepository.findOne({ where: { id } });
        if (!location) throw new NotFoundException('Location not found');

        if (dto.name !== undefined) location.name = dto.name.trim();
        if (dto.city !== undefined) location.city = dto.city.trim() || null;
        if (dto.region !== undefined) location.region = dto.region.trim() || null;
        if (dto.department !== undefined) location.department = dto.department.trim() || null;
        if (dto.is_active !== undefined) location.is_active = dto.is_active;

        await this.locationRepository.save(location);
        return this.serialize(location, await this.coverageFor([id]));
    }

    async setStarred(id: string, isStarred: boolean) {
        const result = await this.locationRepository.update({ id }, { is_starred: isStarred });
        if (!result.affected) throw new NotFoundException('Location not found');
        return { id, is_starred: isStarred };
    }

    /** The location a project's free-text place refers to, created the first time that place is named. */
    async ensure(name: string | null, city: string | null) {
        const trimmedName = name?.trim();
        if (!trimmedName) return null;
        const trimmedCity = city?.trim() || null;

        const qb = this.locationRepository
            .createQueryBuilder('location')
            .where('LOWER(location.name) = LOWER(:name)', { name: trimmedName });
        if (trimmedCity) qb.andWhere('LOWER(location.city) = LOWER(:city)', { city: trimmedCity });
        else qb.andWhere('location.city IS NULL');

        const existing = await qb.getOne();
        if (existing) return existing.id;

        const created = await this.locationRepository.save(
            this.locationRepository.create({ name: trimmedName, city: trimmedCity }),
        );
        return created.id;
    }

    private async distinct(column: 'city' | 'region') {
        const rows = await this.locationRepository
            .createQueryBuilder('location')
            .select(`DISTINCT location.${column}`, 'value')
            .where(`location.${column} IS NOT NULL`)
            .orderBy('value', 'ASC')
            .getRawMany<{ value: string }>();
        return rows.map((row) => row.value);
    }

    /** What sits in each location: how many projects, how many units are free, and its biggest project. */
    private async coverageFor(locationIds: string[]) {
        const coverage = new Map<string, Coverage>();
        if (locationIds.length === 0) return coverage;

        const [totals, leading] = await Promise.all([
            this.locationRepository.query(
                `SELECT p.location_id,
                        COUNT(DISTINCT p.id) AS projects,
                        COUNT(u.id) FILTER (WHERE u.status = 'available') AS available_units
                 FROM "partner_project" p
                 LEFT JOIN "unit" u ON u.project_id = p.id
                 WHERE p.location_id = ANY($1::uuid[])
                 GROUP BY p.location_id`,
                [locationIds],
            ) as Promise<{ location_id: string; projects: string; available_units: string }[]>,
            this.locationRepository.query(
                `SELECT DISTINCT ON (p.location_id)
                        p.location_id,
                        p.project_name,
                        (SELECT string_agg(DISTINCT u.unit_type, ', ') FROM "unit" u WHERE u.project_id = p.id) AS unit_types,
                        (SELECT COUNT(*) FROM "unit" u WHERE u.project_id = p.id) AS unit_count
                 FROM "partner_project" p
                 WHERE p.location_id = ANY($1::uuid[])
                 ORDER BY p.location_id, unit_count DESC, p.created_at`,
                [locationIds],
            ) as Promise<{ location_id: string; project_name: string; unit_types: string | null }[]>,
        ]);

        for (const row of totals) {
            coverage.set(row.location_id, {
                ...NO_COVERAGE,
                projects: Number(row.projects),
                available_units: Number(row.available_units),
            });
        }
        for (const row of leading) {
            const entry = coverage.get(row.location_id) ?? { ...NO_COVERAGE };
            coverage.set(row.location_id, { ...entry, project: row.project_name, unit_types: row.unit_types });
        }
        return coverage;
    }

    private serialize(location: Location, coverage: Map<string, Coverage>) {
        const covered = coverage.get(location.id) ?? NO_COVERAGE;
        return {
            id: location.id,
            location_no: location.location_no,
            name: location.name,
            city: location.city,
            region: location.region,
            department: location.department,
            is_active: location.is_active,
            is_starred: location.is_starred,
            project_count: covered.projects,
            available_units: covered.available_units,
            // The project with the most units stands for what the location offers.
            coverage_project: covered.project,
            coverage_unit_types: covered.unit_types,
            created_at: location.created_at,
            updated_at: location.updated_at,
        };
    }
}
