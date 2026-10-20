import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Raw, Repository } from 'typeorm';
import { CUSTOMER_STAGES, Customers } from './customer.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { User } from '../auth/user.entity.js';
import { Source } from '../sources/source.entity.js';
import { PartnerProject } from '../partner-projects/partner-project.entity.js';
import { needsPayment } from '../leads/stage-change.js';
import { CreateCustomerDto } from './create-customer.dto.js';
import { UpdateCustomerDto } from './update-customer.dto.js';
import { FindCustomersDto } from './find-customers.dto.js';
import type { ImportResult } from '../common/csv.js';
import { NORMALIZED_PHONE, normalizePhone } from './customer-import.js';
import { importClients } from './import-clients.js';
import { tenantId } from '../tenants/tenant-context.js';
import { assertReaches, can, scopedUserIds, type Requester } from '../access/access.js';


const DUPLICATE_PHONE = 'This phone number is already assigned to an agent';

/** Whether the client was added for the project, or has a lead on it. `alias` is the customer's id column. */
const IN_PROJECT = (alias: string) =>
    `(EXISTS (SELECT 1 FROM "customers" c WHERE c.id = ${alias} AND c.project_id = :projectId)` +
    ` OR EXISTS (SELECT 1 FROM "lead" l WHERE l.customer_id = ${alias} AND l.project_id = :projectId))`;

/** Whether the client's own project or a lead's project is named like :projectName. */
const PROJECT_NAMED = (alias: string) =>
    `(EXISTS (SELECT 1 FROM "customers" c JOIN "partner_project" p ON p.id = c.project_id WHERE c.id = ${alias} AND p.project_name ILIKE :projectName)` +
    ` OR EXISTS (SELECT 1 FROM "lead" l JOIN "partner_project" p ON p.id = l.project_id WHERE l.customer_id = ${alias} AND p.project_name ILIKE :projectName))`;

type LeadSummary = Map<string, { count: number; latestLeadId: string; project: { id: string; name: string } | null }>;

@Injectable()
export class CustomerService {
    constructor(
        @InjectRepository(Customers)
        private customerRepository: Repository<Customers>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(PartnerProject)
        private projectRepository: Repository<PartnerProject>,
        @InjectRepository(Source)
        private sourceRepository: Repository<Source>,
        @InjectRepository(Lead)
        private leadRepository: Repository<Lead>,
    ) { }

    async create(dto: CreateCustomerDto, requester: Requester) {
        const createdById = requester.userId;
        // Without customers.assign the client is the creator's own.
        if (!can(requester, 'customers.assign')) dto.assigned_to_id = requester.userId;
        await this.assertPhoneIsFree(dto.contact_number);
        const project = await this.projectRepository.findOne({ where: { id: dto.project_id, tenant_id: tenantId() } });
        if (!project) throw new BadRequestException('project_id does not match an existing project');
        const firstName = dto.first_name?.trim() || null;
        const lastName = dto.last_name?.trim() || null;

        let assignedTo: User | null = null;
        if (dto.assigned_to_id) {
            assignedTo = await this.userRepository.findOne({ where: { id: dto.assigned_to_id, tenant_id: tenantId() } });
            if (!assignedTo) throw new BadRequestException('Assigning agent does not exist in the DB');
        }

        if (dto.source_id) await this.assertSourceExists(dto.source_id);

        const customer = this.customerRepository.create({
            customer_name: [firstName, lastName].filter(Boolean).join(' ') || dto.customer_name!.trim(),
            first_name: firstName,
            last_name: lastName,
            cnic_number: dto.cnic_number?.trim() || null,
            contact_number: dto.contact_number,
            gender: dto.gender ?? null,
            alternate_contact_number: dto.alternate_contact_number ?? null,
            email: dto.email ?? null,
            address: dto.address ?? null,
            city: dto.city ?? null,
            relation_type: dto.relation_type ?? null,
            source_id: dto.source_id ?? null,
            sub_source: dto.sub_source ?? null,
            project_id: project.id,
            country: dto.country?.toUpperCase() ?? 'PK',
            stage: dto.stage ?? 'inquiry',
            customer_since: dto.customer_since ? new Date(dto.customer_since) : null,
            notes: dto.notes ?? null,
            assigned_to: assignedTo,
            created_by: { id: createdById } as User,
        });
        try {
            await this.customerRepository.save(customer);
        } catch (error) {
            // Two people adding the same number at once: the unique index stops the second.
            if ((error as { code?: string }).code === '23505') {
                throw new ConflictException(DUPLICATE_PHONE);
            }
            throw error;
        }
        await this.openLead(customer, project, createdById);
        return this.findOne(customer.id, requester);
    }

