import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Approval, APPROVAL_TYPES } from './approval.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { User } from '../auth/user.entity.js';
import { APPROVAL_TABS, CreateApprovalDto, FindApprovalsDto, type ApprovalTab } from './approval.dto.js';

type Requester = { userId: number; role: string };

const TAB_STATUSES: Record<ApprovalTab, string[]> = {
    pending: ['pending'],
    approved: ['approved', 'rejected'],
    returned: ['returned'],
};

const WORKLOAD_LIMIT = 5;

@Injectable()
export class ApprovalsService {
    constructor(
        @InjectRepository(Approval)
        private approvalRepository: Repository<Approval>,
        @InjectRepository(Lead)
        private leadRepository: Repository<Lead>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async create(dto: CreateApprovalDto, requester: Requester) {
        const lead = await this.leadRepository.findOne({ where: { id: dto.lead_id } });
        if (!lead) throw new BadRequestException('lead_id does not match an existing lead');

        const approval = await this.approvalRepository.save(
            this.approvalRepository.create({
                type: dto.type,
                summary: dto.summary.trim(),
                lead: { id: lead.id } as Lead,
                priority: dto.priority ?? 'normal',
                due_date: dto.due_date ?? null,
                submitted_by: { id: requester.userId } as User,
            }),
        );
        return this.findOne(approval.id, requester);
    }

    /** Paged, with a count for each tab. Admins see every request; an agent only their own. */
    async findAll(query: FindApprovalsDto, requester: Requester) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;

        const inTab = (tab: ApprovalTab) => {
            const qb = this.scopedQuery(requester).andWhere('approval.status IN (:...statuses)', {
                statuses: TAB_STATUSES[tab],
            });
            if (query.starred === 'true') qb.andWhere('approval.is_starred = true');
            return qb;
        };

        const [[rows, total], counts] = await Promise.all([
            inTab(query.tab ?? 'pending')
                .orderBy('approval.created_at', query.sort === 'desc' ? 'DESC' : 'ASC')
                .skip((page - 1) * limit)
                .take(limit)
                .getManyAndCount(),
            Promise.all(APPROVAL_TABS.map((tab) => inTab(tab).getCount())),
        ]);

        return {
            data: rows.map((row) => this.serialize(row)),
            total,
            page,
            limit,
            tab_counts: Object.fromEntries(APPROVAL_TABS.map((tab, i) => [tab, counts[i]])),
        };
    }

    async findOne(id: string, requester: Requester) {
        const approval = await this.scopedQuery(requester).andWhere('approval.id = :id', { id }).getOne();
        if (!approval) throw new NotFoundException('Approval request not found');
        return this.serialize(approval);
    }

    /** Admin-only at the controller. A returned request can be decided again once it comes back. */
    async decide(id: string, decision: string, comment: string | undefined, requester: Requester) {
        const approval = await this.approvalRepository.findOne({ where: { id } });
        if (!approval) throw new NotFoundException('Approval request not found');
        if (approval.status === 'approved' || approval.status === 'rejected') {
            throw new ConflictException('This request has already been decided');
        }

        approval.status = decision;
        approval.review_comment = comment?.trim() || null;
        approval.reviewer = { id: requester.userId } as User;
        approval.decided_at = new Date();
        await this.approvalRepository.save(approval);
        return this.findOne(id, requester);
    }

    async setStarred(id: string, isStarred: boolean, requester: Requester) {
        await this.findOne(id, requester);
        await this.approvalRepository.update({ id }, { is_starred: isStarred });
        return { id, is_starred: isStarred };
    }

    /** The figures and panels above the approvals table. */
    async overview() {
        const [pendingByType, dueToday, activeStaff, escalatedCases, workload, unverifiedReceipts] = await Promise.all([
            this.approvalRepository
                .createQueryBuilder('approval')
                .select('approval.type', 'type')
                .addSelect('COUNT(*)', 'count')
                .where("approval.status = 'pending'")
                .groupBy('approval.type')
                .getRawMany<{ type: string; count: string }>(),
            this.approvalRepository
                .createQueryBuilder('approval')
                .where("approval.status = 'pending'")
                .andWhere('approval.due_date = CURRENT_DATE')
                .getCount(),
            this.userRepository.count({ where: { blocked: false, suspended: false } }),
            this.countWhere(`SELECT COUNT(*) AS count FROM "sales_dispute" WHERE status = 'escalated'`),
            this.approvalRepository.query(
                `SELECT u.id, u.first_name, u.last_name,
                        COUNT(f.id) AS open_tasks,
                        COUNT(f.id) FILTER (WHERE (f.due_date + f.due_time) < NOW()) AS overdue_tasks
                 FROM "follow_up" f
                 JOIN "lead" l ON l.id = f.lead_id
                 JOIN "user" u ON u.id = l.assigned_to_id
                 WHERE f.completed = false
                 GROUP BY u.id, u.first_name, u.last_name
                 ORDER BY open_tasks DESC
                 LIMIT $1`,
                [WORKLOAD_LIMIT],
            ) as Promise<{ id: number; first_name: string; last_name: string; open_tasks: string; overdue_tasks: string }[]>,
            this.countPendingOfType('payment_verification'),
        ]);

        const countOf = (type: string) => Number(pendingByType.find((row) => row.type === type)?.count ?? 0);
        return {
            pending_approvals: APPROVAL_TYPES.reduce((sum, type) => sum + countOf(type), 0),
            pending_by_type: Object.fromEntries(APPROVAL_TYPES.map((type) => [type, countOf(type)])),
            due_today: dueToday,
            active_staff: activeStaff,
            escalated_cases: escalatedCases,
            staff_workload: workload.map((row) => ({
                id: row.id,
                first_name: row.first_name,
                last_name: row.last_name,
                open_tasks: Number(row.open_tasks),
                overdue_tasks: Number(row.overdue_tasks),
            })),
            payment_verifications_pending: unverifiedReceipts,
        };
    }

    private countPendingOfType(type: string) {
        return this.approvalRepository.count({ where: { status: 'pending', type } });
    }

    private async countWhere(sql: string) {
        const rows: { count: string }[] = await this.approvalRepository.query(sql);
        return Number(rows[0]?.count ?? 0);
    }

    private scopedQuery(requester: Requester) {
        const qb = this.approvalRepository
            .createQueryBuilder('approval')
            .leftJoinAndSelect('approval.lead', 'lead')
            .leftJoinAndSelect('lead.project', 'project')
            .leftJoinAndSelect('approval.submitted_by', 'submittedBy')
            .leftJoinAndSelect('approval.reviewer', 'reviewer')
            .where('1 = 1');
        if (requester.role !== 'admin') qb.andWhere('submittedBy.id = :userId', { userId: requester.userId });
        return qb;
    }

    private serialize(approval: Approval) {
        const person = (user: User | null) =>
            user ? { id: user.id, first_name: user.first_name, last_name: user.last_name } : null;
        return {
            id: approval.id,
            request_no: approval.request_no,
            type: approval.type,
            summary: approval.summary,
            priority: approval.priority,
            status: approval.status,
            due_date: approval.due_date,
            review_comment: approval.review_comment,
            decided_at: approval.decided_at,
            is_starred: approval.is_starred,
            lead: {
                id: approval.lead.id,
                lead_no: approval.lead.lead_no,
                client_name: approval.lead.client_name,
                project: approval.lead.project
                    ? { id: approval.lead.project.id, name: approval.lead.project.project_name }
                    : null,
            },
            submitted_by: person(approval.submitted_by),
            reviewer: person(approval.reviewer),
            created_at: approval.created_at,
            updated_at: approval.updated_at,
        };
    }
}
