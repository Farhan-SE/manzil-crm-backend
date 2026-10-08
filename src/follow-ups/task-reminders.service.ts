import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowUp } from './follow-up.entity.js';
import { NEXT_TASKS } from './log-task.dto.js';
import { DUE_AT } from './due-windows.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const TICK_MS = 30_000;

const TASK_NAMES: Record<string, string> = {
    ...NEXT_TASKS,
    call: 'Call',
    whatsapp: 'WhatsApp',
    meeting: 'Meeting',
    site_visit: 'Site Visit',
};

type DueTask = {
    task_no: number;
    text: string;
    task_type: string | null;
    due_time: string;
    client_name: string;
    lead_no: number;
    assigned_to_id: number | null;
    created_by_id: number | null;
};

/** Puts a notification in the bell panel of the people concerned the moment a task's due time arrives. */
@Injectable()
export class TaskRemindersService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(TaskRemindersService.name);
    private timer: NodeJS.Timeout | null = null;
    private isRunning = false;

    constructor(
        @InjectRepository(FollowUp)
        private followUpRepository: Repository<FollowUp>,
        private notificationsService: NotificationsService,
    ) { }

    onModuleInit() {
        this.timer = setInterval(() => void this.tick(), TICK_MS);
        this.timer.unref();
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
    }

    async tick() {
        if (this.isRunning) return;
        this.isRunning = true;
        try {
            const due = DUE_AT('f');
            // Claiming and reading in one statement keeps a second server instance from reminding twice.
            // The one-day floor stops a long outage from flooding everyone with stale reminders.
            const [tasks]: [DueTask[], number] = await this.followUpRepository.query(
                `UPDATE "follow_up" f SET reminded_at = NOW()
                 FROM "lead" l
                 WHERE l.id = f.lead_id AND f.completed = false AND f.reminded_at IS NULL
                   AND ${due} <= NOW() AND ${due} > NOW() - INTERVAL '1 day'
                 RETURNING f.task_no, f.text, f.task_type, TO_CHAR(f.due_time, 'HH12:MI am') AS due_time,
                           l.client_name, l.lead_no, l.assigned_to_id, f.created_by_id`,
            );
            for (const task of tasks) {
                const name = (task.task_type && TASK_NAMES[task.task_type]) || task.text;
                // The lead's owner, and whoever set the task if that was someone else.
                const recipients = new Set([task.assigned_to_id, task.created_by_id].filter((id) => id !== null));
                for (const userId of recipients) {
                    await this.notificationsService.notify(
                        userId,
                        `Task due: ${name}`,
                        `${task.client_name} · Lead ${task.lead_no} · ${task.due_time.replace(/^0/, '')}`,
                        `/tasks?search=TSK-${task.task_no}`,
                    );
                }
            }
        } catch (error) {
            this.logger.error(`Could not send task reminders: ${error instanceof Error ? error.message : error}`);
        } finally {
            this.isRunning = false;
        }
    }
}
