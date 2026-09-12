import { getTournamentEntryStars } from '../utils/playerStars';

describe('getTournamentEntryStars', () => {
    test('keeps the first star value from a match-history string', () => {
        expect(getTournamentEntryStars('4, 4.5, 5')).toBe(4);
        expect(getTournamentEntryStars(5)).toBe(5);
        expect(getTournamentEntryStars('')).toBe(0);
        expect(getTournamentEntryStars(null)).toBe(0);
    });
});
