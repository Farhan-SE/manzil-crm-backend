const FILLER = ['phase', 'block', 'sector', 'town'];
const CITIES = ['lahore', 'karachi', 'islamabad', 'rawalpindi'];

/** Edits to turn one word into the other, counting a swap of two neighbouring letters as one. */
function editDistance(a: string, b: string) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
    }
    return d[a.length][b.length];
}

/** Same word, allowing a typo: one slip in words of 4–7 letters, two in longer ones. */
function sameWord(typed: string, word: string) {
    if (typed === word) return true;
    if (typed.length < 4 || /^\d+$/.test(typed)) return false;
    return editDistance(typed, word) <= (typed.length >= 8 ? 2 : 1);
}

const tokens = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** The words of a customer's area that must each appear in a project's place, e.g. "DHA Pahse 6 Lahore" → dha, 6. */
export function areaWords(area: string): string[] {
    const words = tokens(area)
        .filter((w) => /^\d+$/.test(w) || w.length >= 3)
        .filter((w) => !FILLER.some((f) => sameWord(w, f)));
    const specific = words.filter((w) => !CITIES.some((c) => sameWord(w, c)));
    return specific.length ? specific : words;
}

export function placeMatches(place: string, words: string[]): boolean {
    const text = place.toLowerCase();
    const placeTokens = tokens(place);
    return words.every((word) =>
        /^\d+$/.test(word)
            ? placeTokens.includes(word)
            : text.includes(word) || placeTokens.some((token) => sameWord(word, token)),
    );
}
