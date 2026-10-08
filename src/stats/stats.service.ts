import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../leads/lead.entity.js';
import { FollowUp } from '../follow-ups/follow-up.entity.js';
import { Customers } from '../customer/customer.entity.js';

type Requester = { userId: number; role: string };

/** No longer in play — won or lost. Mirrors leads.findActive. Only 'sold' counts as closed volume. */
const SETTLED_STAGES = ['sold', 'lost'];

@Injectable()
export class StatsService {
    constructor(
        @InjectRepository(Lead)
        private leadRepository: Repository<Lead>,
        @InjectRepository(FollowUp)
        private followUpRepository: Repository<FollowUp>,
        @InjectRepository(Customers)
        private customerRepository: Repository<Customers>,
    ) { }

    /** Admins see the whole system; an agent sees only what is assigned to them. */
    async dashboard(requester: Requester) {
        const isAdmin = requester.role === 'admin';

        const [
            openLeads,
            pipelineValue,
            closedVolume,
            overdueFollowUps,
            customerCount,
            wonCount,
            inquiriesThisMonth,
            inquiriesLastMonth,
            soldThisMonth,
            tasksDueToday,
        ] = await Promise.all([
            this.countOpenLeads(requester, isAdmin),
            this.sumOpenBudget(requester, isAdmin),
            this.sumSoldBudget(requester, isAdmin),
            this.countOverdueFollowUps(requester, isAdmin),
            this.customerRepository.count(),
            this.countLeadsAtStage(requester, isAdmin, 'sold'),
            this.countLeadsCreatedInMonth(requester, isAdmin, 0),
            this.countLeadsCreatedInMonth(requester, isAdmin, 1),
            this.soldThisMonth(requester, isAdmin),
            this.countOpenFollowUpsDueToday(requester, isAdmin),
        ]);

        return {
            scope: isAdmin ? 'system' : 'own',
            open_leads: openLeads,
            pipeline_value: pipelineValue,
            closed_volume: closedVolume,
            overdue_follow_ups: overdueFollowUps,
            customers: customerCount,
            leads_won: wonCount,
            new_inquiries: inquiriesThisMonth,
            new_inquiries_change: inquiriesThisMonth - inquiriesLastMonth,
            closed_sales_month: soldThisMonth.count,
            closed_value_month: soldThisMonth.total,
            tasks_due_today: tasksDueToday,
        };
    }

