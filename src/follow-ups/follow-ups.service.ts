import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowUp } from './follow-up.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { User } from '../auth/user.entity.js';
import { CreateFollowUpDto } from './create-follow-up.dto.js';
import { UpdateFollowUpDto } from './update-follow-up.dto.js';
import { FindLeadsDto } from '../leads/find-leads.dto.js';
import { FindFollowUpsDto } from './find-follow-ups.dto.js';

type Requester = { userId: number; role: string };

@Injectable()
export class FollowUpsService {
    constructor(
        @InjectRepository(FollowUp)
        private followUpRepository: Repository<FollowUp>,
        @InjectRepository(Lead)
        private leadRepository: Repository<Lead>,
    ) { }

    async create(dto: CreateFollowUpDto, createdById: number) {
        const lead = await this.leadRepository.findOne({ where: { id: dto.lead_id } });
        if (!lead) throw new NotFoundException('Lead not found');

        const followUp = this.followUpRepository.create({
            lead: { id: dto.lead_id } as Lead,
            text: dto.text,
            due_date: dto.due_date,
            due_time: dto.due_time,
            created_by: { id: createdById } as User,
        });
        await this.followUpRepository.save(followUp);
    }

    async findAll(query: FindFollowUpsDto, requester: Requester) {
        const qb = this.followUpRepository
            .createQueryBuilder('followUp')
            .leftJoinAndSelect('followUp.lead', 'lead')
            .leftJoinAndSelect('lead.assigned_to', 'assignedTo');

        if (query.lead_id) {
            qb.andWhere('lead.id = :leadId', { leadId: query.lead_id })
                .orderBy('followUp.due_date', 'ASC')
                .addOrderBy('followUp.due_time', 'ASC');
            const followUps = await qb.getMany();
            return followUps.map((followUp) => this.serialize(followUp));
        }

        if (query.status === 'completed') {
            // Most recently ticked off first — NULLS LAST covers rows completed before completed_at existed.
            qb.andWhere('followUp.completed = true')
                .orderBy('followUp.completed_at', 'DESC', 'NULLS LAST')
                .addOrderBy('followUp.due_date', 'DESC');
        } else if (query.status === 'overdue') {
            qb.andWhere('followUp.completed = false')
                .andWhere('(followUp.due_date + followUp.due_time) < NOW()')
                // Longest overdue first.
                .orderBy('followUp.due_date', 'ASC')
                .addOrderBy('followUp.due_time', 'ASC');
        } else {
            qb.andWhere('followUp.completed = false')
                .andWhere('(followUp.due_date + followUp.due_time) >= NOW()')
                .orderBy('followUp.due_date', 'ASC')
                .addOrderBy('followUp.due_time', 'ASC');
        }

        if (requester.role !== 'admin') {
            qb.andWhere('assignedTo.id = :userId', { userId: requester.userId });
        } else if (query.assigned_to_id) {
            qb.andWhere('assignedTo.id = :assignedToId', { assignedToId: query.assigned_to_id });
        }

        if (query.search) {
            qb.andWhere('(followUp.text ILIKE :search OR lead.client_name ILIKE :search)', {
                search: `%${query.search}%`,
            });
        }

        qb.take(query.limit ?? 5);

        const followUps = await qb.getMany();
        return followUps.map((followUp) => this.serialize(followUp));
    }

    /** Everything due today — completed ones included, so the day's list stays a full record. */
    async findToday(query: FindLeadsDto, requester: Requester) {
        const qb = this.followUpRepository
            .createQueryBuilder('followUp')
            .leftJoinAndSelect('followUp.lead', 'lead')
            .leftJoinAndSelect('lead.assigned_to', 'assignedTo')
            .where('followUp.due_date = CURRENT_DATE')
            .orderBy('followUp.due_time', 'ASC');

        if (requester.role !== 'admin') {
            qb.andWhere('assignedTo.id = :userId', { userId: requester.userId });
        } else if (query.assigned_to_id) {
            qb.andWhere('assignedTo.id = :assignedToId', { assignedToId: query.assigned_to_id });
        }

        if (query.search) {
            qb.andWhere('(followUp.text ILIKE :search OR lead.client_name ILIKE :search)', {
                search: `%${query.search}%`,
            });
        }
        if (query.stage) qb.andWhere('lead.stage = :stage', { stage: query.stage });
        if (query.temperature) qb.andWhere('lead.temperature = :temperature', { temperature: query.temperature });
        if (query.interest_id) qb.andWhere('lead.interest_id = :interestId', { interestId: query.interest_id });
        if (query.category_id) qb.andWhere('lead.category_id = :categoryId', { categoryId: query.category_id });
        if (query.source_id) qb.andWhere('lead.source_id = :sourceId', { sourceId: query.source_id });
        if (query.budget_min != null) qb.andWhere('lead.budget >= :budgetMin', { budgetMin: query.budget_min });
        if (query.budget_max != null) qb.andWhere('lead.budget <= :budgetMax', { budgetMax: query.budget_max });

        const followUps = await qb.getMany();
        return followUps.map((followUp) => this.serialize(followUp));
    }

    async update(id: string, dto: UpdateFollowUpDto) {
        const followUp = await this.followUpRepository.findOne({ where: { id } });
        if (!followUp) throw new NotFoundException('Follow-up not found');

        if (dto.text !== undefined) followUp.text = dto.text;
        if (dto.due_date !== undefined) followUp.due_date = dto.due_date;
        if (dto.due_time !== undefined) followUp.due_time = dto.due_time;
        await this.followUpRepository.save(followUp);
    }

    async setCompleted(id: string, completed: boolean, requester: Requester) {
        const followUp = await this.followUpRepository.findOne({
            where: { id },
            relations: { lead: { assigned_to: true } },
        });
        if (!followUp) throw new NotFoundException('Follow-up not found');

        if (requester.role !== 'admin' && followUp.lead.assigned_to?.id !== requester.userId) {
            throw new ForbiddenException('You can only update follow-ups for leads assigned to you');
        }

        followUp.completed = completed;
        followUp.completed_at = completed ? new Date() : null;
        await this.followUpRepository.save(followUp);
    }

    private serialize(followUp: FollowUp) {
        return {
            id: followUp.id,
            text: followUp.text,
            due_date: followUp.due_date,
            due_time: followUp.due_time,
            completed: followUp.completed,
            completed_at: followUp.completed_at,
            // Computed here so every caller agrees on what "overdue" means.
            overdue:
                !followUp.completed &&
                new Date(`${followUp.due_date}T${followUp.due_time}`) < new Date(),
            lead: {
                id: followUp.lead.id,
                client_name: followUp.lead.client_name,
                client_number: followUp.lead.client_number,
                stage: followUp.lead.stage,
                city: followUp.lead.city,
                area: followUp.lead.area,
                assigned_to: followUp.lead.assigned_to
                    ? {
                        id: followUp.lead.assigned_to.id,
                        first_name: followUp.lead.assigned_to.first_name,
                        last_name: followUp.lead.assigned_to.last_name,
                    }
                    : null,
            },
            created_at: followUp.created_at,
            updated_at: followUp.updated_at,
        };
    }
}
