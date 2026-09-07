import {
    Body,
    Controller,
    DefaultValuePipe,
    Get,
    Param,
    ParseIntPipe,
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

    @Get()
    findAll(
        @Query('lead_id') leadId: string | undefined,
        @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
        @UserSession() user: any,
    ) {
        return this.followUpsService.findAll({ lead_id: leadId || undefined, limit }, user);
    }

    @Get('today')
    findToday(@Query() query: FindLeadsDto, @UserSession() user: any) {
        return this.followUpsService.findToday(query, user);
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
}
