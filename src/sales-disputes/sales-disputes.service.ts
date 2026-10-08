import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesDispute } from './sales-dispute.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { User } from '../auth/user.entity.js';
import {
    CreateSalesDisputeDto,
    DISPUTE_TABS,
    FindSalesDisputesDto,
    type DisputeTab,
} from './sales-dispute.dto.js';

type Requester = { userId: number; role: string };

/** A case waiting on evidence is still under review, so it has no tab of its own. */
const TAB_STATUSES: Record<Exclude<DisputeTab, 'all'>, string[]> = {
    open: ['open'],
    under_review: ['under_review', 'awaiting_evidence'],
    escalated: ['escalated'],
    resolved: ['resolved'],
};

@Injectable()
export class SalesDisputesService {
    constructor(
        @InjectRepository(SalesDispute)
        private disputeRepository: Repository<SalesDispute>,
        @InjectRepository(Lead)
        private leadRepository: Repository<Lead>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async create(dto: CreateSalesDisputeDto, requester: Requester) {
        const lead = await this.leadRepository.findOne({ where: { id: dto.lead_id } });
        if (!lead) throw new BadRequestException('lead_id does not match an existing lead');

        if (dto.review_owner_id) {
            const owner = await this.userRepository.findOne({ where: { id: dto.review_owner_id } });
            if (!owner) throw new BadRequestException('review_owner_id does not match an existing user');
        }

        const dispute = await this.disputeRepository.save(
            this.disputeRepository.create({
                lead: { id: lead.id } as Lead,
                category: dto.category,
                subject: dto.subject.trim(),
                description: dto.description?.trim() || null,
                requested_resolution: dto.requested_resolution?.trim() || null,
                raised_by: { id: requester.userId } as User,
                review_owner: dto.review_owner_id ? ({ id: dto.review_owner_id } as User) : null,
                resolution_due: dto.resolution_due ?? null,
            }),
        );
        return this.findOne(dispute.id, requester);
    }

    /** Paged, with a count for each tab under the same filters. */
    async findAll(query: FindSalesDisputesDto, requester: Requester) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;

        const inTab = (tab: DisputeTab) => {
            const qb = this.scopedQuery(requester);
            if (tab !== 'all') qb.andWhere('dispute.status IN (:...tabStatuses)', { tabStatuses: TAB_STATUSES[tab] });
            if (query.status) qb.andWhere('dispute.status = :status', { status: query.status });
            if (query.review_owner_id) qb.andWhere('reviewOwner.id = :ownerId', { ownerId: query.review_owner_id });
            if (query.starred === 'true') qb.andWhere('dispute.is_starred = true');
            if (query.created_from) qb.andWhere('CAST(dispute.created_at AS date) >= :from', { from: query.created_from });
            if (query.created_to) qb.andWhere('CAST(dispute.created_at AS date) <= :to', { to: query.created_to });
            if (query.search) {
                // "DSP-024", "dsp24" and "24" all find the case by its number.
                const caseNo = /^(?:dsp-?)?0*(\d{1,9})$/i.exec(query.search.trim())?.[1];
                qb.andWhere(
                    '(dispute.subject ILIKE :search OR lead.client_name ILIKE :search OR dispute.case_no = :caseNo)',
                    { search: `%${query.search}%`, caseNo: caseNo ? Number(caseNo) : -1 },
                );
            }
            return qb;
        };

        const [[rows, total], counts] = await Promise.all([
            inTab(query.tab ?? 'all')
                .orderBy('dispute.case_no', query.sort === 'asc' ? 'ASC' : 'DESC')
                .skip((page - 1) * limit)
                .take(limit)
                .getManyAndCount(),
            Promise.all(DISPUTE_TABS.map((tab) => inTab(tab).getCount())),
        ]);

        return {
            data: rows.map((row) => this.serialize(row)),
            total,
            page,
            limit,
            tab_counts: Object.fromEntries(DISPUTE_TABS.map((tab, i) => [tab, counts[i]])),
        };
    }

    async findOne(id: string, requester: Requester) {
        const dispute = await this.scopedQuery(requester).andWhere('dispute.id = :id', { id }).getOne();
        if (!dispute) throw new NotFoundException('Sales dispute not found');
        return this.serialize(dispute);
    }

    /** Only an admin or the case's reviewer moves it along. */
    async setStatus(id: string, status: string, requester: Requester) {
        const dispute = await this.disputeRepository.findOne({ where: { id }, relations: { review_owner: true } });
        if (!dispute) throw new NotFoundException('Sales dispute not found');
        if (requester.role !== 'admin' && dispute.review_owner?.id !== requester.userId) {
            throw new ForbiddenException('Only an admin or the review owner can change a case status');
        }

        dispute.status = status;
        dispute.resolved_at = status === 'resolved' ? new Date() : null;
        await this.disputeRepository.save(dispute);
        return this.findOne(id, requester);
    }

    async setStarred(id: string, isStarred: boolean, requester: Requester) {
        await this.findOne(id, requester);
        await this.disputeRepository.update({ id }, { is_starred: isStarred });
        return { id, is_starred: isStarred };
    }

    /** Admins see every case; an agent sees those they raised, review, or that are on their own leads. */
    private scopedQuery(requester: Requester) {
        const qb = this.disputeRepository
            .createQueryBuilder('dispute')
            .leftJoinAndSelect('dispute.lead', 'lead')
            .leftJoinAndSelect('lead.project', 'project')
            .leftJoinAndSelect('dispute.raised_by', 'raisedBy')
            .leftJoinAndSelect('dispute.review_owner', 'reviewOwner')
            .where('1 = 1');
        if (requester.role !== 'admin') {
            qb.andWhere(
                '(raisedBy.id = :userId OR reviewOwner.id = :userId OR lead.assigned_to_id = :userId)',
                { userId: requester.userId },
            );
        }
        return qb;
    }

    private serialize(dispute: SalesDispute) {
        const person = (user: User | null) =>
            user
                ? {
                    id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    team: user.team,
                    department: user.department,
                }
                : null;
        return {
            id: dispute.id,
            case_no: dispute.case_no,
            category: dispute.category,
            subject: dispute.subject,
            description: dispute.description,
            requested_resolution: dispute.requested_resolution,
            status: dispute.status,
            resolution_due: dispute.resolution_due,
            resolved_at: dispute.resolved_at,
            is_starred: dispute.is_starred,
            lead: {
                id: dispute.lead.id,
                lead_no: dispute.lead.lead_no,
                client_name: dispute.lead.client_name,
                project: dispute.lead.project
                    ? { id: dispute.lead.project.id, name: dispute.lead.project.project_name }
                    : null,
            },
            raised_by: person(dispute.raised_by),
            review_owner: person(dispute.review_owner),
            created_at: dispute.created_at,
            updated_at: dispute.updated_at,
        };
    }
}
