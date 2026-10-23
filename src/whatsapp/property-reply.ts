import type { InventorySearchResult } from './inventory-search.js';
import type { PropertyEnquiry } from './property-chat.client.js';

const PORTION = { upper: 'upper portion', lower: 'lower portion', full: 'full house' };

/** 55000 → "55k", 5000000 → "50 lakh", 15000000 → "1.5 crore". */
export function formatPrice(amount: number) {
    if (amount >= 10_000_000) return `${+(amount / 10_000_000).toFixed(2)} crore`;
    if (amount >= 100_000) return `${+(amount / 100_000).toFixed(2)} lakh`;
    if (amount >= 1_000) return `${+(amount / 1_000).toFixed(1)}k`;
    return String(amount);
}

function range(result: InventorySearchResult) {
    if (result.minPrice == null || result.maxPrice == null) return '';
    const min = formatPrice(result.minPrice);
    const max = formatPrice(result.maxPrice);
    return min === max ? `Rs ${min}` : `Rs ${min} – ${max}`;
}

/** The message that answers a completed enquiry with what the company has. */
export function inventoryReply(result: InventorySearchResult, enquiry: PropertyEnquiry, language: 'ur' | 'en') {
    const en = language === 'en';
    if (result.total === 0) {
        return en
            ? "Nothing matches these details right now. Our team will get in touch shortly — or tell me a different area or budget and I'll check again."
            : 'Is waqt in details ke mutabiq koi property available nahi. Hamari team aap se jald rabta karegi — ya koi aur area ya budget bata dein, main dobara dekh leta hoon.';
    }

    const lines = result.shown.map((match) => {
        const details = [
            match.beds ? `${match.beds} bed` : null,
            match.unitType || (enquiry.portion ? PORTION[enquiry.portion] : null),
            `Rs ${formatPrice(match.price)}${enquiry.purpose === 'rent' ? (en ? '/month' : ' mahana') : ''}`,
        ].filter(Boolean);
        return `• ${match.project} — ${details.join(', ')}`;
    });
    const more = result.total > result.shown.length;

    const heading = en
        ? `${result.total} ${result.total === 1 ? 'property matches' : 'properties match'} your details (${range(result)}):`
        : `Aap ki details ke mutabiq ${result.total} ${result.total === 1 ? 'property' : 'properties'} available ${result.total === 1 ? 'hai' : 'hain'} (${range(result)}):`;
    const closing = en
        ? `${more ? 'These are the most affordable. ' : ''}Our team will contact you shortly to arrange a visit.`
        : `${more ? 'Ye sab se munasib qeemat wali hain. ' : ''}Hamari team aap se jald rabta karegi taake dekhne ka waqt tay ho sake.`;
    return [heading, ...lines, closing].join('\n');
}
