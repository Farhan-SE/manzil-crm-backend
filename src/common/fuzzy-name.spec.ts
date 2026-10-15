import { describe, expect, it } from 'vitest';
import { closestName } from './fuzzy-name.js';

const projects = [
    { name: 'Park View City Lahore' },
    { name: 'Pearl One' },
    { name: 'DHA Phase 1' },
    { name: 'Tower A' },
    { name: 'Bahria Sky Residences' },
];
const match = (typed: string) => closestName(typed, projects)?.name ?? null;

describe('closestName', () => {
    it('matches regardless of case, spacing and punctuation', () => {
        expect(match('pearl one')).toBe('Pearl One');
        expect(match('  PEARL   ONE ')).toBe('Pearl One');
        expect(match('Pearl-One.')).toBe('Pearl One');
    });

    it('matches a name with a typo', () => {
        expect(match('Park Viw City Lahore')).toBe('Park View City Lahore');
        expect(match('Park Veiw City Lahore')).toBe('Park View City Lahore');
        expect(match('Bahria Sky Residence')).toBe('Bahria Sky Residences');
        expect(match('Parkview City Lahore')).toBe('Park View City Lahore');
    });

    it('keeps phases and blocks with different numbers or letters apart', () => {
        expect(match('DHA Phase 2')).toBeNull();
        expect(match('DHA Phase 1')).toBe('DHA Phase 1');
        expect(match('Tower B')).toBeNull();
    });

    it("doesn't match a different name", () => {
        expect(match('Capital Smart Homes')).toBeNull();
        expect(match('Park')).toBeNull();
        expect(match('')).toBeNull();
    });
});
