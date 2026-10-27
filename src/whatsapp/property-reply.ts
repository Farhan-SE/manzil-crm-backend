import type { InventorySearchResult } from './inventory-search.js';
import type { PropertyEnquiry } from './property-chat.client.js';

const PORTION = { upper: 'upper portion', lower: 'lower portion', full: 'full house' };

/** 75000 → "75,000", 5000000 → "50 lakh", 15000000 → "1.5 crore". */
export function formatPrice(amount: number) {
    if (amount >= 10_000_000) return `${+(amount / 10_000_000).toFixed(2)} crore`;
    if (amount >= 100_000) return `${+(amount / 100_000).toFixed(2)} lakh`;
    return amount.toLocaleString('en-US');
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
    /** Share link per unit id, shown under that property. */
    photoLinks: ReadonlyMap<string, string> = new Map(),
) {
    const en = language === 'en';
    if (result.total === 0) {
        return en
            ? "We're sorry, no property matching your requirements is available at the moment. You can share a different area or budget and I'll check again, and our team will also contact you shortly."
            : 'Maazrat, is waqt aap ki requirement ke mutabiq koi property available nahi hai. Aap koi aur area ya budget bata dein to main dobara check kar leta hoon. Hamari team bhi jald aap se rabta karegi.';
    }

    const blocks = result.shown.map((match, i) => {
        const kind = match.unitType || (enquiry.portion && !portionsInstead ? PORTION[enquiry.portion] : null);
        const summary = [
            kind ? kind[0].toUpperCase() + kind.slice(1) : null,
            match.beds ? `${match.beds} bedroom${match.beds === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' | ');
        const price = `Rs ${formatPrice(match.price)}${enquiry.purpose === 'rent' ? (en ? ' per month' : ' mahana') : ''}`;
        const link = photoLinks.get(match.unitId);
        return [
            `${i + 1}. *${match.project}* (Unit ${match.unitNumber})`,
            match.location ? `   ${match.location}` : null,
            `   ${[summary, price].filter(Boolean).join(' | ')}`,
            link ? `   ${en ? 'Photos & videos' : 'Tasveerein aur videos'}: ${link}` : null,
        ].filter(Boolean).join('\n');
    });
    const more = result.total > result.shown.length;
    const count = (n: number) => `${n} ${n === 1 ? 'property' : 'properties'}`;

    const heading = portionsInstead
        ? en
            ? `A full house isn't available right now, but we have ${result.total} ${result.total === 1 ? 'portion' : 'portions'} that match your requirements:`
            : `Poora ghar is waqt available nahi, lekin aap ki requirement ke mutabiq hamare paas ${result.total} ${result.total === 1 ? 'portion' : 'portions'} available ${result.total === 1 ? 'hai' : 'hain'}:`
        : en
        ? `Thank you. We have ${count(result.total)} matching your requirements:`
        : `Shukriya. Aap ki requirement ke mutabiq hamare paas ${count(result.total)} available ${result.total === 1 ? 'hai' : 'hain'}:`;
    const moreNote = more
        ? en
            ? `These are the ${result.shown.length} best-priced options (prices range from ${range(result)}).`
            : `Yeh sab se munasib qeemat wali ${result.shown.length} properties hain (qeematein ${range(result)} tak).`
        : null;
    const photos = photoLinks.size
        ? en
            ? 'The photo links stay active for 2 days.'
            : 'Tasveeron ke links 2 din tak active rahenge.'
        : result.shown.some((match) => match.mediaCount > 0)
        ? en
            ? 'To view photos and videos of a property, reply with its number (for example, 1).'
            : 'Kisi property ki tasveerein aur videos dekhne ke liye us ka number reply karein (maslan 1).'
        : null;
    const closing = en
        ? 'Our representative will contact you shortly to arrange a visit.'
        : 'Hamara representative jald aap se rabta kar ke visit ka waqt tay karega.';
    return [heading, blocks.join('\n\n'), moreNote, [photos, closing].filter(Boolean).join('\n')].filter(Boolean).join('\n\n');
}

export interface OfferedUnit { project: string; unit_number: string }

/** The answers to "send me pictures of number N". */
export const mediaReply = {
    whichOne: (count: number, language: 'ur' | 'en') =>
        language === 'en'
            ? `Which property would you like to see? Please reply with its number from the list (1–${count}).`
            : `Aap kaun si property dekhna chahenge? Barah-e-karam list mein se us ka number reply karein (1–${count}).`,
    nothingListed: (language: 'ur' | 'en') =>
        language === 'en'
            ? "I haven't shared any properties with you yet. Please tell me the area and your budget, and I'll find suitable options."
            : 'Abhi tak aap ko koi property share nahi ki gayi. Barah-e-karam area aur budget bata dein, main aap ke liye munasib properties dhoond deta hoon.',
    notOnList: (count: number, language: 'ur' | 'en') =>
        language === 'en'
            ? `That number isn't on the list. Please reply with a number from 1 to ${count}.`
            : `Yeh number list mein shamil nahi. Barah-e-karam 1 se ${count} tak koi number reply karein.`,
    /** `link` is null when the unit has nothing to show. */
    link: (unit: OfferedUnit, link: string | null, language: 'ur' | 'en') => {
        const name = `*${unit.project}* (Unit ${unit.unit_number})`;
        if (!link) {
            return language === 'en'
                ? `Photos of ${name} aren't available yet. Our team will share them with you shortly.`
                : `${name} ki tasveerein abhi available nahi hain. Hamari team jald aap ko share kar degi.`;
        }
        return language === 'en'
            ? `Here are the photos and videos of ${name}:\n${link}\n\nThis link will stay active for 2 days. Let me know if you'd like to schedule a visit.`
            : `${name} ki tasveerein aur videos is link par dekh sakte hain:\n${link}\n\nYeh link 2 din tak active rahega. Visit schedule karni ho to bata dein.`;
    },
};
