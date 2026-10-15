import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto, FindPaymentsDto, RecordPaymentDto, StarPaymentDto } from './payment.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { Can } from '../access/permission.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Can('payments.create')
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

    // No permission guard: the service checks payments.record against the lead's owner.
    @Patch(':id/record')
    record(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordPaymentDto, @UserSession() user: any) {
        return this.paymentsService.record(id, dto, user);
    }

    @Can('payments.verify')
    @Patch(':id/verify')
    verify(@Param('id', ParseUUIDPipe) id: string, @UserSession() user: any) {
        return this.paymentsService.verify(id, user);
    }

    @Patch(':id/star')
    setStarred(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StarPaymentDto, @UserSession() user: any) {
        return this.paymentsService.setStarred(id, dto.is_starred, user);
    }
}
