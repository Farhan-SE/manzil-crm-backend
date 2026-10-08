import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, ILike, In, LessThanOrEqual, MoreThanOrEqual, Not, Raw, Repository } from 'typeorm';
import { Lead, LEAD_STAGES, PIPELINE_STAGES } from './lead.entity.js';
import { User } from '../auth/user.entity.js';
import { CreateLeadDto } from './create-lead.dto.js';
import { UpdateLeadDto } from './update-lead.dto.js';
import { FindLeadsDto, FindPipelineDto, LEAD_TABS, type LeadTab } from './find-leads.dto.js';
import { Interest } from '../interests/interest.entity.js';
import { Category } from '../categories/category.entity.js';
import { Source } from '../sources/source.entity.js';
import { Customers } from '../customer/customer.entity.js';
import { cell, parseCsvBuffer, type ImportResult } from '../common/csv.js';
import { dueWindowSql } from '../follow-ups/due-windows.js';

const TEMPERATURES = ['HOT', 'WARM', 'COLD'];
/** No longer in play — won or lost. */
const SETTLED_STAGES = ['sold', 'lost'];

type LastTask = {
    text: string;
    task_type: string | null;
    sub_task: string | null;
    due_date: string;
    completed: boolean;
    /** When it was done, or logged if it is still open. */
    at: Date;
};
type LeadExtras = { lastTasks: Map<string, LastTask>; clientLeadCounts: Map<string, number> };

/** Accepted CSV header spellings, lowercased. Order within a list does not matter. */
const LEAD_ALIASES = {
    client_name: ['name', 'client', 'client name', 'customer', 'full name'],
    client_number: ['phone', 'number', 'mobile', 'contact', 'client number', 'whatsapp'],
    interest: ['interest', 'looking for'],
    category: ['category', 'property type'],
    source: ['source', 'lead source'],
    sub_source: ['sub source', 'sub-source'],
    city: ['city'],
    area: ['area', 'location'],
    budget: ['budget', 'price'],
    temperature: ['temperature', 'temp', 'priority'],
    stage: ['stage', 'status'],
};

