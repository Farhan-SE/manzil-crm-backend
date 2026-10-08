import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto, FindPaymentsDto, RecordPaymentDto, StarPaymentDto } from './payment.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { AdminGuard } from '../strategies/admin.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @UseGuards(AdminGuard)
    @Post()
    create(@Body() dto: CreatePaymentDto, @UserSession() user: any) {
        return this.paymentsService.create(dto, user);
    }

    @Get('summary')
    summary(@UserSession() user: any) {
        return this.paymentsService.summary(user);
    }

    @Get()
    findAll(@Query() query: FindPaymentsDto, @UserSession() user: any) {
        return this.paymentsService.findAll(query, user);
    }

    // No AdminGuard: the service lets the lead's own agent through, admins for any payment.
    @Patch(':id/record')
    record(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordPaymentDto, @UserSession() user: any) {
        return this.paymentsService.record(id, dto, user);
    }

    @UseGuards(AdminGuard)
    @Patch(':id/verify')
    verify(@Param('id', ParseUUIDPipe) id: string, @UserSession() user: any) {
        return this.paymentsService.verify(id, user);
    }

    @Patch(':id/star')
    setStarred(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StarPaymentDto, @UserSession() user: any) {
        return this.paymentsService.setStarred(id, dto.is_starred, user);
    }
}
