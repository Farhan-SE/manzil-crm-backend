export const DUE_WINDOWS = ['overdue', 'today', 'tomorrow', 'week'] as const;

export type DueWindow = (typeof DUE_WINDOWS)[number];

// Due dates and times are Pakistan wall-clock values, while the database session runs in UTC.
const ZONE = 'Asia/Karachi';
const TODAY = `(NOW() AT TIME ZONE '${ZONE}')::date`;

/** The instant a follow-up falls due. `alias` is the follow_up table's alias in the surrounding query. */
export const DUE_AT = (alias: string) => `((${alias}.due_date + ${alias}.due_time) AT TIME ZONE '${ZONE}')`;

/** SQL conditions for when a follow-up is due. `alias` is the follow_up table's alias in the surrounding query. */
export function dueWindowSql(alias: string): Record<DueWindow, string> {
    return {
        overdue: `${DUE_AT(alias)} < NOW()`,
        today: `${alias}.due_date = ${TODAY}`,
        tomorrow: `${alias}.due_date = ${TODAY} + 1`,
        week: `${alias}.due_date >= ${TODAY} AND ${alias}.due_date < ${TODAY} + 7`,
    };
}
