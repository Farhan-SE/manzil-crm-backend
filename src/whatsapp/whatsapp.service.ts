import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { runInTenant } from '../tenants/tenant-context.js';
import { InventorySearch } from './inventory-search.js';
import { PropertyChatClient } from './property-chat.client.js';
import { inventoryReply } from './property-reply.js';
import { WhatsappClient } from './whatsapp.client.js';
import { WhatsappLeadService } from './whatsapp-lead.service.js';
import { WhatsappNumber } from './whatsapp-number.entity.js';
import { parseFailedDeliveries, parseTextMessages, type IncomingWhatsappText } from './whatsapp-webhook.js';
import type { AddWhatsappNumberDto } from './whatsapp.dto.js';

const DEDUP_MS = 10 * 60 * 1000;

// Sent when no chatbot is configured (AI_SERVICE_URL unset), so the round trip through Meta can still be tested.
const PLACEHOLDER_REPLY = 'Thanks for your message! Our team will get back to you shortly.';

@Injectable()
export class WhatsappService {
    private readonly logger = new Logger(WhatsappService.name);
    // Meta redelivers a message it isn't sure arrived; one process sees it once.
    private readonly seen = new Set<string>();

    constructor(
        @InjectRepository(WhatsappNumber) private readonly numbers: Repository<WhatsappNumber>,
        private readonly whatsapp: WhatsappClient,
        private readonly propertyChat: PropertyChatClient,
        private readonly inventory: InventorySearch,
        private readonly leads: WhatsappLeadService,
    ) { }

    async handleWebhook(payload: unknown): Promise<void> {
        for (const failed of parseFailedDeliveries(payload)) {
            const reasons = failed.errors.map((e) => `${e.code} ${e.title}${e.detail ? ` — ${e.detail}` : ''}`).join('; ');
            this.logger.warn(`WhatsApp reply ${failed.messageId} to ${failed.recipientId} was not delivered: ${reasons}`);
        }
        for (const message of parseTextMessages(payload)) {
            this.logger.log(`WhatsApp text message ${message.messageId} received for number ${message.phoneNumberId}`);
            if (this.seen.has(message.messageId)) continue;
            this.seen.add(message.messageId);
            setTimeout(() => this.seen.delete(message.messageId), DEDUP_MS).unref();

            try {
                await this.handleMessage(message);
            } catch (error) {
                this.logger.error(`WhatsApp message ${message.messageId} failed`, error as Error);
            }
        }
    }

    private async handleMessage(message: IncomingWhatsappText): Promise<void> {
        const number = await this.numbers.findOne({ where: { phone_number_id: message.phoneNumberId } });
        if (!number) {
            this.logger.warn(`WhatsApp number ${message.phoneNumberId} isn't linked to a company — message ignored`);
            return;
        }
        const send = (body: string) => this.whatsapp.sendText(message.phoneNumberId, message.senderId, body);

        if (!this.propertyChat.isConfigured()) {
            await send(PLACEHOLDER_REPLY);
            this.logger.log(`WhatsApp reply accepted by Meta for message ${message.messageId}`);
            return;
        }

        const turn = await this.propertyChat.send(message.text, `${message.phoneNumberId}:${message.senderId}`);
        if (turn.reply) await send(turn.reply);
        await runInTenant(number.tenant_id, async () => {
            if (turn.search) {
                const result = await this.inventory.find(number.tenant_id, turn.parameters);
                await send(inventoryReply(result, turn.parameters, turn.reply_language));
                this.logger.log(`WhatsApp enquiry ${turn.lead_key} matched ${result.total} units`);
            }
            // The customer has had their answer; a failure here is staff-side only.
            await this.leads.save(number.tenant_id, message, turn).catch((error) =>
                this.logger.error(`Couldn't save the WhatsApp lead for ${message.messageId}`, error as Error),
            );
        });
        this.logger.log(`WhatsApp reply accepted by Meta for message ${message.messageId}`);
    }

    listNumbers(tenantId: string) {
        return this.numbers.find({ where: { tenant_id: tenantId }, order: { created_at: 'ASC' } });
    }

    async addNumber(tenantId: string, dto: AddWhatsappNumberDto) {
        const taken = await this.numbers.findOne({ where: { phone_number_id: dto.phone_number_id } });
        if (taken) throw new ConflictException('That WhatsApp number is already linked to a company');
        return this.numbers.save(this.numbers.create({
            tenant_id: tenantId,
            phone_number_id: dto.phone_number_id,
            display_phone: dto.display_phone ?? null,
        }));
    }

    async removeNumber(tenantId: string, id: string) {
        const result = await this.numbers.delete({ id, tenant_id: tenantId });
        if (!result.affected) throw new NotFoundException('WhatsApp number not found');
        return { status: 'deleted' };
    }
}