    /** Sold budget per calendar month for the last six months, oldest first. Same scoping as the dashboard. */
    async salesPerformance(requester: Requester) {
        const isAdmin = requester.role === 'admin';
        const month = "TO_CHAR(DATE_TRUNC('month', lead.sold_at), 'YYYY-MM')";
        const rows = await this.scopeLeads(requester, isAdmin)
            .select(month, 'month')
            .addSelect('COALESCE(SUM(lead.budget), 0)', 'total')
            .addSelect('COUNT(*)', 'count')
            .andWhere('lead.stage = :stage', { stage: 'sold' })
            .andWhere("lead.sold_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'")
            .groupBy(month)
            .getRawMany<{ month: string; total: string; count: string }>();

        const byMonth = new Map(rows.map((row) => [row.month, row]));
        const now = new Date();
        return Array.from({ length: 6 }, (_, i) => {
            const key = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1))
                .toISOString()
                .slice(0, 7);
            const row = byMonth.get(key);
            return { month: key, total: Number(row?.total ?? 0), count: Number(row?.count ?? 0) };
        });
    }

    /** The latest things done or scheduled on leads, newest first. */
    async recentActivity(requester: Requester, limit = 4) {
        const qb = this.followUpRepository
            .createQueryBuilder('followUp')
            .leftJoinAndSelect('followUp.lead', 'lead')
            .leftJoin('lead.assigned_to', 'assignedTo')
            .leftJoinAndSelect('lead.project', 'project')
            .orderBy('COALESCE(followUp.completed_at, followUp.created_at)', 'DESC')
            // limit, not take: take can't order by an expression, and these joins never multiply rows.
            .limit(limit);
        if (requester.role !== 'admin') qb.andWhere('assignedTo.id = :userId', { userId: requester.userId });

        const followUps = await qb.getMany();
        return followUps.map((followUp) => ({
            id: followUp.id,
            kind: followUp.completed ? 'completed' : 'scheduled',
            text: followUp.text,
            task_type: followUp.task_type,
            sub_task: followUp.sub_task,
            at: followUp.completed_at ?? followUp.created_at,
            client_name: followUp.lead.client_name,
            project: followUp.lead.project?.project_name ?? null,
        }));
    }

    private scopeLeads(requester: Requester, isAdmin: boolean) {
        const qb = this.leadRepository
            .createQueryBuilder('lead')
            .leftJoin('lead.assigned_to', 'assignedTo');
        if (!isAdmin) qb.andWhere('assignedTo.id = :userId', { userId: requester.userId });
        return qb;
    }

    private countOpenLeads(requester: Requester, isAdmin: boolean) {
        return this.scopeLeads(requester, isAdmin)
            .andWhere('lead.stage NOT IN (:...settled)', { settled: SETTLED_STAGES })
            .getCount();
    }

    private countLeadsAtStage(requester: Requester, isAdmin: boolean, stage: string) {
        return this.scopeLeads(requester, isAdmin)
            .andWhere('lead.stage = :stage', { stage })
            .getCount();
    }

    private async sumOpenBudget(requester: Requester, isAdmin: boolean) {
        const row = await this.scopeLeads(requester, isAdmin)
            .select('COALESCE(SUM(lead.budget), 0)', 'total')
            .andWhere('lead.stage NOT IN (:...settled)', { settled: SETTLED_STAGES })
            .getRawOne<{ total: string }>();
        return Number(row?.total ?? 0);
    }

    private async sumSoldBudget(requester: Requester, isAdmin: boolean) {
        const row = await this.scopeLeads(requester, isAdmin)
            .select('COALESCE(SUM(lead.budget), 0)', 'total')
            .andWhere('lead.stage = :stage', { stage: 'sold' })
            .getRawOne<{ total: string }>();
        return Number(row?.total ?? 0);
    }

    /** `monthsAgo` 0 is the current calendar month, 1 the one before it. */
    private countLeadsCreatedInMonth(requester: Requester, isAdmin: boolean, monthsAgo: number) {
        return this.scopeLeads(requester, isAdmin)
            .andWhere(
                `lead.created_at >= DATE_TRUNC('month', NOW()) - make_interval(months => :monthsAgo)
                 AND lead.created_at < DATE_TRUNC('month', NOW()) - make_interval(months => :monthsAgo - 1)`,
                { monthsAgo },
            )
            .getCount();
    }

    private async soldThisMonth(requester: Requester, isAdmin: boolean) {
        const row = await this.scopeLeads(requester, isAdmin)
            .select('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(lead.budget), 0)', 'total')
            .andWhere('lead.stage = :stage', { stage: 'sold' })
            .andWhere("lead.sold_at >= DATE_TRUNC('month', NOW())")
            .getRawOne<{ count: string; total: string }>();
        return { count: Number(row?.count ?? 0), total: Number(row?.total ?? 0) };
    }

    private countOpenFollowUpsDueToday(requester: Requester, isAdmin: boolean) {
        const qb = this.followUpRepository
            .createQueryBuilder('followUp')
            .leftJoin('followUp.lead', 'lead')
            .leftJoin('lead.assigned_to', 'assignedTo')
            .where('followUp.completed = false')
            .andWhere('followUp.due_date = CURRENT_DATE');

        if (!isAdmin) qb.andWhere('assignedTo.id = :userId', { userId: requester.userId });
        return qb.getCount();
    }

    private countOverdueFollowUps(requester: Requester, isAdmin: boolean) {
        const qb = this.followUpRepository
            .createQueryBuilder('followUp')
            .leftJoin('followUp.lead', 'lead')
            .leftJoin('lead.assigned_to', 'assignedTo')
            .where('followUp.completed = false')
            .andWhere('(followUp.due_date + followUp.due_time) < NOW()');

        if (!isAdmin) qb.andWhere('assignedTo.id = :userId', { userId: requester.userId });
        return qb.getCount();
    }
}
