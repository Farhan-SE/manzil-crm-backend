import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';
import { FollowUp } from './follow-up.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { User } from '../auth/user.entity.js';
import { CreateFollowUpDto } from './create-follow-up.dto.js';
import { UpdateFollowUpDto } from './update-follow-up.dto.js';
import { FindLeadsDto } from '../leads/find-leads.dto.js';
import { FindFollowUpsDto } from './find-follow-ups.dto.js';
import { FindTasksDto, FindTodosDto, TASK_TABS, TODO_WINDOWS, type TaskTab, type TodoWindow } from './find-tasks.dto.js';
import { dueWindowSql } from './due-windows.js';
import { LogTaskDto, NEXT_TASKS, PAYMENT_TASKS, TERMINAL_NEXT_TASKS } from './log-task.dto.js';
import { Unit, UNIT_STATUSES } from '../units/unit.entity.js';
import { PartnerProject } from '../partner-projects/partner-project.entity.js';

type Requester = { userId: number; role: string };

type LastTask = { text: string; task_type: string | null; sub_task: string | null; at: Date | null };

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
                ...(dto.next_task === 'closed_won' ? { stage: 'sold', sold_at: lead.sold_at ?? new Date() } : {}),
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
        const qb = this.listQuery();

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
        const qb = this.listQuery()
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

    /** Open follow-ups, paged, with a count for each due window under the same filters. */
    async findTodos(query: FindTodosDto, requester: Requester) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const windows = dueWindowSql('followUp');
        const direction = query.sort === 'desc' ? 'DESC' : 'ASC';

        const inWindow = (window: TodoWindow) => {
            const qb = this.listQuery().where('followUp.completed = false');
            this.applyTaskFilters(qb, query, requester);
            if (query.due_date) qb.andWhere('followUp.due_date = :dueDate', { dueDate: query.due_date });
            if (window !== 'all') qb.andWhere(windows[window]);

            if (query.search) {
                const search = `%${query.search}%`;
                // Capped at 9 digits so a phone number typed into search can't overflow the int column.
                const leadNo = /^\d{1,9}$/.test(query.search) ? Number(query.search) : -1;
                if (query.search_by === 'lead_id') qb.andWhere('lead.lead_no = :leadNo', { leadNo });
                else if (query.search_by === 'client') qb.andWhere('lead.client_name ILIKE :search', { search });
                else if (query.search_by === 'todo') qb.andWhere('followUp.text ILIKE :search', { search });
                else {
                    qb.andWhere(
                        '(followUp.text ILIKE :search OR lead.client_name ILIKE :search OR lead.lead_no = :leadNo)',
                        { search, leadNo },
                    );
                }
            }
            return qb;
        };

        const [[rows, total], counts] = await Promise.all([
            inWindow(query.window ?? 'all')
                .orderBy('followUp.due_date', direction)
                .addOrderBy('followUp.due_time', direction)
                .skip((page - 1) * limit)
                .take(limit)
                .getManyAndCount(),
            Promise.all(TODO_WINDOWS.map((window) => inWindow(window).getCount())),
        ]);

        const lastTasks = await this.lastCompletedTasks(rows.map((row) => row.lead.id));
        const window_counts = Object.fromEntries(TODO_WINDOWS.map((window, i) => [window, counts[i]]));
        return { data: rows.map((row) => this.serialize(row, lastTasks)), total, page, limit, window_counts };
    }

    /** Every follow-up, paged, with a count for each status tab under the same filters. */
    async findTasks(query: FindTasksDto, requester: Requester) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const late = dueWindowSql('followUp').overdue;
        const tabSql: Record<Exclude<TaskTab, 'all'>, string> = {
            completed: 'followUp.completed = true',
            overdue: `followUp.completed = false AND ${late}`,
            in_progress: `followUp.completed = false AND NOT (${late}) AND followUp.status = 'in_progress'`,
            // A scheduled task has no tab of its own, so it is listed with the open ones.
            open: `followUp.completed = false AND NOT (${late}) AND followUp.status <> 'in_progress'`,
        };

        const inTab = (tab: TaskTab) => {
            const qb = this.listQuery();
            this.applyTaskFilters(qb, query, requester);
            if (query.due_from) qb.andWhere('followUp.due_date >= :dueFrom', { dueFrom: query.due_from });
            if (query.due_to) qb.andWhere('followUp.due_date <= :dueTo', { dueTo: query.due_to });
            if (tab !== 'all') qb.andWhere(tabSql[tab]);

            if (query.search) {
                // "TSK-1028", "tsk1028" and "1028" all find the task by its number.
                const taskNo = /^(?:tsk-?)?(\d{1,9})$/i.exec(query.search.trim())?.[1];
                qb.andWhere(
                    '(followUp.text ILIKE :search OR lead.client_name ILIKE :search OR followUp.task_no = :taskNo)',
                    { search: `%${query.search}%`, taskNo: taskNo ? Number(taskNo) : -1 },
                );
            }
            return qb;
        };

        const [[rows, total], counts] = await Promise.all([
            inTab(query.status ?? 'all')
                .orderBy('followUp.task_no', query.sort === 'asc' ? 'ASC' : 'DESC')
                .skip((page - 1) * limit)
                .take(limit)
                .getManyAndCount(),
            Promise.all(TASK_TABS.map((tab) => inTab(tab).getCount())),
        ]);

        const status_counts = Object.fromEntries(TASK_TABS.map((tab, i) => [tab, counts[i]]));
        return { data: rows.map((row) => this.serialize(row)), total, page, limit, status_counts };
    }

    /** `completed` ticks the task off; any other status reopens it at that stage. */
    async setStatus(id: string, status: string, requester: Requester) {
        const followUp = await this.findOwned(id, requester);
        if (status === 'completed') {
            followUp.completed = true;
            followUp.completed_at = new Date();
        } else {
            followUp.completed = false;
            followUp.completed_at = null;
            followUp.status = status;
        }
        await this.followUpRepository.save(followUp);
    }

    async setStarred(id: string, isStarred: boolean, requester: Requester) {
        const followUp = await this.findOwned(id, requester);
        await this.followUpRepository.update({ id: followUp.id }, { is_starred: isStarred });
        return { id, is_starred: isStarred };
    }

    /** Admins may touch any follow-up; an agent only the ones on leads assigned to them. */
    private async findOwned(id: string, requester: Requester) {
        const followUp = await this.followUpRepository.findOne({
            where: { id },
            relations: { lead: { assigned_to: true } },
        });
        if (!followUp) throw new NotFoundException('Follow-up not found');

        if (requester.role !== 'admin' && followUp.lead.assigned_to?.id !== requester.userId) {
            throw new ForbiddenException('You can only update follow-ups for leads assigned to you');
        }
        return followUp;
    }

    /** Every list joins the same lead details, so one serializer fits them all. */
    private listQuery() {
        return this.followUpRepository
            .createQueryBuilder('followUp')
            .leftJoinAndSelect('followUp.lead', 'lead')
            .leftJoinAndSelect('lead.assigned_to', 'assignedTo')
            .leftJoinAndSelect('lead.project', 'project')
            .leftJoinAndSelect('lead.interest', 'interest')
            .leftJoinAndSelect('lead.customer', 'customer');
    }

    private applyTaskFilters(
        qb: SelectQueryBuilder<FollowUp>,
        query: { assigned_to_id?: number; task_type?: string; starred?: string },
        requester: Requester,
    ) {
        // An agent stays locked to their own leads whatever the query asks for.
        if (requester.role !== 'admin') {
            qb.andWhere('assignedTo.id = :userId', { userId: requester.userId });
        } else if (query.assigned_to_id) {
            qb.andWhere('assignedTo.id = :assignedToId', { assignedToId: query.assigned_to_id });
        }
        if (query.task_type) qb.andWhere('followUp.task_type = :taskType', { taskType: query.task_type });
        if (query.starred === 'true') qb.andWhere('followUp.is_starred = true');
    }

    /** The most recently finished task on each lead — what a todo list shows as "last task". */
    private async lastCompletedTasks(leadIds: string[]) {
        const lastTasks = new Map<string, LastTask>();
        if (leadIds.length === 0) return lastTasks;

        const rows = (await this.followUpRepository.query(
            `SELECT DISTINCT ON (f.lead_id) f.lead_id, f.text, f.task_type, f.sub_task, f.completed_at AS at
             FROM "follow_up" f
             WHERE f.lead_id = ANY($1::uuid[]) AND f.completed = true
             ORDER BY f.lead_id, f.completed_at DESC NULLS LAST`,
            [leadIds],
        )) as ({ lead_id: string } & LastTask)[];

        for (const { lead_id, ...task } of rows) lastTasks.set(lead_id, task);
        return lastTasks;
    }

    private serialize(followUp: FollowUp, lastTasks?: Map<string, LastTask>) {
        const lead = followUp.lead;
        // Computed here so every caller agrees on what "overdue" means.
        const overdue = !followUp.completed && new Date(`${followUp.due_date}T${followUp.due_time}`) < new Date();
        return {
            id: followUp.id,
            task_no: followUp.task_no,
            text: followUp.text,
            task_type: followUp.task_type,
            sub_task: followUp.sub_task,
            due_date: followUp.due_date,
            due_time: followUp.due_time,
            completed: followUp.completed,
            completed_at: followUp.completed_at,
            overdue,
            // What a list shows: done and late win over the stored status.
            status: followUp.completed ? 'completed' : overdue ? 'overdue' : followUp.status,
            priority: followUp.priority,
            is_starred: followUp.is_starred,
            last_task: lastTasks?.get(lead.id) ?? null,
            lead: {
                id: lead.id,
                lead_no: lead.lead_no,
                client_name: lead.client_name,
                client_number: lead.client_number,
                gender: lead.customer?.gender ?? null,
                stage: lead.stage,
                city: lead.city,
                area: lead.area,
                project: lead.project ? { id: lead.project.id, name: lead.project.project_name } : null,
                interest: lead.interest ? { id: lead.interest.id, name: lead.interest.name } : null,
                assigned_to: lead.assigned_to
                    ? {
                        id: lead.assigned_to.id,
                        first_name: lead.assigned_to.first_name,
                        last_name: lead.assigned_to.last_name,
                        team: lead.assigned_to.team,
                    }
                    : null,
                created_at: lead.created_at,
            },
            created_at: followUp.created_at,
            updated_at: followUp.updated_at,
        };
    }
}
