import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './payment.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { User } from '../auth/user.entity.js';
import {
    CreatePaymentDto,
    FindPaymentsDto,
    PAYMENT_TABS,
    RecordPaymentDto,
    type PaymentTab,
} from './payment.dto.js';

type Requester = { userId: number; role: string };

/**
 * Where a payment stands, most pressing first: money waiting on Accounts, then fully paid,
 * then late, then partly paid, then simply not due yet. `p` is the payment table's alias.
 */
export function paymentStatusSql(p: string) {
    return `CASE
        WHEN ${p}.received_amount > 0 AND ${p}.verified = false THEN 'unverified'
        WHEN ${p}.received_amount >= ${p}.amount THEN 'received'
        WHEN ${p}.due_date < CURRENT_DATE THEN 'overdue'
        WHEN ${p}.received_amount > 0 THEN 'part_paid'
        ELSE 'pending'
    END`;
}

/** A part-paid instalment still has money owing, so it is listed with the pending ones. */
const TAB_STATUSES: Record<Exclude<PaymentTab, 'all'>, string[]> = {
    received: ['received'],
    pending: ['pending', 'part_paid'],
    overdue: ['overdue'],
    unverified: ['unverified'],
};

@Injectable()
export class PaymentsService {
    constructor(
        @InjectRepository(Payment)
        private paymentRepository: Repository<Payment>,
        @InjectRepository(Lead)
        private leadRepository: Repository<Lead>,
    ) { }

    async create(dto: CreatePaymentDto, requester: Requester) {
        const lead = await this.leadRepository.findOne({ where: { id: dto.lead_id } });
        if (!lead) throw new BadRequestException('lead_id does not match an existing lead');

        const payment = await this.paymentRepository.save(
            this.paymentRepository.create({
                lead: { id: lead.id } as Lead,
                payment_type: dto.payment_type,
                due_date: dto.due_date,
                amount: String(dto.amount),
                created_by: { id: requester.userId } as User,
            }),
        );
        return this.findOne(payment.id, requester);
    }

    /** Paged, with a count for each tab under the same filters. */
    async findAll(query: FindPaymentsDto, requester: Requester) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const status = paymentStatusSql('payment');

        const inTab = (tab: PaymentTab) => {
            const qb = this.scopedQuery(requester);
            if (tab !== 'all') qb.andWhere(`(${status}) IN (:...tabStatuses)`, { tabStatuses: TAB_STATUSES[tab] });
            if (query.project_id) qb.andWhere('lead.project_id = :projectId', { projectId: query.project_id });
            if (query.payment_type) qb.andWhere('payment.payment_type = :paymentType', { paymentType: query.payment_type });
            if (query.period) qb.andWhere("TO_CHAR(payment.due_date , 'YYYY-MM') = :period", { period: query.period });
            if (query.starred === 'true') qb.andWhere('payment.is_starred = true');
            if (query.search) {
                // "PAY-1036", "pay1036" and "1036" all find the payment by its number.
                const paymentNo = /^(?:pay-?)?0*(\d{1,9})$/i.exec(query.search.trim())?.[1];
                qb.andWhere('(lead.client_name ILIKE :search OR payment.payment_no = :paymentNo)', {
                    search: `%${query.search}%`,
                    paymentNo: paymentNo ? Number(paymentNo) : -1,
                });
            }
            return qb;
        };

        const [[rows, total], counts] = await Promise.all([
            inTab(query.tab ?? 'all')
                .orderBy('payment.payment_no', query.sort === 'asc' ? 'ASC' : 'DESC')
                .skip((page - 1) * limit)
                .take(limit)
                .getManyAndCount(),
            Promise.all(PAYMENT_TABS.map((tab) => inTab(tab).getCount())),
        ]);

