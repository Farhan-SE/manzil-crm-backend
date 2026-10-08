import { Controller, Get, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
    constructor(private readonly statsService: StatsService) { }

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
