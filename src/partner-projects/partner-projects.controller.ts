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
import { Can } from '../access/permission.guard.js';
import { UserSession } from '../strategies/user.decorator.js';
import { can, type Requester } from '../access/access.js';

/** The project owner's name and number are for inventory managers only. */
function withoutOwner<T extends { owner_name: string | null; owner_phone: string | null }>(project: T, user: Requester) {
    if (can(user, 'inventory.manage')) return project;
    const { owner_name: _name, owner_phone: _phone, ...rest } = project;
    return rest;
}

@Controller('partner-projects')
@UseGuards(JwtAuthGuard)
export class PartnerProjectsController {
    constructor(private readonly partnerProjectsService: PartnerProjectsService) { }

    @Can('inventory.manage')
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

    @Can('inventory.manage')
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePartnerProjectDto) {
        return this.partnerProjectsService.update(id, dto);
    }

    // Open to every agent, like the list itself — a star is a shared marker, not an edit.
    @Patch(':id/star')
    setStarred(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StarProjectDto) {
        return this.partnerProjectsService.setStarred(id, dto.is_starred);
    }

    @Can('inventory.manage')
    @Delete(':id')
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        await this.partnerProjectsService.remove(id);
        return { message: 'Partner project deleted successfully' };
    }
}
