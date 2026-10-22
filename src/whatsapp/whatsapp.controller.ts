import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Headers,
    HttpCode,
    Logger,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { SuperAdminGuard } from '../strategies/super-admin.guard.js';
import { AddWhatsappNumberDto } from './whatsapp.dto.js';
import { isValidSignature } from './whatsapp-webhook.js';
import { WhatsappService } from './whatsapp.service.js';

// Public: Meta calls it. The verify token guards the subscription, the app-secret signature each delivery.
@Controller('whatsapp/webhook')
export class WhatsappWebhookController {
    private readonly logger = new Logger(WhatsappWebhookController.name);

    constructor(private readonly whatsappService: WhatsappService) { }

    @Get()
    verify(
        @Query('hub.mode') mode?: string,
        @Query('hub.verify_token') token?: string,
        @Query('hub.challenge') challenge?: string,
    ) {
        const expected = process.env.WHATSAPP_VERIFY_TOKEN;
        if (mode === 'subscribe' && expected && token === expected && challenge) return challenge;
        throw new ForbiddenException('Invalid WhatsApp webhook verification');
    }

    @Post()
    @HttpCode(200)
    receive(@Req() req: RawBodyRequest<Request>, @Headers('x-hub-signature-256') signature?: string) {
        const secret = process.env.WHATSAPP_APP_SECRET;
        if (!secret || !isValidSignature(req.rawBody, signature, secret)) {
            this.logger.warn('WhatsApp webhook rejected: invalid signature');
            throw new UnauthorizedException('Invalid WhatsApp webhook signature');
        }
        this.logger.log('WhatsApp webhook received and signature verified');
        // Acknowledge at once: Meta retries a delivery that takes too long, replaying the customer's message.
        void this.whatsappService.handleWebhook(req.body).catch((error) =>
            this.logger.error('WhatsApp webhook processing failed', error),
        );
        return { received: true };
    }
}

@Controller('platform/companies/:tenantId/whatsapp-numbers')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class WhatsappNumbersController {
    constructor(private readonly whatsappService: WhatsappService) { }

    @Get()
    list(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
        return this.whatsappService.listNumbers(tenantId);
    }

    @Post()
    add(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Body() dto: AddWhatsappNumberDto) {
        return this.whatsappService.addNumber(tenantId, dto);
    }

    @Delete(':id')
    remove(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.whatsappService.removeNumber(tenantId, id);
    }
}
