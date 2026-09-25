import {
    getTournamentEntryStars,
    freezeTournamentRosterStars,
    recalculateSitePlayerStars
} from '../utils/playerStars';

describe('getTournamentEntryStars', () => {
    test('keeps the first star value from a match-history string', () => {
        expect(getTournamentEntryStars('4, 4.5, 5')).toBe(4);
        expect(getTournamentEntryStars(5)).toBe(5);
        expect(getTournamentEntryStars('')).toBe(0);
        expect(getTournamentEntryStars(null)).toBe(0);
    });
});

describe('freezeTournamentRosterStars', () => {
    test('stamps a single frozen stars value onto each roster player', async () => {
        const patches = [];
        const authFetch = jest.fn(async (url, options = {}) => {
            if (options.method === 'PATCH') {
                patches.push({ url, body: JSON.parse(options.body) });
                return { ok: true, json: async () => null };
            }
            return { ok: true, json: async () => ({}) };
        });

        const playersObj = {
            a: { name: 'Alice', stars: '3, 4' },
            b: { name: 'Bob', stars: 2 }
        };

        const frozen = await freezeTournamentRosterStars('tour-1', playersObj, {
            starsByName: { Alice: 4.5, Bob: 3 },
            authFetch,
            firebaseUrl: 'https://example.test'
        });

        expect(frozen.a.stars).toBe(4.5);
        expect(frozen.b.stars).toBe(3);
        expect(patches).toHaveLength(2);
        expect(patches).toEqual(
            expect.arrayContaining([
                {
                    url: 'https://example.test/tournaments/heroes3/tour-1/players/a.json',
                    body: { stars: 4.5 }
                },
                {
                    url: 'https://example.test/tournaments/heroes3/tour-1/players/b.json',
                    body: { stars: 3 }
                }
            ])
        );
    });
});

describe('recalculateSitePlayerStars', () => {
    test('updates users and returns starsByName for attendees', async () => {
        const users = {
            u1: { enteredNickname: 'Alice', ratings: '1500', stars: 1 },
            u2: { enteredNickname: 'Bob', ratings: '1000', stars: 1 },
            u3: { enteredNickname: 'Carol', ratings: '1200', stars: 1 }
        };
        const patches = [];

        const authFetch = jest.fn(async (url, options = {}) => {
            if (url.endsWith('/users.json') && !options.method) {
                return { ok: true, json: async () => users };
            }
            if (options.method === 'PATCH') {
                patches.push({ url, body: JSON.parse(options.body) });
                return { ok: true, json: async () => null };
            }
            return { ok: true, json: async () => ({}) };
        });

        const result = await recalculateSitePlayerStars({
            attendeeNames: ['Alice', 'Bob'],
            authFetch,
            firebaseUrl: 'https://example.test'
        });

        expect(result.updatedCount).toBe(2);
        expect(result.starsByName.Alice).toBeGreaterThan(result.starsByName.Bob);
        expect(patches).toHaveLength(2);
        expect(patches.every((p) => p.body.stars != null)).toBe(true);
    });
});
