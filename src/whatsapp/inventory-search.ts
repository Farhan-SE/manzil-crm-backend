import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, type SelectQueryBuilder } from 'typeorm';
import { Unit } from '../units/unit.entity.js';
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
    project: string;
    unitType: string | null;
    beds: number | null;
    price: number;
}

export interface InventorySearchResult {
    total: number;
    minPrice: number | null;
    maxPrice: number | null;
    shown: InventoryMatch[];
}

@Injectable()
export class InventorySearch {
    constructor(@InjectRepository(Unit) private readonly units: Repository<Unit>) { }

    /** Available, approved units in the current company that fit the enquiry. */
    async find(tenantId: string, enquiry: PropertyEnquiry): Promise<InventorySearchResult> {
        const qb = this.units
            .createQueryBuilder('unit')
            .innerJoin('unit.project', 'project')
            .leftJoin('interest', 'interest', 'interest.id = project.interest_id')
            .leftJoin('category', 'category', 'category.id = project.category_id')
            .leftJoin('location', 'location', 'location.id = project.location_id')
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
            // "DHA Phase 6 Lahore" should still find a project in "DHA Phase 6": every word long enough to mean something must appear somewhere.
            const words = enquiry.area.split(/[\s,]+/).filter((w) => w.length >= 3 && !/^(phase|block|sector|town)$/i.test(w));
            const place = "concat_ws(' ', project.project_name, project.location, project.city, location.name, location.city)";
            const specific = words.filter((w) => !/^(lahore|karachi|islamabad|rawalpindi)$/i.test(w));
            (specific.length ? specific : words).forEach((word, i) => {
                qb.andWhere(`${place} ILIKE :area${i}`, { [`area${i}`]: `%${word}%` });
            });
        }
        if (enquiry.portion === 'upper') qb.andWhere("concat_ws(' ', unit.unit_type, unit.floor) ILIKE ANY (ARRAY['%upper%', '%first%'])");
        if (enquiry.portion === 'lower') qb.andWhere("concat_ws(' ', unit.unit_type, unit.floor) ILIKE ANY (ARRAY['%lower%', '%ground%'])");
        if (enquiry.beds) qb.andWhere('unit.beds = :beds', { beds: enquiry.beds });
        if (enquiry.budget) qb.andWhere('unit.price <= :budget', { budget: enquiry.budget });

        const [totals, shown] = await Promise.all([
            qb.clone()
                .select('COUNT(*)', 'total')
                .addSelect('MIN(unit.price)', 'min')
                .addSelect('MAX(unit.price)', 'max')
                .getRawOne<{ total: string; min: string | null; max: string | null }>(),
            qb.clone()
                .select(['project.project_name AS project', 'unit.unit_type AS unit_type', 'unit.beds AS beds', 'unit.price AS price'])
                .orderBy('unit.price', 'ASC')
                .limit(MAX_LISTED)
                .getRawMany<{ project: string; unit_type: string | null; beds: number | null; price: string }>(),
        ]);

        return {
            total: Number(totals?.total ?? 0),
            minPrice: totals?.min != null ? Number(totals.min) : null,
            maxPrice: totals?.max != null ? Number(totals.max) : null,
            shown: shown.map((row) => ({ project: row.project, unitType: row.unit_type, beds: row.beds, price: Number(row.price) })),
        };
    }
}

function matchAny(qb: SelectQueryBuilder<Unit>, column: string, words: string[], name: string, allowUnset: boolean) {
    qb.andWhere(new Brackets((or) => {
        if (allowUnset) or.where(`${column} IS NULL`);
        words.forEach((word, i) => or.orWhere(`${column} ILIKE :${name}${i}`, { [`${name}${i}`]: `%${word}%` }));
    }));
}