@Injectable()
export class LeadsService {
    constructor(
        @InjectRepository(Lead)
        private leadRepository: Repository<Lead>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Interest)
        private interestRepository: Repository<Interest>,
        @InjectRepository(Category)
        private categoryRepository: Repository<Category>,
        @InjectRepository(Source)
        private sourceRepository: Repository<Source>,
        @InjectRepository(Customers)
        private customerRepository: Repository<Customers>,
    ) { }

    async create(dto: CreateLeadDto, createdById: number) {
        let assignedTo: User | null = null;
        if (dto.assigned_to_id) {
            assignedTo = await this.userRepository.findOne({ where: { id: dto.assigned_to_id } });
            if (!assignedTo) throw new BadRequestException('Assigning agent does not exist in the DB');
        }

        const customer = await this.customerRepository.findOne({ where: { id: dto.customer_id } });
        if (!customer) throw new BadRequestException('customer_id does not match an existing customer');

        const lead = this.leadRepository.create({
            customer_id: customer.id,
            client_name: customer.customer_name,
            client_number: customer.contact_number,
            interest_id: dto.interest_id ?? null,
            category_id: dto.category_id ?? null,
            city: dto.city ?? null,
            area: dto.area ?? null,
            budget: dto.budget != null ? String(dto.budget) : null,
            source_id: dto.source_id ?? null,
            sub_source: dto.sub_source ?? null,
            temperature: dto.temperature ?? 'WARM',
            assigned_to: assignedTo,
            created_by: { id: createdById } as User,
        });
        await this.leadRepository.save(lead);
        return this.findOne(lead.id);
    }

    async findAll(query: FindLeadsDto, requester: { userId: number; role: string }) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const [[data, total], counts] = await Promise.all([
            this.leadRepository.findAndCount({
                where: this.buildWhere(query, requester, query.tab ?? 'all'),
                relations: { assigned_to: true, created_by: true, interest: true, category: true, source: true, project: true, customer: true, unit: true },
                order: { lead_no: query.sort === 'asc' ? 'ASC' : 'DESC' },
                skip,
                take: limit,
            }),
            // Counted per tab with the other filters applied, so the tabs match the search.
            Promise.all(
                LEAD_TABS.map((tab) =>
                    this.leadRepository.count({ where: this.buildWhere(query, requester, tab) }),
                ),
            ),
        ]);

        const tab_counts = Object.fromEntries(LEAD_TABS.map((tab, i) => [tab, counts[i]]));
        return { data: await this.serializeMany(data), total, page, limit, tab_counts };
    }

    private buildWhere(query: FindLeadsDto, requester: { userId: number; role: string }, tab: LeadTab) {
        const { search, stage, temperature, interest_id, category_id, source_id } = query;

        const baseFilter: Record<string, unknown> = {};
        if (stage) baseFilter.stage = stage;
        if (temperature) baseFilter.temperature = temperature;
        if (interest_id) baseFilter.interest_id = interest_id;
        if (category_id) baseFilter.category_id = category_id;
        if (source_id) baseFilter.source_id = source_id;

        if (query.project_id) baseFilter.project_id = query.project_id;
        if (tab === 'watchlist' || query.starred === 'true') baseFilter.is_starred = true;
        if (tab === 'recommended') {
            baseFilter.temperature = 'HOT';
            if (!stage) baseFilter.stage = Not(In(SETTLED_STAGES));
        }

        // Each of these is a condition on the lead's follow-ups, so they share the one `id` slot.
        const taskClauses: ((alias: string) => string)[] = [];
        if (tab === 'new') {
            taskClauses.push((alias) => `NOT EXISTS (SELECT 1 FROM "follow_up" f WHERE f.lead_id = ${alias})`);
        }
        if (query.task_due) {
            const due = dueWindowSql('f')[query.task_due];
            taskClauses.push(
                (alias) => `EXISTS (SELECT 1 FROM "follow_up" f WHERE f.lead_id = ${alias} AND f.completed = false AND ${due})`,
            );
        }
        if (query.last_task) {
            taskClauses.push(
                // The alias must be followed by a space, or TypeORM leaves it unquoted.
                (alias) =>
                    `(SELECT f.task_type FROM "follow_up" f WHERE f.lead_id = ${alias} ` +
                    'ORDER BY f.completed DESC, COALESCE(f.completed_at, f.created_at) DESC LIMIT 1) = :lastTask',
            );
        }
        if (taskClauses.length > 0) {
            baseFilter.id = Raw(
                (alias) => taskClauses.map((clause) => clause(alias)).join(' AND '),
                query.last_task ? { lastTask: query.last_task } : {},
            );
        }

        const budgetFilter = this.buildBudgetFilter(query.budget_min, query.budget_max);
        if (budgetFilter) baseFilter.budget = budgetFilter;

        if (query.assigned_to_id) baseFilter.assigned_to = { id: query.assigned_to_id };
        // Applied last on purpose: an agent stays locked to their own leads whatever the query asks for.
        if (requester.role !== 'admin') {
            baseFilter.assigned_to = { id: requester.userId };
        }

        if (!search) return baseFilter;

        // Capped at 9 digits so a phone number typed into search can't overflow the int column.
        const searchNo = /^\d{1,9}$/.test(search) ? Number(search) : null;
        // A lead ID that isn't a number can't match anything.
        if (query.search_by === 'lead_id') return { ...baseFilter, lead_no: searchNo ?? -1 };
        if (query.search_by === 'name') return { ...baseFilter, client_name: ILike(`%${search}%`) };
        if (query.search_by === 'number') return { ...baseFilter, client_number: ILike(`%${search}%`) };

        const where: Record<string, unknown>[] = [
            { ...baseFilter, city: ILike(`%${search}%`) },
            { ...baseFilter, area: ILike(`%${search}%`) },
        ];
        if (query.search_by === 'city') return where;

        where.push(
            { ...baseFilter, client_name: ILike(`%${search}%`) },
            { ...baseFilter, client_number: ILike(`%${search}%`) },
        );
        if (searchNo !== null) where.push({ ...baseFilter, lead_no: searchNo });
        return where;
    }

    /** The board: per stage, how many deals and how much they are worth, plus the first few deals. */
    async findPipeline(query: FindPipelineDto, requester: { userId: number; role: string }) {
        const where: Record<string, unknown> = {};
        if (query.project_id) where.project_id = query.project_id;
        if (query.starred === 'true') where.is_starred = true;
        if (query.period) {
            // The space after the alias matters: TypeORM only quotes it when whitespace follows.
            where.created_at = Raw((alias) => `TO_CHAR(${alias} , 'YYYY-MM') = :period`, { period: query.period });
        }

        const assignee: Record<string, unknown> = {};
        if (query.assigned_to_id) assignee.id = query.assigned_to_id;
        if (query.region) assignee.region = query.region;
        // Applied last on purpose: an agent stays locked to their own leads whatever the query asks for.
        if (requester.role !== 'admin' || query.mine === 'true') assignee.id = requester.userId;
        if (Object.keys(assignee).length > 0) where.assigned_to = assignee;

        const relations = { assigned_to: true, created_by: true, interest: true, category: true, source: true, project: true, customer: true, unit: true };
        const order: Record<string, 'ASC' | 'DESC' | { direction: 'DESC'; nulls: 'LAST' }> =
            query.sort === 'value' ? { budget: { direction: 'DESC', nulls: 'LAST' }, lead_no: 'DESC' } : { lead_no: 'DESC' };

        const [totals, deals, regions] = await Promise.all([
            this.leadRepository.find({
                where: { ...where, stage: In([...PIPELINE_STAGES]) },
                select: { id: true, stage: true, budget: true },
            }),
            Promise.all(
                PIPELINE_STAGES.map((stage) =>
                    this.leadRepository.find({ where: { ...where, stage }, relations, order, take: query.per_stage ?? 3 }),
                ),
            ),
            this.userRepository
                .createQueryBuilder('user')
                .select('DISTINCT user.region', 'region')
                .where('user.region IS NOT NULL')
                .orderBy('region', 'ASC')
                .getRawMany<{ region: string }>(),
        ]);

        const serialized = await this.serializeMany(deals.flat());
        const nextTasks = await this.nextOpenTasks(serialized.map((lead) => lead.id));

        const stages = PIPELINE_STAGES.map((stage) => {
            const inStage = totals.filter((lead) => lead.stage === stage);
            return {
                id: stage,
                count: inStage.length,
                total: inStage.reduce((sum, lead) => sum + Number(lead.budget ?? 0), 0),
                leads: serialized
                    .filter((lead) => lead.stage === stage)
                    .map((lead) => ({ ...lead, next_task: nextTasks.get(lead.id) ?? null })),
            };
        });
        const active = stages.filter((stage) => stage.id !== 'sold');

        return {
            stages,
            active_count: active.reduce((sum, stage) => sum + stage.count, 0),
            active_value: active.reduce((sum, stage) => sum + stage.total, 0),
            regions: regions.map((row) => row.region),
        };
    }

    /** The soonest unfinished task on each lead — the board's "next step". */
    private async nextOpenTasks(leadIds: string[]) {
        type NextTask = { text: string; task_type: string | null; due_date: string; due_time: string };
        const nextTasks = new Map<string, NextTask>();
        if (leadIds.length === 0) return nextTasks;

        const rows = (await this.leadRepository.query(
            `SELECT DISTINCT ON (f.lead_id)
                    f.lead_id, f.text, f.task_type, f.due_date::text AS due_date, f.due_time::text AS due_time
             FROM "follow_up" f
             WHERE f.lead_id = ANY($1::uuid[]) AND f.completed = false
             ORDER BY f.lead_id, f.due_date, f.due_time`,
            [leadIds],
        )) as ({ lead_id: string } & NextTask)[];

        for (const { lead_id, ...task } of rows) nextTasks.set(lead_id, task);
        return nextTasks;
    }

    async findActive(limit: number, requester: { userId: number; role: string }) {
        const where: Record<string, unknown> = { stage: Not(In(SETTLED_STAGES)) };
        if (requester.role !== 'admin') {
            where.assigned_to = { id: requester.userId };
        }

        const leads = await this.leadRepository.find({
            where,
            relations: { assigned_to: true, created_by: true, interest: true, category: true, source: true, project: true, customer: true, unit: true },
            order: { created_at: 'DESC' },
            take: limit,
        });

        return this.serializeMany(leads);
    }

    async findOne(id: string) {
        const lead = await this.leadRepository.findOne({
            where: { id },
            relations: { assigned_to: true, created_by: true, interest: true, category: true, source: true, project: true, customer: true, unit: true },
        });
        if (!lead) throw new NotFoundException('Lead not found');
        return (await this.serializeMany([lead]))[0];
    }

    async setStarred(id: string, isStarred: boolean, requester: { userId: number; role: string }) {
        const lead = await this.leadRepository.findOne({ where: { id }, relations: { assigned_to: true } });
        if (!lead) throw new NotFoundException('Lead not found');
        if (requester.role !== 'admin' && lead.assigned_to?.id !== requester.userId) {
            throw new ForbiddenException('You can only star leads assigned to you');
        }

        await this.leadRepository.update({ id }, { is_starred: isStarred });
        return { id, is_starred: isStarred };
    }

    async update(id: string, dto: UpdateLeadDto, requester: { userId: number; role: string }) {
        const lead = await this.leadRepository.findOne({
            where: { id },
            relations: { assigned_to: true },
        });
        if (!lead) throw new NotFoundException('Lead not found');

        if (requester.role !== 'admin') {
            if (lead.assigned_to?.id !== requester.userId) {
                throw new ForbiddenException('You can only edit leads assigned to you');
            }
            // An agent works the lead (stage, temperature); how the client is classified
            // and who owns the lead stay with the admin. Compared against the stored value
            // so an unchanged field in the payload isn't treated as an edit.
            if (dto.assigned_to_id !== undefined && dto.assigned_to_id !== requester.userId) {
                throw new ForbiddenException('Only an admin can reassign a lead');
            }
            if (dto.interest_id !== undefined && dto.interest_id !== lead.interest_id) {
                throw new ForbiddenException("Only an admin can change a lead's interest");
            }
            if (dto.category_id !== undefined && dto.category_id !== lead.category_id) {
                throw new ForbiddenException("Only an admin can change a lead's category");
            }
        }

        if (dto.assigned_to_id !== undefined) {
            const assignedTo = await this.userRepository.findOne({ where: { id: dto.assigned_to_id } });
            if (!assignedTo) throw new BadRequestException('assigned_to_id does not match an existing user');
            lead.assigned_to = assignedTo;
        }

        if (dto.client_name !== undefined) lead.client_name = dto.client_name;
        if (dto.client_number !== undefined) lead.client_number = dto.client_number;
        if (dto.interest_id !== undefined) lead.interest_id = dto.interest_id;
        if (dto.category_id !== undefined) lead.category_id = dto.category_id;
        if (dto.city !== undefined) lead.city = dto.city;
        if (dto.area !== undefined) lead.area = dto.area;
        if (dto.budget !== undefined) lead.budget = String(dto.budget);
        if (dto.source_id !== undefined) lead.source_id = dto.source_id;
        if (dto.sub_source !== undefined) lead.sub_source = dto.sub_source || null;
        if (dto.temperature !== undefined) lead.temperature = dto.temperature;
        if (dto.stage !== undefined && dto.stage !== lead.stage) {
            lead.sold_at = dto.stage === 'sold' ? new Date() : null;
            lead.stage = dto.stage;
        }

        await this.leadRepository.save(lead);
        return this.findOne(id);
    }

    async remove(id: string) {
        const lead = await this.leadRepository.findOne({ where: { id } });
        if (!lead) throw new NotFoundException('Lead not found');
        // The unit keeps its status for an admin to review, but no longer points at a missing lead.
        await this.leadRepository.manager.update('Unit', { lead_id: id }, { lead_id: null });
        await this.leadRepository.remove(lead);
    }

    async importCsv(buffer: Buffer, createdById: number): Promise<ImportResult> {
        const rows = parseCsvBuffer(buffer);

        const [interests, categories, sources] = await Promise.all([
            this.interestRepository.find(),
            this.categoryRepository.find(),
            this.sourceRepository.find(),
        ]);
        const interestByName = new Map(interests.map((i) => [i.name.toLowerCase(), i.id]));
        const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
        const sourceByName = new Map(sources.map((s) => [s.name.toLowerCase(), s.id]));

        const result: ImportResult = { total: rows.length, added: 0, skipped: 0, errors: [] };

        // A spreadsheet has no customer id, so rows are linked to a customer that already has the number.
        const customers = await this.customerRepository.find();
        const customerIdByPhone = new Map<string, string>();
        for (const customer of customers) {
            for (const phone of [customer.contact_number, customer.alternate_contact_number]) {
                const digits = phone?.replace(/\D/g, '');
                if (digits) customerIdByPhone.set(digits, customer.id);
            }
        }

        for (const [index, row] of rows.entries()) {
            // +2 so the number matches the spreadsheet line the user sees (1 = header).
            const rowNumber = index + 2;
            const name = cell(row, LEAD_ALIASES.client_name);
            const number = cell(row, LEAD_ALIASES.client_number);

            if (!name || !number) {
                result.skipped += 1;
                result.errors.push({ row: rowNumber, reason: 'Missing client name or number' });
                continue;
            }

            // No duplicate-number check on purpose: one client can raise several leads
            // over time, and POST /leads allows it too.
            const rawTemp = cell(row, LEAD_ALIASES.temperature).toUpperCase();
            const rawStage = cell(row, LEAD_ALIASES.stage).toLowerCase().replace(/\s+/g, '_');
            const rawBudget = cell(row, LEAD_ALIASES.budget).replace(/[^\d.]/g, '');

            const lead = this.leadRepository.create({
                customer_id: customerIdByPhone.get(number.replace(/\D/g, '')) ?? null,
                client_name: name,
                client_number: number,
                interest_id: interestByName.get(cell(row, LEAD_ALIASES.interest).toLowerCase()) ?? null,
                category_id: categoryByName.get(cell(row, LEAD_ALIASES.category).toLowerCase()) ?? null,
                source_id: sourceByName.get(cell(row, LEAD_ALIASES.source).toLowerCase()) ?? null,
                sub_source: cell(row, LEAD_ALIASES.sub_source) || null,
                city: cell(row, LEAD_ALIASES.city) || null,
                area: cell(row, LEAD_ALIASES.area) || null,
                budget: rawBudget ? rawBudget : null,
                temperature: TEMPERATURES.includes(rawTemp) ? rawTemp : 'WARM',
                stage: LEAD_STAGES.includes(rawStage) ? rawStage : 'inquiry',
                assigned_to: null,
                created_by: { id: createdById } as User,
            });

            await this.leadRepository.save(lead);
            result.added += 1;
        }

        return result;
    }

    private buildBudgetFilter(min?: number, max?: number) {
        if (min != null && max != null) return Between(min, max);
        if (min != null) return MoreThanOrEqual(min);
        if (max != null) return LessThanOrEqual(max);
        return null;
    }

    /** Adds the per-row extras the list shows: the latest follow-up and how many leads the client has. */
    private async serializeMany(leads: Lead[]) {
        const extras: LeadExtras = { lastTasks: new Map(), clientLeadCounts: new Map() };
        if (leads.length === 0) return [];

        const customerIds = [...new Set(leads.map((lead) => lead.customer_id).filter((id) => id !== null))];
        const [tasks, counts] = await Promise.all([
            this.leadRepository.query(
                // A completed task wins over a scheduled one: "last task" is what was last done.
                `SELECT DISTINCT ON (f.lead_id)
                        f.lead_id, f.text, f.task_type, f.sub_task, f.due_date::text AS due_date, f.completed,
                        COALESCE(f.completed_at, f.created_at) AS at
                 FROM "follow_up" f
                 WHERE f.lead_id = ANY($1::uuid[])
                 ORDER BY f.lead_id, f.completed DESC, COALESCE(f.completed_at, f.created_at) DESC`,
                [leads.map((lead) => lead.id)],
            ) as Promise<({ lead_id: string } & LastTask)[]>,
            customerIds.length === 0
                ? []
                : this.leadRepository
                    .createQueryBuilder('lead')
                    .select('lead.customer_id', 'customer_id')
                    .addSelect('COUNT(*)', 'count')
                    .where('lead.customer_id IN (:...customerIds)', { customerIds })
                    .groupBy('lead.customer_id')
                    .getRawMany<{ customer_id: string; count: string }>(),
        ]);

        for (const task of tasks) {
            extras.lastTasks.set(task.lead_id, {
                text: task.text,
                task_type: task.task_type,
                sub_task: task.sub_task,
                due_date: task.due_date,
                completed: task.completed,
                at: task.at,
            });
        }
        for (const row of counts) extras.clientLeadCounts.set(row.customer_id, Number(row.count));

        return leads.map((lead) => this.serialize(lead, extras));
    }

    private serialize(lead: Lead, extras: LeadExtras) {
        return {
            id: lead.id,
            lead_no: lead.lead_no,
            sub_source: lead.sub_source,
            project_id: lead.project_id,
            project: lead.project ? { id: lead.project.id, name: lead.project.project_name } : null,
            unit_id: lead.unit_id,
            unit: lead.unit
                ? { id: lead.unit.id, unit_number: lead.unit.unit_number, status: lead.unit.status }
                : null,
            is_starred: lead.is_starred,
            last_task: extras.lastTasks.get(lead.id) ?? null,
            // An unlinked lead only knows about itself.
            client_lead_count: (lead.customer_id && extras.clientLeadCounts.get(lead.customer_id)) || 1,
            customer_id: lead.customer_id,
            customer: lead.customer
                ? {
                    id: lead.customer.id,
                    customer_no: lead.customer.customer_no,
                    customer_name: lead.customer.customer_name,
                    gender: lead.customer.gender,
                }
                : null,
            client_name: lead.client_name,
            client_number: lead.client_number,
            interest_id: lead.interest_id,
            interest: lead.interest ? { id: lead.interest.id, name: lead.interest.name } : null,
            category_id: lead.category_id,
            category: lead.category ? { id: lead.category.id, name: lead.category.name } : null,
            city: lead.city,
            area: lead.area,
            budget: lead.budget != null ? Number(lead.budget) : null,
            source_id: lead.source_id,
            source: lead.source ? { id: lead.source.id, name: lead.source.name } : null,
            temperature: lead.temperature,
            stage: lead.stage,
            sold_at: lead.sold_at,
            assigned_to: lead.assigned_to
                ? {
                    id: lead.assigned_to.id,
                    first_name: lead.assigned_to.first_name,
                    last_name: lead.assigned_to.last_name,
                    team: lead.assigned_to.team,
                }
                : null,
            created_by: lead.created_by
                ? {
                    id: lead.created_by.id,
                    first_name: lead.created_by.first_name,
                    last_name: lead.created_by.last_name,
                }
                : null,
            created_at: lead.created_at,
            updated_at: lead.updated_at,
        };
    }
}
