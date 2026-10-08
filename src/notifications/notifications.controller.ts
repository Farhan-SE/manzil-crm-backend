import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { FindNotificationsDto } from './find-notifications.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Get()
    findMine(@Query() query: FindNotificationsDto, @UserSession() user: any) {
        return this.notificationsService.findMine(user.userId, query.unread === 'true');
    }

    @Patch('read-all')
    async markAllRead(@UserSession() user: any) {
        await this.notificationsService.markAllRead(user.userId);
        return { message: 'Notifications marked as read' };
    }

    @Patch(':id/read')
    async markRead(@Param('id', ParseUUIDPipe) id: string, @UserSession() user: any) {
        await this.notificationsService.markRead(id, user.userId);
        return { message: 'Notification marked as read' };
    }
}
