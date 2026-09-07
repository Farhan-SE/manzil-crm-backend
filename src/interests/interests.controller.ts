import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { InterestsService } from './interests.service.js';
import { CreateInterestDto } from './create-interest.dto.js';
import { UpdateInterestDto } from './update-interest.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { AdminGuard } from '../strategies/admin.guard.js';

@Controller('interests')
@UseGuards(JwtAuthGuard)
export class InterestsController {
    constructor(private readonly interestsService: InterestsService) { }

    @Post()
    @UseGuards(AdminGuard)
    create(@Body() dto: CreateInterestDto) {
        return this.interestsService.create(dto);
    }

    @Get()
    findAll() {
        return this.interestsService.findAll();
    }

    @Patch(':id')
    @UseGuards(AdminGuard)
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInterestDto) {
        return this.interestsService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(AdminGuard)
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.interestsService.remove(id);
    }
}
