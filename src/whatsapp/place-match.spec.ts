import { describe, expect, it } from 'vitest';
import { areaWords, placeMatches } from './place-match.js';

const dha6 = 'DHA Phase 6 (Test) DHA Phase 6 Lahore';

describe('areaWords', () => {
    it('drops filler words and the city, even misspelt, but keeps the phase number', () => {
        expect(areaWords('DHA Pahse 6 Lahore')).toEqual(['dha', '6']);
        expect(areaWords('Lahre')).toEqual(['lahre']);
    });
});

describe('placeMatches', () => {
    it('finds the project despite a typo in the area', () => {
        expect(placeMatches(dha6, areaWords('DHA Pahse 6'))).toBe(true);
        expect(placeMatches('Bahria Town Lahore', areaWords('bahira town'))).toBe(true);
        expect(placeMatches(dha6, areaWords('lahre'))).toBe(true);
    });

    it('does not mix up a different phase or a different place', () => {
        expect(placeMatches(dha6, areaWords('DHA Phase 5'))).toBe(false);
        expect(placeMatches(dha6, areaWords('park view'))).toBe(false);
    });
});
