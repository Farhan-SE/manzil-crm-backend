import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isValidSignature, parseFailedDeliveries, parseTextMessages } from './whatsapp-webhook.js';

function delivery(messages: object[], contacts: object[] = []) {
    return {
        object: 'whatsapp_business_account',
        entry: [{
            changes: [{
                field: 'messages',
                value: { metadata: { phone_number_id: '1429722320216437' }, contacts, messages },
            }],
        }],
    };
}

describe('parseTextMessages', () => {
    it('reads a text message with the sender and their profile name', () => {
        const payload = delivery(
            [{ id: 'wamid.1', from: '923001234567', type: 'text', text: { body: '  bhai muje rent per house chahiye ' } }],
            [{ wa_id: '923001234567', profile: { name: 'Ali' } }],
        );
        expect(parseTextMessages(payload)).toEqual([{
            messageId: 'wamid.1',
            senderId: '923001234567',
            customerName: 'Ali',
            phoneNumberId: '1429722320216437',
            text: 'bhai muje rent per house chahiye',
        }]);
    });

    it('skips status receipts, media and empty text', () => {
        const receipt = { ...delivery([]), entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: '1' }, statuses: [{}] } }] }] };
        expect(parseTextMessages(receipt)).toEqual([]);
        expect(parseTextMessages(delivery([{ id: 'wamid.2', from: '92300', type: 'image', image: { id: 'x' } }]))).toEqual([]);
        expect(parseTextMessages(delivery([{ id: 'wamid.3', from: '92300', type: 'text', text: { body: '   ' } }]))).toEqual([]);
    });

    it('ignores anything that is not a WhatsApp delivery', () => {
        expect(parseTextMessages(null)).toEqual([]);
        expect(parseTextMessages({ object: 'page', entry: [] })).toEqual([]);
    });
});

describe('parseFailedDeliveries', () => {
    const statuses = (list: object[]) => ({
        object: 'whatsapp_business_account',
        entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: '1' }, statuses: list } }] }],
    });

    it('reports failed replies with Meta\'s reason and skips the rest', () => {
        const payload = statuses([
            { id: 'wamid.sent', status: 'sent', recipient_id: '923001234567' },
            {
                id: 'wamid.failed',
                status: 'failed',
                recipient_id: '923001234567',
                errors: [{ code: 131031, title: 'Business Account locked', error_data: { details: 'Business account has been locked.' } }],
            },
        ]);
        expect(parseFailedDeliveries(payload)).toEqual([{
            messageId: 'wamid.failed',
            recipientId: '923001234567',
            errors: [{ code: 131031, title: 'Business Account locked', detail: 'Business account has been locked.' }],
        }]);
    });
});

describe('isValidSignature', () => {
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    const sign = (secret: string) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

    it('accepts a body signed with the app secret', () => {
        expect(isValidSignature(body, sign('app-secret'), 'app-secret')).toBe(true);
    });

    it('rejects a wrong secret, a missing header or a tampered body', () => {
        expect(isValidSignature(body, sign('other'), 'app-secret')).toBe(false);
        expect(isValidSignature(body, undefined, 'app-secret')).toBe(false);
        expect(isValidSignature(body, 'sha256=abc', 'app-secret')).toBe(false);
        expect(isValidSignature(Buffer.from('{}'), sign('app-secret'), 'app-secret')).toBe(false);
    });
});
