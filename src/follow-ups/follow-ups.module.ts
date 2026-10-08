import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { FollowUp } from './follow-up.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { FollowUpsService } from './follow-ups.service.js';
import { FollowUpsController } from './follow-ups.controller.js';
import { TaskRemindersService } from './task-reminders.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([FollowUp, Lead]),
        NotificationsModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [FollowUpsService, TaskRemindersService],
    controllers: [FollowUpsController],
    exports: [FollowUpsService],
})
export class FollowUpsModule { }
