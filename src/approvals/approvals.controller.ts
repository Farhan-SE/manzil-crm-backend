import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApprovalsService } from './approvals.service.js';
import { CreateApprovalDto, DecideApprovalDto, FindApprovalsDto, StarApprovalDto } from './approval.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { AdminGuard } from '../strategies/admin.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

@Controller('approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalsController {
    constructor(private readonly approvalsService: ApprovalsService) { }

    // No AdminGuard: staff raise requests; only management decides them.
    @Post()
    create(@Body() dto: CreateApprovalDto, @UserSession() user: any) {
        return this.approvalsService.create(dto, user);
    }

    @UseGuards(AdminGuard)
    @Get('overview')
    overview() {
        return this.approvalsService.overview();
    }

    @Get()
    findAll(@Query() query: FindApprovalsDto, @UserSession() user: any) {
        return this.approvalsService.findAll(query, user);
    }

    @UseGuards(AdminGuard)
    @Patch(':id/decision')
    decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideApprovalDto, @UserSession() user: any) {
        return this.approvalsService.decide(id, dto.decision, dto.comment, user);
    }

    @Patch(':id/star')
    setStarred(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StarApprovalDto, @UserSession() user: any) {
        return this.approvalsService.setStarred(id, dto.is_starred, user);
    }
}
