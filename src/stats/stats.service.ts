import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../leads/lead.entity.js';
import { FollowUp } from '../follow-ups/follow-up.entity.js';
import { Customers } from '../customer/customer.entity.js';
import { tenantId } from '../tenants/tenant-context.js';
import { narrowToOwners, scopedUserIds, type Requester } from '../access/access.js';


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

    /** Figures over the leads the requester's leads.view scope reaches. */
    async dashboard(requester: Requester) {
        const owners = await scopedUserIds(this.leadRepository.manager, requester, 'leads.view');

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
            this.countOpenLeads(owners),
            this.sumOpenBudget(owners),
            this.sumSoldBudget(owners),
            this.countOverdueFollowUps(owners),
            this.customerRepository.count({ where: { tenant_id: tenantId() } }),
            this.countLeadsAtStage(owners, 'sold'),
            this.countLeadsCreatedInMonth(owners, 0),
            this.countLeadsCreatedInMonth(owners, 1),
            this.soldThisMonth(owners),
            this.countOpenFollowUpsDueToday(owners),
        ]);

        return {
            scope: owners === null ? 'system' : requester.permissions['leads.view'],
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
        const owners = await scopedUserIds(this.leadRepository.manager, requester, 'leads.view');
        const month = "TO_CHAR(DATE_TRUNC('month', lead.sold_at), 'YYYY-MM')";
        const rows = await this.scopeLeads(owners)
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
            .where('followUp.tenant_id = :tenantId', { tenantId: tenantId() })
            .orderBy('COALESCE(followUp.completed_at, followUp.created_at)', 'DESC')
            // limit, not take: take can't order by an expression, and these joins never multiply rows.
            .limit(limit);
        narrowToOwners(qb, 'assignedTo.id', await scopedUserIds(this.leadRepository.manager, requester, 'leads.view'));

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

    private scopeLeads(owners: number[] | null) {
        const qb = this.leadRepository
            .createQueryBuilder('lead')
            .leftJoin('lead.assigned_to', 'assignedTo')
            .where('lead.tenant_id = :tenantId', { tenantId: tenantId() });
        narrowToOwners(qb, 'assignedTo.id', owners);
        return qb;
    }

    private countOpenLeads(owners: number[] | null) {
        return this.scopeLeads(owners)
            .andWhere('lead.stage NOT IN (:...settled)', { settled: SETTLED_STAGES })
            .getCount();
    }

    private countLeadsAtStage(owners: number[] | null, stage: string) {
        return this.scopeLeads(owners)
            .andWhere('lead.stage = :stage', { stage })
            .getCount();
    }

    private async sumOpenBudget(owners: number[] | null) {
        const row = await this.scopeLeads(owners)
            .select('COALESCE(SUM(lead.budget), 0)', 'total')
            .andWhere('lead.stage NOT IN (:...settled)', { settled: SETTLED_STAGES })
            .getRawOne<{ total: string }>();
        return Number(row?.total ?? 0);
    }

    private async sumSoldBudget(owners: number[] | null) {
        const row = await this.scopeLeads(owners)
            .select('COALESCE(SUM(lead.budget), 0)', 'total')
            .andWhere('lead.stage = :stage', { stage: 'sold' })
            .getRawOne<{ total: string }>();
        return Number(row?.total ?? 0);
    }

    /** `monthsAgo` 0 is the current calendar month, 1 the one before it. */
    private countLeadsCreatedInMonth(owners: number[] | null, monthsAgo: number) {
        return this.scopeLeads(owners)
            .andWhere(
                `lead.created_at >= DATE_TRUNC('month', NOW()) - make_interval(months => :monthsAgo)
                 AND lead.created_at < DATE_TRUNC('month', NOW()) - make_interval(months => :monthsAgo - 1)`,
                { monthsAgo },
            )
            .getCount();
    }

    private async soldThisMonth(owners: number[] | null) {
        const row = await this.scopeLeads(owners)
            .select('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(lead.budget), 0)', 'total')
            .andWhere('lead.stage = :stage', { stage: 'sold' })
            .andWhere("lead.sold_at >= DATE_TRUNC('month', NOW())")
            .getRawOne<{ count: string; total: string }>();
        return { count: Number(row?.count ?? 0), total: Number(row?.total ?? 0) };
    }

    private countOpenFollowUpsDueToday(owners: number[] | null) {
        const qb = this.followUpRepository
            .createQueryBuilder('followUp')
            .leftJoin('followUp.lead', 'lead')
            .leftJoin('lead.assigned_to', 'assignedTo')
            .where('followUp.completed = false')
            .andWhere('followUp.tenant_id = :tenantId', { tenantId: tenantId() })
            .andWhere('followUp.due_date = CURRENT_DATE');

        narrowToOwners(qb, 'assignedTo.id', owners);
        return qb.getCount();
    }

    private countOverdueFollowUps(owners: number[] | null) {
        const qb = this.followUpRepository
            .createQueryBuilder('followUp')
            .leftJoin('followUp.lead', 'lead')
            .leftJoin('lead.assigned_to', 'assignedTo')
            .where('followUp.completed = false')
            .andWhere('followUp.tenant_id = :tenantId', { tenantId: tenantId() })
            .andWhere('(followUp.due_date + followUp.due_time) < NOW()');

        narrowToOwners(qb, 'assignedTo.id', owners);
        return qb.getCount();
    }
}
