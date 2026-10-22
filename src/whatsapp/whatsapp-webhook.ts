import { createHmac, timingSafeEqual } from 'node:crypto';

export interface IncomingWhatsappText {
    messageId: string;
    /** The customer's WhatsApp number, digits only with the country code. */
    senderId: string;
    customerName: string | null;
    phoneNumberId: string;
    text: string;
}

/** Meta signs each delivery with the app secret, so a forged webhook can't put words in a customer's mouth. */
export function isValidSignature(rawBody: Buffer | undefined, header: string | undefined, appSecret: string): boolean {
    if (!rawBody || !header?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', appSecret).update(rawBody).digest();
    const given = Buffer.from(header.slice('sha256='.length), 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface FailedWhatsappDelivery {
    messageId: string;
    recipientId: string;
    errors: { code: number; title: string; detail?: string }[];
}

/** Replies Meta accepted but couldn't deliver; the send call itself succeeds for these. */
export function parseFailedDeliveries(payload: unknown): FailedWhatsappDelivery[] {
    const root = payload as Record<string, any> | null;
    if (root?.object !== 'whatsapp_business_account' || !Array.isArray(root.entry)) return [];
    return root.entry
        .flatMap((entry: any) => (Array.isArray(entry?.changes) ? entry.changes : []))
        .flatMap((change: any) => (Array.isArray(change?.value?.statuses) ? change.value.statuses : []))
        .filter((status: any) => status?.status === 'failed')
        .map((status: any) => ({
            messageId: String(status.id),
            recipientId: String(status.recipient_id),
            errors: (Array.isArray(status.errors) ? status.errors : []).map((e: any) => ({
                code: Number(e?.code),
                title: String(e?.title ?? ''),
                detail: e?.error_data?.details,
            })),
        }));
}

// Delivery and read receipts arrive on the same "messages" field but carry no messages array.
export function parseTextMessages(payload: unknown): IncomingWhatsappText[] {
    if (!payload || typeof payload !== 'object') return [];
    const root = payload as Record<string, any>;
    if (root.object !== 'whatsapp_business_account' || !Array.isArray(root.entry)) return [];

    const found: IncomingWhatsappText[] = [];
    for (const entry of root.entry) {
        for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
            if (change?.field !== 'messages') continue;
            const value = change.value;
            const phoneNumberId = value?.metadata?.phone_number_id;
            if (!phoneNumberId) continue;

            const contacts = Array.isArray(value.contacts) ? value.contacts : [];
            for (const message of Array.isArray(value.messages) ? value.messages : []) {
                const text = message?.type === 'text' ? String(message.text?.body ?? '').trim() : '';
                if (!message?.from || !message?.id || !text) continue;
                const contact = contacts.find((c: any) => c?.wa_id === message.from) ?? contacts[0];
                found.push({
                    messageId: String(message.id),
                    senderId: String(message.from),
                    customerName: contact?.profile?.name ? String(contact.profile.name) : null,
                    phoneNumberId: String(phoneNumberId),
                    text,
                });
            }
        }
    }
    return found;
}
