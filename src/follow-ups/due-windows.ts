export const DUE_WINDOWS = ['overdue', 'today', 'tomorrow', 'week'] as const;

export type DueWindow = (typeof DUE_WINDOWS)[number];

/** SQL conditions for when a follow-up is due. `alias` is the follow_up table's alias in the surrounding query. */
export function dueWindowSql(alias: string): Record<DueWindow, string> {
    return {
        overdue: `(${alias}.due_date + ${alias}.due_time) < NOW()`,
        today: `${alias}.due_date = CURRENT_DATE`,
        tomorrow: `${alias}.due_date = CURRENT_DATE + 1`,
        week: `${alias}.due_date >= CURRENT_DATE AND ${alias}.due_date < CURRENT_DATE + 7`,
    };
}
