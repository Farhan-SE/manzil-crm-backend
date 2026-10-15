import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { PartnerProjectsService } from './partner-projects.service.js';
import { CreatePartnerProjectDto } from './create-partner-project.dto.js';
import { UpdatePartnerProjectDto } from './update-partner-project.dto.js';
import { FindPartnerProjectsDto, StarProjectDto } from './find-partner-projects.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { AdminGuard } from '../strategies/admin.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

/** The project owner's name and number are for admins only. */
function withoutOwner<T extends { owner_name: string | null; owner_phone: string | null }>(project: T, user: { role: string }) {
    if (user.role === 'admin') return project;
    const { owner_name: _name, owner_phone: _phone, ...rest } = project;
    return rest;
}

@Controller('partner-projects')
@UseGuards(JwtAuthGuard)
export class PartnerProjectsController {
    constructor(private readonly partnerProjectsService: PartnerProjectsService) { }

    @UseGuards(AdminGuard)
    @Post()
    create(@Body() dto: CreatePartnerProjectDto, @UserSession() user: any) {
        return this.partnerProjectsService.create(dto, user.userId);
    }

    @Get()
    async findAll(@Query() query: FindPartnerProjectsDto, @UserSession() user: any) {
        return (await this.partnerProjectsService.findAll(query)).map((project) => withoutOwner(project, user));
    }

    @Get('options')
    findOptions() {
        return this.partnerProjectsService.findOptions();
    }

    @Get(':id')
    async findOne(@Param('id', ParseUUIDPipe) id: string, @UserSession() user: any) {
        return withoutOwner(await this.partnerProjectsService.findOne(id), user);
    }

    @UseGuards(AdminGuard)
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePartnerProjectDto) {
        return this.partnerProjectsService.update(id, dto);
    }

    // Open to every agent, like the list itself — a star is a shared marker, not an edit.
    @Patch(':id/star')
    setStarred(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StarProjectDto) {
        return this.partnerProjectsService.setStarred(id, dto.is_starred);
    }

    @UseGuards(AdminGuard)
    @Delete(':id')
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        await this.partnerProjectsService.remove(id);
        return { message: 'Partner project deleted successfully' };
    }
}