    /** A client added with a project starts with one lead on it, owned by the same agent. */
    private async openLead(customer: Customers, project: PartnerProject, createdById?: number) {
        await this.leadRepository.save(
            this.leadRepository.create({
                customer_id: customer.id,
                client_name: customer.customer_name,
                client_number: customer.contact_number,
                city: customer.city,
                area: project.location,
                source_id: customer.source_id,
                sub_source: customer.sub_source,
                project_id: project.id,
                interest_id: project.interest_id,
                category_id: project.category_id,
                stage: customer.stage,
                sold_at: customer.stage === 'sold' ? new Date() : null,
                assigned_to: customer.assigned_to,
                created_by: createdById ? ({ id: createdById } as User) : null,
            }),
        );
    }

    /** Shared like inventory — every agent sees every customer. Editing stays with the assigned agent. */
    /** Admins see every client; anyone else the clients they added or that are assigned to them. */
    async findAll(query: FindCustomersDto, requester: Requester) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const owners = await scopedUserIds(this.customerRepository.manager, requester, 'customers.view');
        const [[data, total], counts] = await Promise.all([
            this.customerRepository.findAndCount({
                where: this.visibleTo(this.buildWhere(query, query.stage), owners),
                relations: { assigned_to: true, source: true, project: true },
                order: { customer_no: query.sort === 'asc' ? 'ASC' : 'DESC' },
                skip,
                take: limit,
            }),
            // Counted per stage with the other filters applied, so the tabs match the search.
            Promise.all(
                CUSTOMER_STAGES.map((stage) =>
                    this.customerRepository.count({ where: this.visibleTo(this.buildWhere(query, stage), owners) }),
                ),
            ),
        ]);

        const leadCounts = await this.countLeads(data);
        const stage_counts = Object.fromEntries(CUSTOMER_STAGES.map((stage, i) => [stage, counts[i]]));

