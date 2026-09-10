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

        const [openLeads, pipelineValue, closedVolume, overdueFollowUps, customerCount, wonCount] =
            await Promise.all([
                this.countOpenLeads(requester, isAdmin),
                this.sumOpenBudget(requester, isAdmin),
                this.sumSoldBudget(requester, isAdmin),
                this.countOverdueFollowUps(requester, isAdmin),
                this.customerRepository.count(),
                this.countLeadsAtStage(requester, isAdmin, 'sold'),
            ]);

        return {
            scope: isAdmin ? 'system' : 'own',
            open_leads: openLeads,
            pipeline_value: pipelineValue,
            closed_volume: closedVolume,
            overdue_follow_ups: overdueFollowUps,
            customers: customerCount,
            leads_won: wonCount,
        };
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
