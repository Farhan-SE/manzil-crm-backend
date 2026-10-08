import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SalesDisputesService } from './sales-disputes.service.js';
import {
    CreateSalesDisputeDto,
    FindSalesDisputesDto,
    SetDisputeStatusDto,
    StarDisputeDto,
} from './sales-dispute.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

@Controller('sales-disputes')
@UseGuards(JwtAuthGuard)
export class SalesDisputesController {
    constructor(private readonly salesDisputesService: SalesDisputesService) { }

    // No AdminGuard: anyone on a deal can raise a case about it.
    @Post()
    create(@Body() dto: CreateSalesDisputeDto, @UserSession() user: any) {
        return this.salesDisputesService.create(dto, user);
    }

    @Get()
    findAll(@Query() query: FindSalesDisputesDto, @UserSession() user: any) {
        return this.salesDisputesService.findAll(query, user);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string, @UserSession() user: any) {
        return this.salesDisputesService.findOne(id, user);
    }

    // No AdminGuard: the service lets the case's review owner through, admins for any case.
    @Patch(':id/status')
    setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetDisputeStatusDto, @UserSession() user: any) {
        return this.salesDisputesService.setStatus(id, dto.status, user);
    }

    @Patch(':id/star')
    setStarred(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StarDisputeDto, @UserSession() user: any) {
        return this.salesDisputesService.setStarred(id, dto.is_starred, user);
    }
}
