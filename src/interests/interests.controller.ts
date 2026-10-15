import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { InterestsService } from './interests.service.js';
import { CreateInterestDto } from './create-interest.dto.js';
import { UpdateInterestDto } from './update-interest.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { Can } from '../access/permission.guard.js';

@Controller('interests')
@UseGuards(JwtAuthGuard)
export class InterestsController {
    constructor(private readonly interestsService: InterestsService) { }

    @Post()
    @Can('settings.manage')
    create(@Body() dto: CreateInterestDto) {
        return this.interestsService.create(dto);
    }

    @Get()
    findAll() {
        return this.interestsService.findAll();
    }

    @Patch(':id')
    @Can('settings.manage')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInterestDto) {
        return this.interestsService.update(id, dto);
    }

    @Delete(':id')
    @Can('settings.manage')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.interestsService.remove(id);
    }
}
