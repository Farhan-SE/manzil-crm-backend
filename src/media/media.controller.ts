import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Can } from '../access/permission.guard.js';
import type { Requester } from '../access/access.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { UserSession } from '../strategies/user.decorator.js';
import { FindMediaDto, StartMediaUploadDto } from './media.dto.js';
import { MediaShareService } from './media-share.service.js';
import { MediaService } from './media.service.js';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
    constructor(private readonly mediaService: MediaService) { }

    @Get()
    list(@Query() query: FindMediaDto) {
        return this.mediaService.list(query);
    }

    @Can('inventory.manage')
    @Post('uploads')
    start(@Body() dto: StartMediaUploadDto, @UserSession() user: Requester) {
        return this.mediaService.startUpload(dto, user.userId);
    }

    @Can('inventory.manage')
    @Post(':id/complete')
    complete(@Param('id', ParseUUIDPipe) id: string) {
        return this.mediaService.completeUpload(id);
    }

    @Can('inventory.manage')
    @Delete(':id')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.mediaService.remove(id);
    }
}

@Controller('media-links')
@UseGuards(JwtAuthGuard)
export class MediaLinksController {
    constructor(private readonly shares: MediaShareService) { }

    @Get()
    listForLead(@Query('lead_id', ParseUUIDPipe) leadId: string) {
        return this.shares.listForLead(leadId);
    }

    @Can('leads.edit')
    @Patch(':id/revoke')
    revoke(@Param('id', ParseUUIDPipe) id: string) {
        return this.shares.revoke(id);
    }
}

// Public: a client opens it from WhatsApp. The token in the link is the only key.
@Controller('public/media-links')
@UseGuards(ThrottlerGuard)
export class PublicMediaLinksController {
    constructor(private readonly shares: MediaShareService) { }

    @Throttle({ default: { ttl: 60_000, limit: 30 } })
    @Get(':token')
    @Header('Cache-Control', 'no-store')
    @Header('X-Robots-Tag', 'noindex')
    view(@Param('token') token: string) {
        return this.shares.view(token);
    }
}
