import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { SourcesService } from './sources.service.js';
import { CreateSourceDto } from './create-source.dto.js';
import { UpdateSourceDto } from './update-source.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { AdminGuard } from '../strategies/admin.guard.js';

@Controller('sources')
@UseGuards(JwtAuthGuard)
export class SourcesController {
    constructor(private readonly sourcesService: SourcesService) { }

    @Post()
    @UseGuards(AdminGuard)
    create(@Body() dto: CreateSourceDto) {
        return this.sourcesService.create(dto);
    }

    @Get()
    findAll() {
        return this.sourcesService.findAll();
    }

    @Patch(':id')
    @UseGuards(AdminGuard)
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSourceDto) {
        return this.sourcesService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(AdminGuard)
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.sourcesService.remove(id);
    }
}