        return {
            data: data.map((customer) => this.serialize(customer, leadCounts)),
            total,
            page,
            limit,
            stage_counts,
        };
    }

    async findOne(id: string, requester: Requester) {
        const customer = await this.customerRepository.findOne({
            where: this.visibleTo({ id, tenant_id: tenantId() }, await scopedUserIds(this.customerRepository.manager, requester, 'customers.view')),
            relations: { assigned_to: true, source: true, project: true },
        });
        if (!customer) throw new NotFoundException('Customer not found');
        return this.serialize(customer, await this.countLeads([customer]));
    }

    async bulkAssign(ids: string[], assignedToId: number) {
        const assignee = await this.userRepository.findOne({ where: { id: assignedToId, tenant_id: tenantId() } });
        if (!assignee) throw new BadRequestException('assigned_to_id does not match an existing user');
        if (assignee.suspended || assignee.blocked) throw new BadRequestException('That staff member is deactivated');
        return this.customerRepository.manager.transaction(async (manager) => {
            const clients = await manager.update(Customers, { id: In(ids), tenant_id: tenantId() }, { assigned_to: assignee });
            const leads = await manager.update(Lead, { customer_id: In(ids), tenant_id: tenantId() }, { assigned_to: assignee });
            return { updated: clients.affected ?? 0, leads: leads.affected ?? 0 };
        });
    }

    async setStarred(id: string, isStarred: boolean) {
        const result = await this.customerRepository.update({ id, tenant_id: tenantId() }, { is_starred: isStarred });
        if (!result.affected) throw new NotFoundException('Customer not found');
        return { id, is_starred: isStarred };
    }

    async update(id: string, dto: UpdateCustomerDto, requester: Requester) {
        // source is deliberately not loaded — a loaded relation would win over source_id on save.
        const customer = await this.customerRepository.findOne({
            where: { id, tenant_id: tenantId() },
            relations: { assigned_to: true },
        });
        if (!customer) throw new NotFoundException('Customer not found');

        await assertReaches(this.customerRepository.manager, requester, 'customers.edit', customer.assigned_to?.id, 'Your role cannot edit this client');
        // Compared against the stored value so an unchanged field in the payload isn't treated as an edit.
        if (dto.assigned_to_id !== undefined && dto.assigned_to_id !== customer.assigned_to?.id && !can(requester, 'customers.assign')) {
            throw new ForbiddenException('Your role cannot reassign clients');
        }

        // A client is identified by their number, so it is fixed once they are added. Sending it back unchanged is fine.
        if (dto.contact_number !== undefined && dto.contact_number !== customer.contact_number) {
            throw new BadRequestException("A client's phone number can't be changed once they are added");
        }

        if (dto.assigned_to_id !== undefined) {
            const assignedTo = await this.userRepository.findOne({ where: { id: dto.assigned_to_id, tenant_id: tenantId() } });
            if (!assignedTo) throw new BadRequestException('assigned_to_id does not match an existing user');
            customer.assigned_to = assignedTo;
        }

        if (dto.source_id !== undefined) {
            await this.assertSourceExists(dto.source_id);
            customer.source_id = dto.source_id;
        }

        if (dto.customer_name !== undefined) customer.customer_name = dto.customer_name;
        if (dto.first_name !== undefined || dto.last_name !== undefined) {
            if (dto.first_name !== undefined) customer.first_name = dto.first_name.trim() || null;
            if (dto.last_name !== undefined) customer.last_name = dto.last_name.trim() || null;
            customer.customer_name = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.customer_name;
        }
        if (dto.cnic_number !== undefined) customer.cnic_number = dto.cnic_number;
        if (dto.gender !== undefined) customer.gender = dto.gender;
        if (dto.alternate_contact_number !== undefined) customer.alternate_contact_number = dto.alternate_contact_number;
        if (dto.email !== undefined) customer.email = dto.email;
        if (dto.address !== undefined) customer.address = dto.address;
        if (dto.city !== undefined) customer.city = dto.city;
        if (dto.relation_type !== undefined) customer.relation_type = dto.relation_type;
        if (dto.sub_source !== undefined) customer.sub_source = dto.sub_source || null;
        if (dto.country !== undefined) customer.country = dto.country.toUpperCase();
        if (dto.stage !== undefined && needsPayment(customer.stage, dto.stage)) {
            throw new BadRequestException("Moving a client to Pre-Closure or Sold goes through their lead, with the payment received");
        }
        if (dto.stage !== undefined) customer.stage = dto.stage;
        if (dto.customer_since !== undefined) customer.customer_since = new Date(dto.customer_since);
        if (dto.notes !== undefined) customer.notes = dto.notes;

        await this.customerRepository.save(customer);
        // Leads carry a copy of the client's name and number — keep it matching the customer.
        await this.leadRepository.update(
            { customer_id: id },
            { client_name: customer.customer_name, client_number: customer.contact_number },
        );
        return this.findOne(id, requester);
    }

    async remove(id: string) {
        const customer = await this.customerRepository.findOne({ where: { id, tenant_id: tenantId() } });
        if (!customer) throw new NotFoundException('Customer not found');
        // The leads stay, keeping their copied name and number, but no longer point at a missing customer.
        await this.leadRepository.update({ customer_id: id }, { customer_id: null });
        await this.customerRepository.remove(customer);
    }

    /** Imports a spreadsheet within the request. Large files go through CustomerImportService instead. */
    importCsv(buffer: Buffer, createdById: number): Promise<ImportResult> {
        return importClients(this.customerRepository.manager, buffer, { tenantId: tenantId(), createdById });
    }

    /** Narrows any where clause (or list of OR'd clauses) to the clients the requester may see. */
    /** `owners` from customers.view: a client is visible when someone in it added the client or holds it. */
    private visibleTo(where: Record<string, unknown> | Record<string, unknown>[], owners: number[] | null) {
        if (owners === null) return where;
        const inScope = { id: In(owners) };
        return (Array.isArray(where) ? where : [where]).flatMap((clause) => {
            const assigned = clause.assigned_to as { id: number } | undefined;
            return [
                { ...clause, created_by: inScope },
                // A filter on someone outside the scope leaves nothing to add here.
                ...(assigned && !owners.includes(assigned.id) ? [] : [{ ...clause, assigned_to: assigned ?? inScope }]),
            ];
        });
    }

    private buildWhere(query: FindCustomersDto, stage?: string) {
        const { search, relation_type, source_id, city } = query;

        const baseFilter: Record<string, unknown> = { tenant_id: tenantId() };
        if (stage) baseFilter.stage = stage;
        if (relation_type) baseFilter.relation_type = relation_type;
        if (source_id) baseFilter.source_id = source_id;
        if (city) baseFilter.city = ILike(`%${city}%`);
        if (query.assigned_to_id) baseFilter.assigned_to = { id: query.assigned_to_id };
        if (query.starred === 'true') baseFilter.is_starred = true;
        if (query.created_date) {
            // CAST, not `::date`: TypeORM only quotes the alias when whitespace follows it.
            baseFilter.created_at = Raw((alias) => `CAST(${alias} AS date) = :createdDate`, {
                createdDate: query.created_date,
            });
        }
        if (query.lead_count !== undefined) {
            baseFilter.customer_no = Raw(
                (alias) => `(SELECT COUNT(*) FROM "lead" l JOIN "customers" c ON c.id = l.customer_id WHERE c.customer_no = ${alias} AND c.tenant_id = :tenantId) = :leadCount`,
                { leadCount: query.lead_count, tenantId: tenantId() },
            );
        }
        if (query.project_id) {
            baseFilter.id = Raw((alias) => IN_PROJECT(alias), { projectId: query.project_id });
        }

        if (!search) return baseFilter;

        // Capped at 9 digits so a phone number typed into search can't overflow the int column.
        const searchNo = /^\d{1,9}$/.test(search) ? Number(search) : null;
        if (query.search_by === 'cell') return { ...baseFilter, contact_number: ILike(`%${search}%`) };
        if (query.search_by === 'name') return { ...baseFilter, customer_name: ILike(`%${search}%`) };
        if (query.search_by === 'cnic') return { ...baseFilter, cnic_number: ILike(`%${search}%`) };
        // A client ID that isn't a number can't match anything.
        if (query.search_by === 'client_id') return { ...baseFilter, customer_no: searchNo ?? -1 };
        if (query.search_by === 'project') {
            // Shares the id slot with the project filter, so both conditions go in one expression.
            return {
                ...baseFilter,
                id: Raw(
                    (alias) => (query.project_id ? `${PROJECT_NAMED(alias)} AND ${IN_PROJECT(alias)}` : PROJECT_NAMED(alias)),
                    { projectName: `%${search}%`, projectId: query.project_id },
                ),
            };
        }

        const where: Record<string, unknown>[] = [
            { ...baseFilter, customer_name: ILike(`%${search}%`) },
            { ...baseFilter, contact_number: ILike(`%${search}%`) },
            { ...baseFilter, cnic_number: ILike(`%${search}%`) },
            { ...baseFilter, email: ILike(`%${search}%`) },
            { ...baseFilter, city: ILike(`%${search}%`) },
        ];
        if (searchNo !== null) where.push({ ...baseFilter, customer_no: searchNo });
        return where;
    }

    /** Each client's number of leads, and the project of the most recent one. */
    private async countLeads(customers: Customers[]) {
        const counts: LeadSummary = new Map();
        if (customers.length === 0) return counts;

        const rows: { customer_id: string; count: string; latest_lead_id: string; project_id: string | null; project_name: string | null }[] =
            await this.leadRepository.query(
                `SELECT l.customer_id, COUNT(*) AS count, (ARRAY_AGG(l.id ORDER BY l.created_at DESC))[1] AS latest_lead_id,
                        (ARRAY_AGG(p.id ORDER BY l.created_at DESC) FILTER (WHERE p.id IS NOT NULL))[1] AS project_id,
                        (ARRAY_AGG(p.project_name ORDER BY l.created_at DESC) FILTER (WHERE p.id IS NOT NULL))[1] AS project_name
                 FROM "lead" l LEFT JOIN "partner_project" p ON p.id = l.project_id
                 WHERE l.customer_id = ANY($1)
                 GROUP BY l.customer_id`,
                [customers.map((c) => c.id)],
            );

        for (const row of rows) {
            counts.set(row.customer_id, {
                count: Number(row.count),
                latestLeadId: row.latest_lead_id,
                project: row.project_id ? { id: row.project_id, name: row.project_name! } : null,
            });
        }
        return counts;
    }

    private async assertSourceExists(id: string) {
        const source = await this.sourceRepository.findOne({ where: { id, tenant_id: tenantId() } });
        if (!source) throw new BadRequestException('source_id does not match an existing source');
    }

    /**
     * Who already holds a number: nobody, a client the requester can see (returned, so a lead can be
     * opened on it), or another agent's client, which is described no further.
     */
    async checkPhone(phone: string, requester: Requester) {
        const digits = normalizePhone(phone);
        if (digits.length < 7) throw new BadRequestException('Enter a valid phone number');

        const customer = await this.customerRepository
            .createQueryBuilder('customer')
            .leftJoinAndSelect('customer.assigned_to', 'assigned_to')
            .leftJoinAndSelect('customer.created_by', 'created_by')
            .leftJoinAndSelect('customer.source', 'source')
            .leftJoinAndSelect('customer.project', 'project')
            .where(`${NORMALIZED_PHONE} = :digits`, { digits })
            .andWhere('customer.tenant_id = :tenantId', { tenantId: tenantId() })
            .getOne();
        if (!customer) return { status: 'available' as const };

        const owners = can(requester, 'customers.view')
            ? await scopedUserIds(this.customerRepository.manager, requester, 'customers.view')
            : [];
        const visible = owners === null
            || [customer.assigned_to?.id, customer.created_by?.id].some((id) => id != null && owners.includes(id));
        if (!visible) return { status: 'taken' as const, message: DUPLICATE_PHONE };

        const addedBy = customer.created_by
            ? { id: customer.created_by.id, first_name: customer.created_by.first_name, last_name: customer.created_by.last_name }
            : null;
        return {
            status: 'existing' as const,
            customer: this.serialize(customer, await this.countLeads([customer])),
            added_by: addedBy,
        };
    }

    /** One client per phone number. The message gives nothing away about the existing client. */
    private async assertPhoneIsFree(phone: string, excludeId?: string) {
        const digits = normalizePhone(phone);
        if (!digits) return;

        const qb = this.customerRepository
            .createQueryBuilder('customer')
            .where(`${NORMALIZED_PHONE} = :digits`, { digits })
            .andWhere('customer.tenant_id = :tenantId', { tenantId: tenantId() });
        if (excludeId) qb.andWhere('customer.id != :excludeId', { excludeId });

        if (await qb.getExists()) throw new ConflictException(DUPLICATE_PHONE);
    }

    private serialize(customer: Customers, leadCounts: LeadSummary) {
        return {
            id: customer.id,
            customer_no: customer.customer_no,
            stage: customer.stage,
            sub_source: customer.sub_source,
            country: customer.country,
            is_starred: customer.is_starred,
            lead_count: leadCounts.get(customer.id)?.count ?? 0,
            /** The project of the client's most recent lead, or the one they were added for. */
            project:
                leadCounts.get(customer.id)?.project ??
                (customer.project ? { id: customer.project.id, name: customer.project.project_name } : null),
            /** The lead a stage change with a payment is recorded against. */
            latest_lead_id: leadCounts.get(customer.id)?.latestLeadId ?? null,
            customer_name: customer.customer_name,
            first_name: customer.first_name,
            last_name: customer.last_name,
            cnic_number: customer.cnic_number,
            contact_number: customer.contact_number,
            gender: customer.gender,
            alternate_contact_number: customer.alternate_contact_number,
            email: customer.email,
            address: customer.address,
            city: customer.city,
            relation_type: customer.relation_type,
            source_id: customer.source_id,
            source: customer.source ? { id: customer.source.id, name: customer.source.name } : null,
            customer_since: customer.customer_since,
            notes: customer.notes,
            assigned_to: customer.assigned_to
                ? {
                    id: customer.assigned_to.id,
                    first_name: customer.assigned_to.first_name,
                    last_name: customer.assigned_to.last_name,
                    team: customer.assigned_to.team,
                }
                : null,
            created_at: customer.created_at,
            updated_at: customer.updated_at,
        };
    }
}
