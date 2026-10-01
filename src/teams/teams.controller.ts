import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { TeamsService } from './teams.service.js';
import { TeamDto } from './team.dto.js';
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

    @UseGuards(AdminGuard)
    @Post()
    create(@Body() dto: TeamDto) {
        return this.teamsService.create(dto.name, dto.member_ids);
    }

    @UseGuards(AdminGuard)
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TeamDto) {
        return this.teamsService.update(id, dto.name, dto.member_ids);
    }

    @UseGuards(AdminGuard)
    @Delete(':id')
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        await this.teamsService.remove(id);
        return { message: 'Team deleted successfully' };
    }
}
