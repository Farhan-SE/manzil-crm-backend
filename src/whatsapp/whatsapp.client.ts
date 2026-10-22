import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsappClient {
    private readonly logger = new Logger(WhatsappClient.name);

    /** A free-form reply. Meta only allows these within 24 hours of the customer's last message. */
    async sendText(phoneNumberId: string, to: string, body: string): Promise<void> {
        const token = process.env.WHATSAPP_ACCESS_TOKEN;
        if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not set');
        const version = process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0';

        const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'text',
                text: { body },
            }),
            signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            this.logger.error(`WhatsApp send to ${to} failed (${res.status}): ${detail}`);
            throw new Error(`WhatsApp send failed with ${res.status}`);
        }
    }
}
