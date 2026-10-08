import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportRun, Target, TARGET_METRICS, type TargetMetric } from './report.entity.js';
import { ReportQueryDto } from './report.dto.js';

type Cell = string | number | null;
type Filters = { period: string; projectId: string | null; region: string | null };
type ReportDefinition = {
    key: string;
    name: string;
    description: string;
    category: 'sales' | 'inventory' | 'collections' | 'staff';
    columns: string[];
    /** `$1` period, `$2` project id, `$3` region — every query takes all three, used or not. */
    sql: string;
};

// The placeholders are cast and compared even where a report ignores them, so one parameter list fits all.
const UNUSED = `($1::text IS NOT NULL OR $2::uuid IS NULL OR $3::text IS NULL)`;
const BY_PROJECT = `($2::uuid IS NULL OR l.project_id = $2)`;
const BY_REGION = `($3::text IS NULL OR u.region = $3)`;

const REPORTS: ReportDefinition[] = [
    {
        key: 'sales_by_project',
        name: 'Sales performance by project',
        description: 'Bookings, sales value and conversion',
        category: 'sales',
        columns: ['Project', 'Inquiries', 'Bookings', 'Value (PKR)', 'Conversion %'],
        sql: `SELECT COALESCE(p.project_name, 'No project') AS project,
                     COUNT(*) FILTER (WHERE TO_CHAR(l.created_at, 'YYYY-MM') = $1) AS inquiries,
                     COUNT(*) FILTER (WHERE l.stage = 'sold' AND TO_CHAR(l.sold_at, 'YYYY-MM') = $1) AS bookings,
                     COALESCE(SUM(l.budget) FILTER (WHERE l.stage = 'sold' AND TO_CHAR(l.sold_at, 'YYYY-MM') = $1), 0) AS value,
                     ROUND(100.0 * COUNT(*) FILTER (WHERE l.stage = 'sold' AND TO_CHAR(l.sold_at, 'YYYY-MM') = $1)
                           / NULLIF(COUNT(*) FILTER (WHERE TO_CHAR(l.created_at, 'YYYY-MM') = $1), 0), 1) AS conversion
              FROM "lead" l
              LEFT JOIN "partner_project" p ON p.id = l.project_id
              LEFT JOIN "user" u ON u.id = l.assigned_to_id
              WHERE ${BY_PROJECT} AND ${BY_REGION}
              GROUP BY 1
              ORDER BY value DESC, project`,
    },
    {
        key: 'pipeline_by_stage',
        name: 'Pipeline by stage',
        description: 'Open deals and their value at each stage',
        category: 'sales',
        columns: ['Stage', 'Deals', 'Value (PKR)'],
        sql: `SELECT l.stage, COUNT(*) AS deals, COALESCE(SUM(l.budget), 0) AS value
              FROM "lead" l
              LEFT JOIN "user" u ON u.id = l.assigned_to_id
              WHERE ${UNUSED} AND ${BY_PROJECT} AND ${BY_REGION}
              GROUP BY l.stage
              ORDER BY deals DESC`,
    },
    {
        key: 'lead_sources',
        name: 'Lead sources',
        description: 'Where the month\'s inquiries came from',
        category: 'sales',
        columns: ['Source', 'Inquiries', 'Sold'],
        sql: `SELECT COALESCE(s.name, 'Unknown') AS source,
                     COUNT(*) AS inquiries,
                     COUNT(*) FILTER (WHERE l.stage = 'sold') AS sold
              FROM "lead" l
              LEFT JOIN "source" s ON s.id = l.source_id
              LEFT JOIN "user" u ON u.id = l.assigned_to_id
              WHERE TO_CHAR(l.created_at, 'YYYY-MM') = $1 AND ${BY_PROJECT} AND ${BY_REGION}
              GROUP BY 1
              ORDER BY inquiries DESC`,
    },
    {
        key: 'inventory_availability',
        name: 'Inventory availability',
        description: 'Available, token and payment stages',
        category: 'inventory',
        columns: ['Project', 'Total units', 'Available', 'Token', 'PDP', 'CDP', 'Sold'],
        sql: `SELECT p.project_name AS project,
                     COUNT(n.id) AS total,
                     COUNT(n.id) FILTER (WHERE n.status = 'available') AS available,
                     COUNT(n.id) FILTER (WHERE n.status = 'token') AS token,
                     COUNT(n.id) FILTER (WHERE n.status = 'pdp') AS pdp,
                     COUNT(n.id) FILTER (WHERE n.status = 'cdp') AS cdp,
                     COUNT(n.id) FILTER (WHERE n.status = 'sold') AS sold
              FROM "partner_project" p
              LEFT JOIN "unit" n ON n.project_id = p.id
              WHERE ${UNUSED} AND ($2::uuid IS NULL OR p.id = $2)
              GROUP BY p.project_name
              ORDER BY p.project_name`,
    },
    {
        key: 'unit_price_list',
        name: 'Unit price list',
        description: 'Every unit with its price and status',
        category: 'inventory',
        columns: ['Project', 'Unit', 'Type', 'Location', 'Beds', 'Area (sqft)', 'Price (PKR)', 'Status'],
        sql: `SELECT p.project_name, n.unit_number, n.unit_type, n.floor, n.beds, n.area_sqft, n.price, n.status
              FROM "unit" n
              JOIN "partner_project" p ON p.id = n.project_id
              WHERE ${UNUSED} AND ($2::uuid IS NULL OR p.id = $2)
              ORDER BY p.project_name, n.unit_number`,
    },
    {
        key: 'receivables_ageing',
        name: 'Receivables ageing',
        description: 'Due balances and overdue instalments',
        category: 'collections',
        columns: ['Reference', 'Client', 'Project', 'Type', 'Due date', 'Amount (PKR)', 'Received (PKR)', 'Balance (PKR)', 'Days overdue'],
        sql: `SELECT 'PAY-' || y.payment_no, l.client_name, p.project_name, y.payment_type, y.due_date::text,
                     y.amount, y.received_amount, y.amount - y.received_amount,
                     GREATEST(CURRENT_DATE - y.due_date, 0)
              FROM "payment" y
              JOIN "lead" l ON l.id = y.lead_id
              LEFT JOIN "partner_project" p ON p.id = l.project_id
              WHERE ${UNUSED} AND y.received_amount < y.amount AND ${BY_PROJECT}
              ORDER BY y.due_date`,
    },
    {
        key: 'collections_received',
        name: 'Collections received',
        description: 'Receipts recorded in the month',
        category: 'collections',
        columns: ['Reference', 'Client', 'Project', 'Received on', 'Received (PKR)', 'Method', 'Bank reference', 'Verified'],
        sql: `SELECT 'PAY-' || y.payment_no, l.client_name, p.project_name, y.received_at::date::text,
                     y.received_amount, y.method, y.reference, CASE WHEN y.verified THEN 'Yes' ELSE 'No' END
              FROM "payment" y
              JOIN "lead" l ON l.id = y.lead_id
              LEFT JOIN "partner_project" p ON p.id = l.project_id
              WHERE TO_CHAR(y.received_at, 'YYYY-MM') = $1 AND ${BY_PROJECT} AND ($3::text IS NULL OR $3 = $3)
              ORDER BY y.received_at`,
    },
    {
        key: 'staff_activity',
        name: 'Staff allocation and activity',
        description: 'Assigned leads, tasks and project coverage',
        category: 'staff',
        columns: ['Staff', 'Team', 'Allocated leads', 'Projects', 'Open tasks', 'Overdue tasks', 'Tasks completed in month'],
        sql: `SELECT u.first_name || ' ' || u.last_name AS staff,
                     u.team,
                     COUNT(DISTINCT l.id) AS leads,
                     COUNT(DISTINCT l.project_id) AS projects,
                     COUNT(DISTINCT f.id) FILTER (WHERE f.completed = false) AS open_tasks,
                     COUNT(DISTINCT f.id) FILTER (WHERE f.completed = false AND (f.due_date + f.due_time) < NOW()) AS overdue_tasks,
                     COUNT(DISTINCT f.id) FILTER (WHERE f.completed AND TO_CHAR(f.completed_at, 'YYYY-MM') = $1) AS completed
              FROM "user" u
              LEFT JOIN "lead" l ON l.assigned_to_id = u.id AND ${BY_PROJECT}
              LEFT JOIN "follow_up" f ON f.lead_id = l.id
              WHERE u.blocked = false AND ${BY_REGION}
              GROUP BY u.id, u.first_name, u.last_name, u.team
              ORDER BY leads DESC, staff`,
    },
];

