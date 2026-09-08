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
import { ListingsService } from './listings.service.js';
import { CreateListingDto } from './create-listing.dto.js'; 
import { UpdateListingDto } from './update-listing.dto.js';
import { FindListingsDto } from './find-listings.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { AdminGuard } from '../strategies/admin.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

@Controller('listings')
@UseGuards(JwtAuthGuard)
export class ListingsController {
    constructor(private readonly listingsService: ListingsService) { }

    @UseGuards(AdminGuard)
    @Post()
    create(@Body() dto: CreateListingDto, @UserSession() user: any) {
        return this.listingsService.create(dto, user.userId, user);
    }

    @Get()
    findAll(@Query() query: FindListingsDto, @UserSession() user: any) {
        return this.listingsService.findAll(query, user);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string, @UserSession() user: any) {
        return this.listingsService.findOne(id, user);
    }

    // No AdminGuard: the service lets the listing's own agent through, admins for any.
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateListingDto, @UserSession() user: any) {
        return this.listingsService.update(id, dto, user);
    }

    @UseGuards(AdminGuard)
    @Delete(':id')
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        await this.listingsService.remove(id);
        return { message: 'Listing deleted successfully' };
    }
}