        return {
            data: rows.map((row) => this.serialize(row)),
            total,
            page,
            limit,
            tab_counts: Object.fromEntries(PAYMENT_TABS.map((tab, i) => [tab, counts[i]])),
        };
    }

    async findOne(id: string, requester: Requester) {
        const payment = await this.scopedQuery(requester).andWhere('payment.id = :id', { id }).getOne();
        if (!payment) throw new NotFoundException('Payment not found');
        return this.serialize(payment);
    }

    /** The four figures above the ledger, under the caller's scope. */
    async summary(requester: Requester) {
        const scope = requester.role === 'admin' ? '' : 'AND l.assigned_to_id = $1';
        const params = requester.role === 'admin' ? [] : [requester.userId];
        const status = paymentStatusSql('p');
        const rows: Record<string, string>[] = await this.paymentRepository.query(
            `SELECT
                COALESCE(SUM(p.received_amount) FILTER (WHERE p.received_at >= DATE_TRUNC('month', NOW())), 0) AS collections_month,
                COALESCE(SUM(p.amount - p.received_amount) FILTER (WHERE p.received_amount < p.amount), 0) AS outstanding,
                COUNT(*) FILTER (WHERE p.received_amount < p.amount) AS open_count,
                COALESCE(SUM(p.amount - p.received_amount) FILTER (WHERE (${status}) = 'overdue'), 0) AS overdue_balance,
                COUNT(*) FILTER (WHERE (${status}) = 'overdue') AS overdue_count,
                COUNT(*) FILTER (WHERE (${status}) = 'unverified') AS unverified_count,
                COALESCE(SUM(p.received_amount) FILTER (WHERE (${status}) = 'unverified'), 0) AS unverified_amount
             FROM "payment" p
             JOIN "lead" l ON l.id = p.lead_id
             WHERE 1 = 1 ${scope}`,
            params,
        );
        const row = rows[0] ?? {};
        const targets: { value: string }[] = await this.paymentRepository.query(
            `SELECT value FROM "target" WHERE metric = 'collections' AND period = TO_CHAR(NOW(), 'YYYY-MM')`,
        );
        return {
            collections_month: Number(row.collections_month ?? 0),
            // Null until an admin sets this month's collections target on the Reports screen.
            collections_target: targets[0] ? Number(targets[0].value) : null,
            outstanding: Number(row.outstanding ?? 0),
            open_count: Number(row.open_count ?? 0),
            overdue_balance: Number(row.overdue_balance ?? 0),
            overdue_count: Number(row.overdue_count ?? 0),
            unverified_count: Number(row.unverified_count ?? 0),
            unverified_amount: Number(row.unverified_amount ?? 0),
        };
    }

    /** Adds money against the payment. It stays unverified until Accounts confirms the receipt. */
    async record(id: string, dto: RecordPaymentDto, requester: Requester) {
        const payment = await this.paymentRepository.findOne({ where: { id }, relations: { lead: { assigned_to: true } } });
        if (!payment) throw new NotFoundException('Payment not found');
        if (requester.role !== 'admin' && payment.lead.assigned_to?.id !== requester.userId) {
            throw new ForbiddenException('You can only record payments on leads assigned to you');
        }

        const balance = Number(payment.amount) - Number(payment.received_amount);
        if (dto.amount > balance) throw new BadRequestException('That is more than the balance still owed');

        payment.received_amount = String(Number(payment.received_amount) + dto.amount);
        payment.received_at = new Date();
        if (dto.method !== undefined) payment.method = dto.method.trim() || null;
        if (dto.reference !== undefined) payment.reference = dto.reference.trim() || null;
        if (dto.note !== undefined) payment.note = dto.note.trim() || null;
        payment.verified = false;
        payment.verified_by = null;
        await this.paymentRepository.save(payment);
        return this.findOne(id, requester);
    }

    /** Admin-only at the controller. */
    async verify(id: string, requester: Requester) {
        const payment = await this.paymentRepository.findOne({ where: { id } });
        if (!payment) throw new NotFoundException('Payment not found');
        if (Number(payment.received_amount) <= 0) throw new BadRequestException('Nothing has been received to verify');

        payment.verified = true;
        payment.verified_by = { id: requester.userId } as User;
        await this.paymentRepository.save(payment);
        return this.findOne(id, requester);
    }

    async setStarred(id: string, isStarred: boolean, requester: Requester) {
        await this.findOne(id, requester);
        await this.paymentRepository.update({ id }, { is_starred: isStarred });
        return { id, is_starred: isStarred };
    }

    /** Admins see the whole ledger; an agent sees payments on their own leads. */
    private scopedQuery(requester: Requester) {
        const qb = this.paymentRepository
            .createQueryBuilder('payment')
            .leftJoinAndSelect('payment.lead', 'lead')
            .leftJoinAndSelect('lead.project', 'project')
            .where('1 = 1');
        if (requester.role !== 'admin') qb.andWhere('lead.assigned_to_id = :userId', { userId: requester.userId });
        return qb;
    }

    private serialize(payment: Payment) {
        const amount = Number(payment.amount);
        const received = Number(payment.received_amount);
        const isLate = new Date(`${payment.due_date}T23:59:59`) < new Date();
        const status =
            received > 0 && !payment.verified
                ? 'unverified'
                : received >= amount
                    ? 'received'
                    : isLate
                        ? 'overdue'
                        : received > 0
                            ? 'part_paid'
                            : 'pending';
        return {
            id: payment.id,
            payment_no: payment.payment_no,
            payment_type: payment.payment_type,
            due_date: payment.due_date,
            amount,
            received_amount: received,
            balance: amount - received,
            status,
            received_at: payment.received_at,
            method: payment.method,
            reference: payment.reference,
            note: payment.note,
            verified: payment.verified,
            is_starred: payment.is_starred,
            lead: {
                id: payment.lead.id,
                lead_no: payment.lead.lead_no,
                client_name: payment.lead.client_name,
                project: payment.lead.project
                    ? { id: payment.lead.project.id, name: payment.lead.project.project_name }
                    : null,
            },
            created_at: payment.created_at,
            updated_at: payment.updated_at,
        };
    }
}
