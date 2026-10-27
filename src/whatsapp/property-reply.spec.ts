import { describe, expect, it } from 'vitest';
import { formatPrice, inventoryReply } from './property-reply.js';
import type { PropertyEnquiry } from './property-chat.client.js';

const upperPortionToRent: PropertyEnquiry = {
    purpose: 'rent', property_type: 'house', area: 'DHA Phase 6', portion: 'upper', beds: null, budget: 60_000,
};

describe('formatPrice', () => {
    it('writes amounts the way customers say them', () => {
        expect(formatPrice(55_000)).toBe('55,000');
        expect(formatPrice(5_000_000)).toBe('50 lakh');
        expect(formatPrice(15_000_000)).toBe('1.5 crore');
    });
});

describe('inventoryReply', () => {
    it('lists the cheapest matches one per block, in Roman Urdu', () => {
        const reply = inventoryReply({
            total: 3,
            minPrice: 55_000,
            maxPrice: 60_000,
            shown: [
                { unitId: 'u1', unitNumber: 'U1', project: 'DHA Phase 6', location: 'DHA Phase 6, Lahore', unitType: 'Upper Portion', beds: 2, price: 55_000, mediaCount: 3 },
                { unitId: 'u2', unitNumber: 'U2', project: 'DHA Phase 6', location: null, unitType: null, beds: 2, price: 58_000, mediaCount: 0 },
            ],
        }, upperPortionToRent, 'ur');

        expect(reply).toContain('hamare paas 3 properties available hain:');
        expect(reply).toContain('1. *DHA Phase 6* (Unit U1)\n   DHA Phase 6, Lahore\n   Upper Portion | 2 bedrooms | Rs 55,000 mahana');
        expect(reply).toContain('2. *DHA Phase 6* (Unit U2)\n   Upper portion | 2 bedrooms | Rs 58,000 mahana');
        expect(reply).toContain('(qeematein Rs 55,000 – 60,000 tak)');
        expect(reply).toContain('us ka number reply karein');
        expect(reply).not.toContain('📷');
    });

    it('puts each photo link right under its property', () => {
        const reply = inventoryReply({
            total: 1,
            minPrice: 75_000,
            maxPrice: 75_000,
            shown: [{ unitId: 'u1', unitNumber: 'C-11', project: 'Bahria Town Apartments', location: null, unitType: 'Apartment', beds: 2, price: 75_000, mediaCount: 4 }],
        }, { ...upperPortionToRent, portion: null }, 'ur', false, new Map([['u1', 'https://crm.test/view/abc']]));

        expect(reply).toContain('Apartment | 2 bedrooms | Rs 75,000 mahana\n   Tasveerein aur videos: https://crm.test/view/abc');
        expect(reply).toContain('2 din tak active');
        expect(reply).not.toContain('number reply karein');
    });

    it('says so plainly when nothing matches', () => {
        const reply = inventoryReply({ total: 0, minPrice: null, maxPrice: null, shown: [] }, upperPortionToRent, 'en');
        expect(reply).toMatch(/^We're sorry, no property matching your requirements/);
    });

    it('says a full house is not available when it offers portions instead', () => {
        const reply = inventoryReply({
            total: 1,
            minPrice: 55_000,
            maxPrice: 55_000,
            shown: [{ unitId: 'u1', unitNumber: 'U1', project: 'DHA Phase 6', location: null, unitType: null, beds: 2, price: 55_000, mediaCount: 0 }],
        }, { ...upperPortionToRent, portion: 'full' }, 'ur', true);

        expect(reply).toContain('Poora ghar is waqt available nahi, lekin aap ki requirement ke mutabiq hamare paas 1 portion available hai');
        expect(reply).not.toContain('full house');
    });
});
