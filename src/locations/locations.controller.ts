import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { LocationsService } from './locations.service.js';
import { FindLocationsDto, StarLocationDto, UpdateLocationDto } from './location.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { AdminGuard } from '../strategies/admin.guard.js';

@Controller('locations')
@UseGuards(JwtAuthGuard)
export class LocationsController {
    constructor(private readonly locationsService: LocationsService) { }

    @Get()
    findAll(@Query() query: FindLocationsDto) {
        return this.locationsService.findAll(query);
    }

    @UseGuards(AdminGuard)
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLocationDto) {
        return this.locationsService.update(id, dto);
    }

    // Open to every agent, like the list itself — a star is a shared marker, not an edit.
    @Patch(':id/star')
    setStarred(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StarLocationDto) {
        return this.locationsService.setStarred(id, dto.is_starred);
    }
}
