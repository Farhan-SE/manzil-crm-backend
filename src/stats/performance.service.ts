import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../leads/lead.entity.js';

type Requester = { userId: number; role: string };

/** The task types listed on the dashboard even when nothing is due for them. */
const BOARD_TASKS = [
    'arrange_meeting',
    'contact_client',
    'follow_up',
    'meet_client',
    'receive_token_payment',
    'receive_partial_down_payment',
    'receive_complete_down_payment',
    'sign_sale_agreement',
];

const CALL_TASKS = ['call', 'contact_client', 'follow_up'];
const MEETING_TASKS = ['meeting', 'meet_client', 'arrange_meeting', 'site_visit'];

// Timestamps are stored in UTC; the working day and its hours are Pakistan's.
const ZONE = `AT TIME ZONE 'Asia/Karachi'`;

function today() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
}

type FunnelRow = { kind: string; total: string; leads: string; connected: string; connected_leads: string; qualified: string; qualified_leads: string };

@Injectable()
export class PerformanceService {
    constructor(
        @InjectRepository(Lead)
        private leadRepository: Repository<Lead>,
    ) { }

    /**
     * The staff dashboard for one day. Month-to-date figures run from the 1st of that day's
     * month up to and including the day. Admins see everyone's leads; an agent sees their own.
     */
    async performance(requester: Requester, date = today()) {
        const owner = requester.role === 'admin' ? null : requester.userId;
        const run = <T>(sql: string, params: unknown[]) => this.leadRepository.query(sql, params) as Promise<T[]>;
        // `$1` owner (null for everyone), `$2` the day.
        const args = [owner, date];
        const mtd = (column: string) =>
            `(${column} ${ZONE})::date BETWEEN DATE_TRUNC('month', $2::date)::date AND $2::date`;
        const mine = '($1::int IS NULL OR l.assigned_to_id = $1)';

        const [profile, payments, sales, target, tasks, funnel, hours, ledger, pending] = await Promise.all([
            run<{ first_name: string; last_name: string; team: string | null; office: string | null; joined_on: string | null }>(
                `SELECT u.first_name, u.last_name, COALESCE(t.name, u.team) AS team, u.office, u.joined_on
                 FROM "user" u LEFT JOIN "team" t ON t.id = u.team_id WHERE u.id = $1`,
                [requester.userId],
            ),
            run<{ task_type: string; count: string }>(
                `SELECT f.task_type, COUNT(*) AS count
                 FROM "follow_up" f JOIN "lead" l ON l.id = f.lead_id
                 WHERE ${mine} AND f.completed AND f.sub_task = 'received'
                   AND f.task_type IN ('receive_token_payment', 'receive_partial_down_payment')
                   AND ${mtd('f.completed_at')}
                 GROUP BY f.task_type`,
                args,
            ),
            run<{ count: string; revenue: string }>(
                `SELECT COUNT(*) AS count, COALESCE(SUM(l.budget), 0) AS revenue
                 FROM "lead" l WHERE ${mine} AND l.stage = 'sold' AND ${mtd('l.sold_at')}`,
                args,
            ),
            run<{ value: string }>(
                `SELECT value FROM "target" WHERE metric = 'unit_sales' AND period = TO_CHAR($1::date, 'YYYY-MM')`,
                [date],
            ),
            run<{ bucket: string; task_type: string | null; count: string }>(
                `SELECT CASE WHEN f.due_date < $2::date THEN 'overdue' WHEN f.due_date = $2::date THEN 'today' ELSE 'upcoming' END AS bucket,
                        f.task_type, COUNT(*) AS count
                 FROM "follow_up" f JOIN "lead" l ON l.id = f.lead_id
                 WHERE ${mine} AND NOT f.completed
                 GROUP BY 1, 2`,
                args,
            ),
            run<FunnelRow>(
                `SELECT CASE WHEN f.task_type = ANY($3) THEN 'calls' ELSE 'meetings' END AS kind,
                        COUNT(*) AS total, COUNT(DISTINCT f.lead_id) AS leads,
                        COUNT(*) FILTER (WHERE f.sub_task <> 'not_answered') AS connected,
                        COUNT(DISTINCT f.lead_id) FILTER (WHERE f.sub_task <> 'not_answered') AS connected_leads,
                        COUNT(*) FILTER (WHERE f.sub_task = 'interested') AS qualified,
                        COUNT(DISTINCT f.lead_id) FILTER (WHERE f.sub_task = 'interested') AS qualified_leads
                 FROM "follow_up" f JOIN "lead" l ON l.id = f.lead_id
                 WHERE ${mine} AND f.completed AND f.task_type = ANY($3 || $4) AND ${mtd('f.completed_at')}
                 GROUP BY 1`,
                [...args, CALL_TASKS, MEETING_TASKS],
            ),
            run<{ hour: number; calls: string; uqc: string; umet: string }>(
                `SELECT EXTRACT(HOUR FROM f.completed_at ${ZONE})::int AS hour,
                        COUNT(*) FILTER (WHERE f.task_type = ANY($3)) AS calls,
                        COUNT(DISTINCT f.lead_id) FILTER (WHERE f.task_type = ANY($3) AND f.sub_task = 'interested') AS uqc,
                        COUNT(DISTINCT f.lead_id) FILTER (WHERE f.task_type = ANY($4)) AS umet
                 FROM "follow_up" f JOIN "lead" l ON l.id = f.lead_id
                 WHERE ${mine} AND f.completed AND (f.completed_at ${ZONE})::date = $2::date
                 GROUP BY 1`,
                [...args, CALL_TASKS, MEETING_TASKS],
            ),
            run<{ expected: string; overdue: string; received: string }>(
                `SELECT COALESCE(SUM(p.amount - p.received_amount) FILTER (WHERE p.received_amount < p.amount), 0) AS expected,
                        COALESCE(SUM(p.amount - p.received_amount) FILTER (WHERE p.received_amount < p.amount AND p.due_date < $2::date), 0) AS overdue,
                        COALESCE(SUM(p.received_amount) FILTER (WHERE ${mtd('p.received_at')}), 0) AS received
                 FROM "payment" p JOIN "lead" l ON l.id = p.lead_id WHERE ${mine}`,
                args,
            ),
            run<{ id: string; payment_type: string; due_date: string; outstanding: string; client_name: string; project: string | null; unit: string | null; staff: string | null }>(
                `SELECT p.id, p.payment_type, TO_CHAR(p.due_date, 'YYYY-MM-DD') AS due_date, p.amount - p.received_amount AS outstanding,
                        l.client_name, pr.project_name AS project, un.unit_number AS unit,
                        NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') AS staff
                 FROM "payment" p JOIN "lead" l ON l.id = p.lead_id
                 LEFT JOIN "partner_project" pr ON pr.id = l.project_id
                 LEFT JOIN "unit" un ON un.id = l.unit_id
                 LEFT JOIN "user" u ON u.id = l.assigned_to_id
                 WHERE ${mine} AND p.received_amount < p.amount AND p.payment_type IN ('token', 'down_payment')
                 ORDER BY p.due_date ASC`,
                [owner],
            ),
        ]);

        const received = (type: string) => Number(payments.find((row) => row.task_type === type)?.count ?? 0);
        const bucket = (name: string) => {
            const rows = tasks.filter((row) => row.bucket === name);
            const count = (type: string) => Number(rows.find((row) => row.task_type === type)?.count ?? 0);
            // The fixed list first, then any other type that actually has something due.
            const extra = rows.map((row) => row.task_type ?? 'other').filter((type) => !BOARD_TASKS.includes(type));
            return [...BOARD_TASKS, ...new Set(extra)].map((type) => ({
                task_type: type,
                count: type === 'other' ? Number(rows.find((row) => row.task_type === null)?.count ?? 0) : count(type),
            }));
        };
        const steps = (kind: string) => {
            const row = funnel.find((entry) => entry.kind === kind);
            const step = (total?: string, leads?: string) => ({
                unique: Number(leads ?? 0),
                repeat: Number(total ?? 0) - Number(leads ?? 0),
            });
            return {
                total: step(row?.total, row?.leads),
                connected: step(row?.connected, row?.connected_leads),
                qualified: step(row?.qualified, row?.qualified_leads),
            };
        };
        const pendingOf = (type: string) => {
            const rows = pending.filter((row) => row.payment_type === type);
            return {
                total: rows.reduce((sum, row) => sum + Number(row.outstanding), 0),
                rows: rows.slice(0, 50).map(({ payment_type: _type, ...row }) => ({ ...row, outstanding: Number(row.outstanding) })),
            };
        };

        return {
            date,
            scope: owner === null ? 'system' : 'own',
            profile: profile[0] ?? null,
            cards: {
                tokens: received('receive_token_payment'),
                pdp: received('receive_partial_down_payment'),
                closed_won: Number(sales[0].count),
                achieved_revenue: Number(sales[0].revenue),
                unit_target: target[0] ? Number(target[0].value) : 0,
            },
            tasks: { today: bucket('today'), overdue: bucket('overdue'), upcoming: bucket('upcoming') },
            calls: steps('calls'),
            meetings: steps('meetings'),
            activity: Array.from({ length: 24 }, (_, hour) => {
                const row = hours.find((entry) => entry.hour === hour);
                return { hour, uqc: Number(row?.uqc ?? 0), calls: Number(row?.calls ?? 0), umet: Number(row?.umet ?? 0) };
            }),
            payments: {
                expected: Number(ledger[0].expected),
                overdue: Number(ledger[0].overdue),
                received: Number(ledger[0].received),
                token: pendingOf('token'),
                pdp: pendingOf('down_payment'),
            },
        };
    }
}
