import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsOptional } from 'class-validator';
import { StatsService } from './stats.service.js';
import { PerformanceService } from './performance.service.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

class PerformanceQueryDto {
    /** The day to report on, as YYYY-MM-DD. Defaults to today. */
    @IsOptional()
    @IsDateString()
    date?: string;
}

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
    constructor(
        private readonly statsService: StatsService,
        private readonly performanceService: PerformanceService,
    ) { }

    @Get('performance')
    performance(@Query() query: PerformanceQueryDto, @UserSession() user: any) {
        return this.performanceService.performance(user, query.date);
    }

    @Get('dashboard')
    dashboard(@UserSession() user: any) {
        return this.statsService.dashboard(user);
    }

    @Get('recent-activity')
    recentActivity(@UserSession() user: any) {
        return this.statsService.recentActivity(user);
    }

    @Get('sales-performance')
    salesPerformance(@UserSession() user: any) {
        return this.statsService.salesPerformance(user);
    }
}
