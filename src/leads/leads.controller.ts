import {
    BadRequestException,
    Body,
    Controller,
    DefaultValuePipe,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadedCsv } from '../common/csv.js';
import { LeadsService } from './leads.service.js';
import { CreateLeadDto } from './create-lead.dto.js';
import { UpdateLeadDto } from './update-lead.dto.js';
import { FindLeadsDto } from './find-leads.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { AdminGuard } from '../strategies/admin.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
    constructor(private readonly leadsService: LeadsService) { }
    @UseGuards(AdminGuard)
    @Post()
    create(@Body() dto: CreateLeadDto, @UserSession() user: any) {
        return this.leadsService.create(dto, user.userId);
    }

    @UseGuards(AdminGuard)
    @Post('import')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
    importCsv(@UploadedFile() file: UploadedCsv, @UserSession() user: any) {
        if (!file) throw new BadRequestException('No file uploaded');
        return this.leadsService.importCsv(file.buffer, user.userId);
    }

    @Get('active')
    findActive(
        @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
        @UserSession() user: any,
    ) {
        return this.leadsService.findActive(limit, user);
    }

    @Get()
    findAll(@Query() query: FindLeadsDto, @UserSession() user: any) {
        return this.leadsService.findAll(query, user);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.leadsService.findOne(id);
    }

    // No AdminGuard: the service allows the lead's own agent through, admins for any lead.
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto, @UserSession() user: any) {
        return this.leadsService.update(id, dto, user);
    }
    
    @UseGuards(AdminGuard)
    @Delete(':id')
     async remove(@Param('id', ParseUUIDPipe) id: string) {
        await this.leadsService.remove(id);
        return {message: 'Lead deleted Successfully'};
    }
}
