import { describe, expect, it } from 'vitest';
import { formatPrice, inventoryReply } from './property-reply.js';
import type { PropertyEnquiry } from './property-chat.client.js';

const upperPortionToRent: PropertyEnquiry = {
    purpose: 'rent', property_type: 'house', area: 'DHA Phase 6', portion: 'upper', beds: null, budget: 60_000,
};

describe('formatPrice', () => {
    it('writes amounts the way customers say them', () => {
        expect(formatPrice(55_000)).toBe('55k');
        expect(formatPrice(5_000_000)).toBe('50 lakh');
        expect(formatPrice(15_000_000)).toBe('1.5 crore');
    });
});

describe('inventoryReply', () => {
    it('lists the cheapest matches with the price range, in Roman Urdu', () => {
        const reply = inventoryReply({
            total: 3,
            minPrice: 55_000,
            maxPrice: 60_000,
            shown: [
                { project: 'DHA Phase 6', unitType: 'Upper Portion', beds: 2, price: 55_000 },
                { project: 'DHA Phase 6', unitType: null, beds: 2, price: 58_000 },
            ],
        }, upperPortionToRent, 'ur');

        expect(reply).toContain('3 properties available hain (Rs 55k – 60k)');
        expect(reply).toContain('• DHA Phase 6 — 2 bed, Upper Portion, Rs 55k mahana');
        expect(reply).toContain('• DHA Phase 6 — 2 bed, upper portion, Rs 58k mahana');
        expect(reply).toContain('sab se munasib');
    });

    it('says so plainly when nothing matches', () => {
        const reply = inventoryReply({ total: 0, minPrice: null, maxPrice: null, shown: [] }, upperPortionToRent, 'en');
        expect(reply).toMatch(/^Nothing matches these details right now/);
    });
});
