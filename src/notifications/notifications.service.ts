import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity.js';

const PANEL_LIMIT = 50;

@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(Notification)
        private notificationRepository: Repository<Notification>,
    ) { }

    /** Other modules call this to put something in a user's bell panel. */
    notify(userId: number, title: string, body: string | null = null, link: string | null = null) {
        return this.notificationRepository.save(
            this.notificationRepository.create({ user_id: userId, title, body, link }),
        );
    }

    async findMine(userId: number, unreadOnly: boolean) {
        const [data, unread_count] = await Promise.all([
            this.notificationRepository.find({
                where: { user_id: userId, ...(unreadOnly ? { is_read: false } : {}) },
                order: { created_at: 'DESC' },
                take: PANEL_LIMIT,
            }),
            this.notificationRepository.count({ where: { user_id: userId, is_read: false } }),
        ]);
        return { data, unread_count };
    }

    async markRead(id: string, userId: number) {
        const result = await this.notificationRepository.update({ id, user_id: userId }, { is_read: true });
        if (!result.affected) throw new NotFoundException('Notification not found');
    }

    async markAllRead(userId: number) {
        await this.notificationRepository.update({ user_id: userId, is_read: false }, { is_read: true });
    }
}