/** What was actually reached on each target metric in a month. `$1` is the period. */
const ACTUALS: Record<TargetMetric, string> = {
    booked_sales: `SELECT COALESCE(SUM(budget), 0) AS value FROM "lead" WHERE stage = 'sold' AND TO_CHAR(sold_at, 'YYYY-MM') = $1`,
    site_visits: `SELECT COUNT(*) AS value FROM "follow_up" WHERE completed AND task_type = 'site_visit' AND TO_CHAR(completed_at, 'YYYY-MM') = $1`,
    collections: `SELECT COALESCE(SUM(received_amount), 0) AS value FROM "payment" WHERE TO_CHAR(received_at, 'YYYY-MM') = $1`,
    unit_sales: `SELECT COUNT(*) AS value FROM "lead" WHERE stage = 'sold' AND TO_CHAR(sold_at, 'YYYY-MM') = $1`,
};

function currentPeriod() {
    return new Date().toISOString().slice(0, 7);
}

@Injectable()
export class ReportsService {
    constructor(
        @InjectRepository(Target)
        private targetRepository: Repository<Target>,
        @InjectRepository(ReportRun)
        private runRepository: Repository<ReportRun>,
    ) { }

    /** The report catalogue, each with when it was last generated. */
    async findAll() {
        const runs: { report_key: string; period: string; generated_at: Date }[] = await this.runRepository.query(
            `SELECT DISTINCT ON (report_key) report_key, period, generated_at
             FROM "report_run"
             ORDER BY report_key, generated_at DESC`,
        );
        const lastRun = new Map(runs.map((run) => [run.report_key, run]));
        return REPORTS.map(({ key, name, description, category }) => ({
            key,
            name,
            description,
            category,
            format: 'CSV',
            last_period: lastRun.get(key)?.period ?? null,
            last_generated_at: lastRun.get(key)?.generated_at ?? null,
        }));
    }

