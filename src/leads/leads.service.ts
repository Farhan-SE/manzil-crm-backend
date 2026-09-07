import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, ILike, In, LessThanOrEqual, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { Lead } from './lead.entity.js';
import { User } from '../auth/user.entity.js';
import { CreateLeadDto } from './create-lead.dto.js';
import { UpdateLeadDto } from './update-lead.dto.js';
import { FindLeadsDto } from './find-leads.dto.js';

@Injectable()
export class LeadsService {
    constructor(
        @InjectRepository(Lead)
        private leadRepository: Repository<Lead>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async create(dto: CreateLeadDto, createdById: number) {
        let assignedTo: User | null = null;
        if (dto.assigned_to_id) {
            assignedTo = await this.userRepository.findOne({ where: { id: dto.assigned_to_id } });
            if (!assignedTo) throw new BadRequestException('Assigning agent does not exist in the DB');
        }

        const lead = this.leadRepository.create({
            client_name: dto.client_name,
            client_number: dto.client_number,
            interest_id: dto.interest_id ?? null,
            category_id: dto.category_id ?? null,
            city: dto.city ?? null,
            area: dto.area ?? null,
            budget: dto.budget != null ? String(dto.budget) : null,
            source_id: dto.source_id ?? null,
            temperature: dto.temperature ?? 'WARM',
            assigned_to: assignedTo,
            created_by: { id: createdById } as User,
        });
        await this.leadRepository.save(lead);
        return this.findOne(lead.id);
    }

    async findAll(query: FindLeadsDto, requester: { userId: number; role: string }) {
        const { search, stage, temperature, interest_id, category_id, source_id } = query;
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const baseFilter: Record<string, unknown> = {};
        if (stage) baseFilter.stage = stage;
        if (temperature) baseFilter.temperature = temperature;
        if (interest_id) baseFilter.interest_id = interest_id;
        if (category_id) baseFilter.category_id = category_id;
        if (source_id) baseFilter.source_id = source_id;

        const budgetFilter = this.buildBudgetFilter(query.budget_min, query.budget_max);
        if (budgetFilter) baseFilter.budget = budgetFilter;

        if (query.assigned_to_id) baseFilter.assigned_to = { id: query.assigned_to_id };
        // Applied last on purpose: an agent stays locked to their own leads whatever the query asks for.
        if (requester.role !== 'admin') {
            baseFilter.assigned_to = { id: requester.userId };
        }

        const where = search
            ? [
                { ...baseFilter, client_name: ILike(`%${search}%`) },
                { ...baseFilter, client_number: ILike(`%${search}%`) },
                { ...baseFilter, city: ILike(`%${search}%`) },
                { ...baseFilter, area: ILike(`%${search}%`) },
            ]
            : baseFilter;

        const [data, total] = await this.leadRepository.findAndCount({
            where,
            relations: { assigned_to: true, created_by: true },
            order: { created_at: 'DESC' },
            skip,
            take: limit,
        });

        return { data: data.map((lead) => this.serialize(lead)), total, page, limit };
    }

    async findActive(limit: number, requester: { userId: number; role: string }) {
        const where: Record<string, unknown> = { stage: Not(In(['sold', 'lost'])) };
        if (requester.role !== 'admin') {
            where.assigned_to = { id: requester.userId };
        }

        const leads = await this.leadRepository.find({
            where,
            relations: { assigned_to: true, created_by: true },
            order: { created_at: 'DESC' },
            take: limit,
        });

        return leads.map((lead) => this.serialize(lead));
    }

    async findOne(id: string) {
        const lead = await this.leadRepository.findOne({
            where: { id },
            relations: { assigned_to: true, created_by: true },
        });
        if (!lead) throw new NotFoundException('Lead not found');
        return this.serialize(lead);
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
        if (dto.temperature !== undefined) lead.temperature = dto.temperature;
        if (dto.stage !== undefined) lead.stage = dto.stage;

        await this.leadRepository.save(lead);
        return this.findOne(id);
    }

    async remove(id: string) {
        const lead = await this.leadRepository.findOne({ where: { id } });
        if (!lead) throw new NotFoundException('Lead not found');
        await this.leadRepository.remove(lead);
    }

    private buildBudgetFilter(min?: number, max?: number) {
        if (min != null && max != null) return Between(min, max);
        if (min != null) return MoreThanOrEqual(min);
        if (max != null) return LessThanOrEqual(max);
        return null;
    }

    private serialize(lead: Lead) {
        return {
            id: lead.id,
            client_name: lead.client_name,
            client_number: lead.client_number,
            interest_id: lead.interest_id,
            category_id: lead.category_id,
            city: lead.city,
            area: lead.area,
            budget: lead.budget != null ? Number(lead.budget) : null,
            source_id: lead.source_id,
            temperature: lead.temperature,
            stage: lead.stage,
            assigned_to: lead.assigned_to
                ? {
                    id: lead.assigned_to.id,
                    first_name: lead.assigned_to.first_name,
                    last_name: lead.assigned_to.last_name,
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
