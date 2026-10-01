import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowUp } from './follow-up.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { User } from '../auth/user.entity.js';
import { CreateFollowUpDto } from './create-follow-up.dto.js';
import { UpdateFollowUpDto } from './update-follow-up.dto.js';
import { FindLeadsDto } from '../leads/find-leads.dto.js';
import { FindFollowUpsDto } from './find-follow-ups.dto.js';
import { LogTaskDto, NEXT_TASKS, PAYMENT_TASKS, TERMINAL_NEXT_TASKS } from './log-task.dto.js';
import { Unit, UNIT_STATUSES } from '../units/unit.entity.js';
import { PartnerProject } from '../partner-projects/partner-project.entity.js';

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

    /** Records the task just done, schedules the next one and updates the lead — all or nothing. */
    async logTask(dto: LogTaskDto, requester: Requester) {
        const lead = await this.leadRepository.findOne({
            where: { id: dto.lead_id },
            relations: { assigned_to: true },
        });
        if (!lead) throw new NotFoundException('Lead not found');
        if (requester.role !== 'admin' && lead.assigned_to?.id !== requester.userId) {
            throw new ForbiddenException('You can only add tasks to leads assigned to you');
        }

        await this.followUpRepository.manager.transaction(async (manager) => {
            if (dto.project_id) {
                const project = await manager.findOne(PartnerProject, { where: { id: dto.project_id } });
                if (!project) throw new BadRequestException('project_id does not match an existing project');
            }

            let unit: Unit | null = null;
            if (dto.unit_id) {
                unit = await manager.findOne(Unit, { where: { id: dto.unit_id } });
                if (!unit) throw new BadRequestException('unit_id does not match an existing unit');
                if (dto.project_id && unit.project_id !== dto.project_id) {
                    throw new BadRequestException('That unit does not belong to the selected project');
                }
                if (unit.lead_id && unit.lead_id !== lead.id) {
                    throw new ConflictException('That unit is already booked by another lead');
                }
            }

            // What this submission says about the unit: a payment received, or the sale closing.
            const reachedStatus =
                dto.next_task === 'closed_won'
                    ? 'sold'
                    : dto.sub_task === 'received'
                        ? PAYMENT_TASKS[dto.task_type]
                        : undefined;
            if (reachedStatus && reachedStatus !== 'sold' && !unit) {
                throw new BadRequestException('Select the unit this payment is for');
            }
            // Only ever forwards — logging an earlier payment late must not undo a later stage.
            if (unit && reachedStatus && UNIT_STATUSES.indexOf(reachedStatus) > UNIT_STATUSES.indexOf(unit.status)) {
                await manager.update(Unit, { id: unit.id }, { status: reachedStatus, lead_id: lead.id });
            }

            const createdBy = { id: requester.userId } as User;
            await manager.save(
                manager.create(FollowUp, {
                    lead: { id: lead.id } as Lead,
                    text: dto.comment,
                    task_type: dto.task_type,
                    sub_task: dto.sub_task,
                    due_date: dto.completed_date,
                    due_time: dto.completed_time,
                    completed: true,
                    completed_at: new Date(),
                    created_by: createdBy,
                }),
            );

            if (!TERMINAL_NEXT_TASKS.includes(dto.next_task)) {
                await manager.save(
                    manager.create(FollowUp, {
                        lead: { id: lead.id } as Lead,
                        text: NEXT_TASKS[dto.next_task],
                        task_type: dto.next_task,
                        due_date: dto.deadline_date,
                        due_time: dto.deadline_time,
                        created_by: createdBy,
                    }),
                );
            }

            await manager.update(Lead, { id: lead.id }, {
                temperature: dto.temperature,
                project_id: dto.project_id ?? unit?.project_id ?? null,
                unit_id: unit?.id ?? null,
                ...(dto.next_task === 'closed_won' ? { stage: 'sold' } : {}),
            });
        });
    }

    /** Open tasks due on each of the 7 days from `from` — the load an agent sees when picking a deadline. */
    async weekLoad(from: string, requester: Requester) {
        const qb = this.followUpRepository
            .createQueryBuilder('followUp')
            .leftJoin('followUp.lead', 'lead')
            .select("TO_CHAR(followUp.due_date, 'YYYY-MM-DD')", 'date')
            .addSelect('COUNT(*)', 'count')
            .where('followUp.completed = false')
            .andWhere("followUp.due_date >= CAST(:from AS date) AND followUp.due_date < CAST(:from AS date) + INTERVAL '7 days'", { from })
            .groupBy('followUp.due_date');

        if (requester.role !== 'admin') {
            qb.andWhere('lead.assigned_to_id = :userId', { userId: requester.userId });
        }

        const rows = await qb.getRawMany<{ date: string; count: string }>();
        return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
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
            task_type: followUp.task_type,
            sub_task: followUp.sub_task,
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
