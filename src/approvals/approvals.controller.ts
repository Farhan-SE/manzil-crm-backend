import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApprovalsService } from './approvals.service.js';
import { CreateApprovalDto, DecideApprovalDto, FindApprovalsDto, ResubmitApprovalDto, StarApprovalDto } from './approval.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { Can } from '../access/permission.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

@Controller('approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalsController {
    constructor(private readonly approvalsService: ApprovalsService) { }

    // Open to all staff: anyone raises a request; deciding takes approvals.decide.
    @Post()
    create(@Body() dto: CreateApprovalDto, @UserSession() user: any) {
        return this.approvalsService.create(dto, user);
    }

    @Can('approvals.decide')
    @Get('overview')
    overview() {
        return this.approvalsService.overview();
    }

    @Get()
    findAll(@Query() query: FindApprovalsDto, @UserSession() user: any) {
        return this.approvalsService.findAll(query, user);
    }

    @Can('approvals.decide')
    @Patch(':id/decision')
    decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideApprovalDto, @UserSession() user: any) {
        return this.approvalsService.decide(id, dto.decision, dto.comment, user);
    }

    /** The requester answers a returned request and puts it back in the queue. */
    @Patch(':id/resubmit')
    resubmit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResubmitApprovalDto, @UserSession() user: any) {
        return this.approvalsService.resubmit(id, dto.note, user);
    }

    @Patch(':id/star')
    setStarred(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StarApprovalDto, @UserSession() user: any) {
        return this.approvalsService.setStarred(id, dto.is_starred, user);
    }
}
