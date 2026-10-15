import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Put,
    Query,
    Res,
    StreamableFile,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { SuperAdminGuard } from '../strategies/super-admin.guard.js';
import { TenantsService, type UploadedLogo } from './tenants.service.js';
import { CreateTenantDto, FindTenantsDto, UpdateTenantDto } from './tenant.dto.js';

const MAX_LOGO_BYTES = 1024 * 1024;

@Controller('platform/companies')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class TenantsController {
    constructor(private readonly tenantsService: TenantsService) { }

    @Post()
    create(@Body() dto: CreateTenantDto) {
        return this.tenantsService.create(dto);
    }

    @Get()
    findAll(@Query() query: FindTenantsDto) {
        return this.tenantsService.findAll(query);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.tenantsService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantDto) {
        return this.tenantsService.update(id, dto);
    }

    @Put(':id/logo')
    @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: MAX_LOGO_BYTES } }))
    setLogo(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: UploadedLogo | undefined) {
        return this.tenantsService.setLogo(id, file);
    }

    @Delete(':id/logo')
    removeLogo(@Param('id', ParseUUIDPipe) id: string) {
        return this.tenantsService.removeLogo(id);
    }
}

// Public: an <img> can't send a token. A logo is no secret, and the URL needs the company's uuid.
@Controller('companies')
export class CompanyLogoController {
    constructor(private readonly tenantsService: TenantsService) { }

    @Get(':id/logo')
    async logo(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
        const { data, mime } = await this.tenantsService.getLogo(id);
        // The URL carries ?v=<upload time>, so a cached copy is never stale.
        res.set({
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
            'Cross-Origin-Resource-Policy': 'cross-origin',
        });
        return new StreamableFile(data);
    }
}
