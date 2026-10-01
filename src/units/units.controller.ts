import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
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
import { UnitsService } from './units.service.js';
import { CreateUnitDto, FindUnitsDto, ImportUnitsDto, UpdateUnitDto } from './unit.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { AdminGuard } from '../strategies/admin.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

@Controller('units')
@UseGuards(JwtAuthGuard)
export class UnitsController {
    constructor(private readonly unitsService: UnitsService) { }

    @UseGuards(AdminGuard)
    @Post()
    create(@Body() dto: CreateUnitDto, @UserSession() user: any) {
        return this.unitsService.create(dto, user.userId);
    }

    @UseGuards(AdminGuard)
    @Post('import')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
    importCsv(@UploadedFile() file: UploadedCsv, @Query() query: ImportUnitsDto, @UserSession() user: any) {
        if (!file) throw new BadRequestException('No file uploaded');
        return this.unitsService.importCsv(file.buffer, query.project_id, user.userId);
    }

    @Get()
    findAll(@Query() query: FindUnitsDto) {
        return this.unitsService.findAll(query);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.unitsService.findOne(id);
    }

    @UseGuards(AdminGuard)
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitDto) {
        return this.unitsService.update(id, dto);
    }

    @UseGuards(AdminGuard)
    @Delete(':id')
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        await this.unitsService.remove(id);
        return { message: 'Unit deleted successfully' };
    }
}
