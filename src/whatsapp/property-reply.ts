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
export function inventoryReply(
    result: InventorySearchResult,
    enquiry: PropertyEnquiry,
    language: 'ur' | 'en',
    /** No full house matched, so these are the portions that did. */
    portionsInstead = false,
) {
    const en = language === 'en';
    if (result.total === 0) {
        return en
            ? "Nothing matches these details right now. Our team will get in touch shortly — or tell me a different area or budget and I'll check again."
            : 'Is waqt in details ke mutabiq koi property available nahi. Hamari team aap se jald rabta karegi — ya koi aur area ya budget bata dein, main dobara dekh leta hoon.';
    }

    const lines = result.shown.map((match, i) => {
        const details = [
            match.beds ? `${match.beds} bed` : null,
            match.unitType || (enquiry.portion && !portionsInstead ? PORTION[enquiry.portion] : null),
            `Rs ${formatPrice(match.price)}${enquiry.purpose === 'rent' ? (en ? '/month' : ' mahana') : ''}`,
        ].filter(Boolean);
        return `${i + 1}. ${match.project} — ${details.join(', ')}${match.mediaCount ? ' 📷' : ''}`;
    });
    const more = result.total > result.shown.length;

    const heading = portionsInstead
        ? en
            ? `No full house is available right now, but ${result.total} ${result.total === 1 ? 'portion matches' : 'portions match'} your details (${range(result)}):`
            : `Poora ghar is waqt available nahi, lekin aap ki details ke mutabiq ${result.total} ${result.total === 1 ? 'portion' : 'portions'} available ${result.total === 1 ? 'hai' : 'hain'} (${range(result)}):`
        : en
        ? `${result.total} ${result.total === 1 ? 'property matches' : 'properties match'} your details (${range(result)}):`
        : `Aap ki details ke mutabiq ${result.total} ${result.total === 1 ? 'property' : 'properties'} available ${result.total === 1 ? 'hai' : 'hain'} (${range(result)}):`;
    const closing = en
        ? `${more ? 'These are the most affordable. ' : ''}Our team will contact you shortly to arrange a visit.`
        : `${more ? 'Ye sab se munasib qeemat wali hain. ' : ''}Hamari team aap se jald rabta karegi taake dekhne ka waqt tay ho sake.`;
    const photos = result.shown.some((match) => match.mediaCount > 0)
        ? en
            ? 'To see photos or videos of one marked 📷, reply with its number.'
            : 'Jis property par 📷 hai us ki tasveerein ya video dekhni hon to us ka number likh dein.'
        : null;
    return [heading, ...lines, closing, photos].filter(Boolean).join('\n');
}

export interface OfferedUnit { project: string; unit_number: string }

/** The answers to "send me pictures of number N". */
export const mediaReply = {
    whichOne: (count: number, language: 'ur' | 'en') =>
        language === 'en'
            ? `Which property would you like to see? Reply with its number from the list (1–${count}).`
            : `Kaun si property ki tasveerein dekhni hain? List mein se us ka number likh dein (1–${count}).`,
    nothingListed: (language: 'ur' | 'en') =>
        language === 'en'
            ? "I haven't sent you any properties yet. Tell me the area and budget and I'll find some."
            : 'Abhi aap ko koi property nahi bheji gayi. Area aur budget bata dein, main dhoond deta hoon.',
    notOnList: (count: number, language: 'ur' | 'en') =>
        language === 'en'
            ? `That number isn't on the list — reply with a number from 1 to ${count}.`
            : `Ye number list mein nahi — 1 se ${count} tak number likh dein.`,
    /** `link` is null when the unit has nothing to show. */
    link: (unit: OfferedUnit, link: string | null, language: 'ur' | 'en') => {
        const name = `${unit.project} (${unit.unit_number})`;
        if (!link) {
            return language === 'en'
                ? `There are no photos or videos of ${name} yet. Our team will send them to you shortly.`
                : `${name} ki tasveerein ya video abhi available nahi. Hamari team aap ko jald bhej degi.`;
        }
        return language === 'en'
            ? `Photos and videos of ${name}:\n${link}\nThe link works for 2 days.`
            : `${name} ki tasveerein aur videos yahan dekhein:\n${link}\nYe link 2 din tak chalega.`;
    },
};
