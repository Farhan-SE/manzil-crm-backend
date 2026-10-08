import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { DUE_WINDOWS, type DueWindow } from './due-windows.js';
import { TASK_STATUSES } from './follow-up.entity.js';

export const TODO_WINDOWS = [...DUE_WINDOWS, 'all'] as const;
export type TodoWindow = DueWindow | 'all';

export const TODO_SEARCH_FIELDS = ['lead_id', 'client', 'todo'] as const;
export type TodoSearchField = (typeof TODO_SEARCH_FIELDS)[number];

export const TASK_TABS = ['all', 'open', 'in_progress', 'overdue', 'completed'] as const;
export type TaskTab = (typeof TASK_TABS)[number];

class PagedTaskQuery {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    assigned_to_id?: number;

    @IsOptional()
    @IsString()
    task_type?: string;

    @IsOptional()
    @IsIn(['true', 'false'])
    starred?: string;

    @IsOptional()
    @IsIn(['asc', 'desc'])
    sort?: 'asc' | 'desc';
}

/** Open follow-ups, grouped by when they fall due. */
export class FindTodosDto extends PagedTaskQuery {
    @IsOptional()
    @IsIn(TODO_WINDOWS)
    window?: TodoWindow;

    /** Limits `search` to one field. Without it every searchable field is matched. */
    @IsOptional()
    @IsIn(TODO_SEARCH_FIELDS)
    search_by?: TodoSearchField;

    /** Only todos due on this day, as YYYY-MM-DD. */
    @IsOptional()
    @IsDateString()
    due_date?: string;

    /** Only todos due before this day. */
    @IsOptional()
    @IsDateString()
    due_before?: string;

    /** Only todos due after this day. */
    @IsOptional()
    @IsDateString()
    due_after?: string;
}

/** Every follow-up, open or done, grouped by status. */
export class FindTasksDto extends PagedTaskQuery {
    @IsOptional()
    @IsIn(TASK_TABS)
    status?: TaskTab;

    @IsOptional()
    @IsDateString()
    due_from?: string;

    @IsOptional()
    @IsDateString()
    due_to?: string;
}

export class SetTaskStatusDto {
    @IsIn([...TASK_STATUSES, 'completed'])
    status: string;
}

export class StarFollowUpDto {
    @IsBoolean()
    is_starred: boolean;
}
