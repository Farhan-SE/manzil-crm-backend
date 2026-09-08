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
import { FindPartnerProjectsDto } from './find-partner-projects.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { AdminGuard } from '../strategies/admin.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

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
    findAll(@Query() query: FindPartnerProjectsDto) {
        return this.partnerProjectsService.findAll(query);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.partnerProjectsService.findOne(id);
    }

    @UseGuards(AdminGuard)
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePartnerProjectDto) {
        return this.partnerProjectsService.update(id, dto);
    }

    @UseGuards(AdminGuard)
    @Delete(':id')
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        await this.partnerProjectsService.remove(id);
        return { message: 'Partner project deleted successfully' };
    }
}