    /** Runs one report and notes that it was generated. Rows come back in the order of `columns`. */
    async generate(key: string, query: ReportQueryDto, userId: number) {
        const report = REPORTS.find((entry) => entry.key === key);
        if (!report) throw new NotFoundException('Report not found');

        const filters: Filters = {
            period: query.period ?? currentPeriod(),
            projectId: query.project_id ?? null,
            region: query.region ?? null,
        };
        const records: Record<string, Cell>[] = await this.runRepository.query(report.sql, [
            filters.period,
            filters.projectId,
            filters.region,
        ]);
        await this.runRepository.save(
            this.runRepository.create({ report_key: key, period: filters.period, generated_by_id: userId }),
        );

        return {
            key: report.key,
            name: report.name,
            period: filters.period,
            columns: report.columns,
            rows: records.map((record) => Object.values(record)),
        };
    }

    /** Each target metric for a month: what was aimed for (null if nothing is set) and what was reached. */
    async targets(period = currentPeriod()) {
        const [targets, actuals] = await Promise.all([
            this.targetRepository.find({ where: { period } }),
            Promise.all(
                TARGET_METRICS.map(
                    (metric) => this.targetRepository.query(ACTUALS[metric], [period]) as Promise<{ value: string }[]>,
                ),
            ),
        ]);
        return TARGET_METRICS.map((metric, i) => {
            const target = targets.find((entry) => entry.metric === metric);
            return {
                metric,
                target: target ? Number(target.value) : null,
                actual: Number(actuals[i][0]?.value ?? 0),
            };
        });
    }

    async setTarget(period: string, metric: string, value: number) {
        const existing = await this.targetRepository.findOne({ where: { period, metric } });
        await this.targetRepository.save(
            existing
                ? Object.assign(existing, { value: String(value) })
                : this.targetRepository.create({ period, metric, value: String(value) }),
        );
        return this.targets(period);
    }
}
