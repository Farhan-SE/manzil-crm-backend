import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, type SelectQueryBuilder } from 'typeorm';
import { MediaService } from '../media/media.service.js';
import { Unit } from '../units/unit.entity.js';
import { areaWords, placeMatches } from './place-match.js';
import type { PropertyEnquiry } from './property-chat.client.js';

const MAX_LISTED = 3;

// The names a company might give the interest or category the chatbot means. A project with neither
// set still matches, so an inventory that isn't fully labelled doesn't hide everything.
const PURPOSE_WORDS = { rent: ['rent', 'kiraya', 'lease'], buy: ['buy', 'sale', 'purchase', 'invest'] };
const TYPE_WORDS = {
    house: ['house', 'home', 'residential', 'ghar', 'portion', 'villa', 'bungalow'],
    apartment: ['apartment', 'flat', 'residential'],
    plot: ['plot', 'land'],
    commercial: ['commercial', 'shop', 'office', 'plaza'],
};

export interface InventoryMatch {
    unitId: string;
    unitNumber: string;
    project: string;
    unitType: string | null;
    beds: number | null;
    price: number;
    /** Photos and videos the client can be sent, the project's included. */
    mediaCount: number;
}

export interface InventorySearchResult {
    total: number;
    minPrice: number | null;
    maxPrice: number | null;
    shown: InventoryMatch[];
}

/** What the chatbot sent; portionsInstead when no full house matched and portions were offered. */
export type OfferedUnits = InventorySearchResult & { portionsInstead: boolean };

@Injectable()
export class InventorySearch {
    constructor(
        @InjectRepository(Unit) private readonly units: Repository<Unit>,
        private readonly media: MediaService,
    ) { }

    /** Available, approved units in the current company that fit the enquiry. */
    async find(tenantId: string, enquiry: PropertyEnquiry): Promise<InventorySearchResult> {
        const qb = this.units
            .createQueryBuilder('unit')
            .innerJoin('unit.project', 'project')
            .leftJoin('interest', 'interest', 'interest.id = project.interest_id')
            .leftJoin('category', 'category', 'category.id = project.category_id')
            .where('unit.tenant_id = :tenantId', { tenantId })
            .andWhere("unit.status = 'available'")
            .andWhere("unit.approval_status = 'approved'")
            .andWhere('project.is_active = true')
            .andWhere('unit.price IS NOT NULL');

        if (enquiry.purpose) matchAny(qb, 'interest.name', PURPOSE_WORDS[enquiry.purpose], 'purpose', true);
        if (enquiry.property_type) {
            const words = TYPE_WORDS[enquiry.property_type];
            qb.andWhere(new Brackets((or) => {
                or.where('category.id IS NULL');
                words.forEach((word, i) => {
                    or.orWhere(`category.name ILIKE :type${i}`, { [`type${i}`]: `%${word}%` });
                    or.orWhere(`unit.unit_type ILIKE :type${i}`);
                });
            }));
        }
        if (enquiry.area) {
            const projectIds = await this.projectsIn(tenantId, enquiry.area);
            if (projectIds?.length === 0) return { total: 0, minPrice: null, maxPrice: null, shown: [] };
            if (projectIds) qb.andWhere('project.id IN (:...projectIds)', { projectIds });
        }
        if (enquiry.portion === 'upper') qb.andWhere("concat_ws(' ', unit.unit_type, unit.floor) ILIKE ANY (ARRAY['%upper%', '%first%'])");
        if (enquiry.portion === 'lower') qb.andWhere("concat_ws(' ', unit.unit_type, unit.floor) ILIKE ANY (ARRAY['%lower%', '%ground%'])");
        if (enquiry.portion === 'full') qb.andWhere("coalesce(unit.unit_type, '') NOT ILIKE ALL (ARRAY['%portion%', '%upper%', '%lower%'])");
        if (enquiry.beds) qb.andWhere('unit.beds = :beds', { beds: enquiry.beds });
        if (enquiry.budget) qb.andWhere('unit.price <= :budget', { budget: enquiry.budget });

        const [totals, shown] = await Promise.all([
            qb.clone()
                .select('COUNT(*)', 'total')
                .addSelect('MIN(unit.price)', 'min')
                .addSelect('MAX(unit.price)', 'max')
                .getRawOne<{ total: string; min: string | null; max: string | null }>(),
            qb.clone()
                .select(['unit.id AS unit_id', 'unit.unit_number AS unit_number', 'project.id AS project_id', 'project.project_name AS project', 'unit.unit_type AS unit_type', 'unit.beds AS beds', 'unit.price AS price'])
                .orderBy('unit.price', 'ASC')
                .limit(MAX_LISTED)
                .getRawMany<{ unit_id: string; unit_number: string; project_id: string; project: string; unit_type: string | null; beds: number | null; price: string }>(),
        ]);

        const mediaCounts = await this.media.countForUnits(tenantId, shown.map((row) => ({ id: row.unit_id, projectId: row.project_id })));
        return {
            total: Number(totals?.total ?? 0),
            minPrice: totals?.min != null ? Number(totals.min) : null,
            maxPrice: totals?.max != null ? Number(totals.max) : null,
            shown: shown.map((row) => ({ unitId: row.unit_id, unitNumber: row.unit_number, project: row.project, unitType: row.unit_type, beds: row.beds, price: Number(row.price), mediaCount: mediaCounts.get(row.unit_id) ?? 0 })),
        };
    }

    /** Active projects whose name or location fits the area, forgiving typos; null when the area says nothing usable. */
    private async projectsIn(tenantId: string, area: string): Promise<string[] | null> {
        const words = areaWords(area);
        if (!words.length) return null;
        const projects = await this.units.manager
            .createQueryBuilder()
            .select('project.id', 'id')
            .addSelect("concat_ws(' ', project.project_name, project.location, project.city, location.name, location.city)", 'place')
            .from('partner_project', 'project')
            .leftJoin('location', 'location', 'location.id = project.location_id')
            .where('project.tenant_id = :tenantId', { tenantId })
            .andWhere('project.is_active = true')
            .getRawMany<{ id: string; place: string }>();
        return projects.filter((project) => placeMatches(project.place, words)).map((project) => project.id);
    }
}

function matchAny(qb: SelectQueryBuilder<Unit>, column: string, words: string[], name: string, allowUnset: boolean) {
    qb.andWhere(new Brackets((or) => {
        if (allowUnset) or.where(`${column} IS NULL`);
        words.forEach((word, i) => or.orWhere(`${column} ILIKE :${name}${i}`, { [`${name}${i}`]: `%${word}%` }));
    }));
}
