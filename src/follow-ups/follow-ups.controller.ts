import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { FollowUpsService } from './follow-ups.service.js';
import { CreateFollowUpDto } from './create-follow-up.dto.js';
import { UpdateFollowUpDto } from './update-follow-up.dto.js';
import { CompleteFollowUpDto } from './complete-follow-up.dto.js';
import { FindFollowUpsDto } from './find-follow-ups.dto.js';
import { FindTasksDto, FindTodosDto, SetTaskStatusDto, StarFollowUpDto } from './find-tasks.dto.js';
import { LogTaskDto, WeekLoadDto } from './log-task.dto.js';
import { FindLeadsDto } from '../leads/find-leads.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { AdminGuard } from '../strategies/admin.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

@Controller('follow-ups')
@UseGuards(JwtAuthGuard)
export class FollowUpsController {
    constructor(private readonly followUpsService: FollowUpsService) { }

    @UseGuards(AdminGuard)
    @Post()
    async create(@Body() dto: CreateFollowUpDto, @UserSession() user: any) {
        await this.followUpsService.create(dto, user.userId);
        return { message: 'Follow-up created successfully' };
    }

    // No AdminGuard: the service lets the lead's own agent through, admins for any lead.
    @Post('log')
    async logTask(@Body() dto: LogTaskDto, @UserSession() user: any) {
        await this.followUpsService.logTask(dto, user);
        return { message: 'Task added successfully' };
    }

    @Get('week-load')
    weekLoad(@Query() query: WeekLoadDto, @UserSession() user: any) {
        return this.followUpsService.weekLoad(query.from, user);
    }

    @Get()
    findAll(@Query() query: FindFollowUpsDto, @UserSession() user: any) {
        return this.followUpsService.findAll(query, user);
    }

    @Get('today')
    findToday(@Query() query: FindLeadsDto, @UserSession() user: any) {
        return this.followUpsService.findToday(query, user);
    }

    @Get('todos')
    findTodos(@Query() query: FindTodosDto, @UserSession() user: any) {
        return this.followUpsService.findTodos(query, user);
    }

    @Get('tasks')
    findTasks(@Query() query: FindTasksDto, @UserSession() user: any) {
        return this.followUpsService.findTasks(query, user);
    }

    @UseGuards(AdminGuard)
    @Patch(':id')
    async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFollowUpDto) {
        await this.followUpsService.update(id, dto);
        return { message: 'Follow-up updated successfully' };
    }

    @Patch(':id/complete')
    async complete(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CompleteFollowUpDto,
        @UserSession() user: any,
    ) {
        await this.followUpsService.setCompleted(id, dto.completed, user);
        return { message: 'Follow-up updated successfully' };
    }

    @Patch(':id/status')
    async setStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: SetTaskStatusDto,
        @UserSession() user: any,
    ) {
        await this.followUpsService.setStatus(id, dto.status, user);
        return { message: 'Follow-up updated successfully' };
    }

    @Patch(':id/star')
    setStarred(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StarFollowUpDto, @UserSession() user: any) {
        return this.followUpsService.setStarred(id, dto.is_starred, user);
    }
}
