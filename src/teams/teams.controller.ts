import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TeamsService } from './teams.service.js';
import { FindTeamsDto, StarTeamDto, TeamDto, TeamStatusDto } from './team.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { AdminGuard } from '../strategies/admin.guard.js';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
    constructor(private readonly teamsService: TeamsService) { }

    @Get()
    findAll() {
        return this.teamsService.findAll();
    }

    @Get('overview')
    findOverview(@Query() query: FindTeamsDto) {
        return this.teamsService.findOverview(query);
    }

    @UseGuards(AdminGuard)
    @Post()
    create(@Body() dto: TeamDto) {
        return this.teamsService.create(dto);
    }

    @UseGuards(AdminGuard)
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TeamDto) {
        return this.teamsService.update(id, dto);
    }

    @UseGuards(AdminGuard)
    @Patch(':id/status')
    setActive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TeamStatusDto) {
        return this.teamsService.setActive(id, dto.is_active);
    }

    // Open to every member, like the list itself — a star is a shared marker, not an edit.
    @Patch(':id/star')
    setStarred(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StarTeamDto) {
        return this.teamsService.setStarred(id, dto.is_starred);
    }

    @UseGuards(AdminGuard)
    @Delete(':id')
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        await this.teamsService.remove(id);
        return { message: 'Team deleted successfully' };
    }
}
