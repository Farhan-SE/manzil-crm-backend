/** How alike two names must be to count as the same one spelt differently. 1 is identical. */
const MIN_SIMILARITY = 0.85;

/** Lowercase words without punctuation, so "Pearl-One." and "pearl one" compare equal. */
export function normalizeName(name: string) {
    return name
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function editDistance(a: string, b: string) {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        previous = current;
    }
    return previous[b.length];
}

/**
 * The parts a typo can't explain: numbers and single letters. "Phase 1" and "Phase 2", or
 * "Tower A" and "Tower B", are different places however close the rest of the name is.
 */
function markers(normalized: string) {
    return normalized
        .split(' ')
        .filter((word) => /^\d+$/.test(word) || word.length === 1)
        .sort()
        .join(' ');
}

function similarity(a: string, b: string) {
    const longest = Math.max(a.length, b.length);
    return longest === 0 ? 1 : 1 - editDistance(a, b) / longest;
}

/**
 * The existing name a typed one most likely means: the same name ignoring case and punctuation,
 * or failing that the closest one spelt within a small margin. Null when nothing is close enough.
 */
export function closestName<T extends { name: string }>(typed: string, candidates: T[]): T | null {
    const target = normalizeName(typed);
    if (!target) return null;

    const exact = candidates.find((candidate) => normalizeName(candidate.name) === target);
    if (exact) return exact;

    let best: { candidate: T; score: number } | null = null;
    for (const candidate of candidates) {
        const name = normalizeName(candidate.name);
        if (markers(name) !== markers(target)) continue;
        // Spaces count too: "Parkview" and "Park View" are the same name.
        const score = Math.max(similarity(name, target), similarity(name.replace(/ /g, ''), target.replace(/ /g, '')));
        if (score >= MIN_SIMILARITY && (!best || score > best.score)) best = { candidate, score };
    }
    return best?.candidate ?? null;
}
