import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { ReportQueryDto, SetTargetDto } from './report.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { Can } from '../access/permission.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

// Reports span every lead, unit and payment, so they take their own permission rather than a scope.
// Can sits above UseGuards so the JWT guard runs first and the user is known when permissions are checked.
@Controller('reports')
@Can('reports.view')
@UseGuards(JwtAuthGuard)
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Get()
    findAll() {
        return this.reportsService.findAll();
    }

    @Get('targets')
    targets(@Query() query: ReportQueryDto) {
        return this.reportsService.targets(query.period);
    }

    @Can('targets.manage')
    @Put('targets')
    setTarget(@Body() dto: SetTargetDto) {
        return this.reportsService.setTarget(dto.period, dto.metric, dto.value);
    }

    @Get(':key/data')
    generate(@Param('key') key: string, @Query() query: ReportQueryDto, @UserSession() user: any) {
        return this.reportsService.generate(key, query, user.userId);
    }
}
