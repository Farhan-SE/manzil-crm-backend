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
import { FindLeadsDto, FindPipelineDto, StarLeadDto } from './find-leads.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { Can } from '../access/permission.guard.js';
import { UserSession } from '../strategies/user.decorator.js';
import { BulkAssignDto } from '../common/bulk-assign.dto.js';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
    constructor(private readonly leadsService: LeadsService) { }
    // Without leads.assign the lead is the creator's own, and only on a client they can see.
    @Can('leads.create')
    @Post()
    create(@Body() dto: CreateLeadDto, @UserSession() user: any) {
        return this.leadsService.create(dto, user);
    }

    @Can('leads.assign')
    @Post('bulk-assign')
    bulkAssign(@Body() dto: BulkAssignDto) {
        return this.leadsService.bulkAssign(dto.ids, dto.assigned_to_id);
    }

    @Can('leads.import')
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

    @Get('pipeline')
    findPipeline(@Query() query: FindPipelineDto, @UserSession() user: any) {
        return this.leadsService.findPipeline(query, user);
    }

    @Get()
    findAll(@Query() query: FindLeadsDto, @UserSession() user: any) {
        return this.leadsService.findAll(query, user);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string, @UserSession() user: any) {
        return this.leadsService.findOne(id, user);
    }

    // No permission guard: the service checks leads.edit against the lead's owner.
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto, @UserSession() user: any) {
        return this.leadsService.update(id, dto, user);
    }
    
    @Patch(':id/star')
    setStarred(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StarLeadDto, @UserSession() user: any) {
        return this.leadsService.setStarred(id, dto.is_starred, user);
    }

    @Can('leads.delete')
    @Delete(':id')
     async remove(@Param('id', ParseUUIDPipe) id: string) {
        await this.leadsService.remove(id);
        return {message: 'Lead deleted Successfully'};
    }
}
