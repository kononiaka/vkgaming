import {
    fetchMatchCenterMatches,
    hasScheduledAt,
    isGameSessionActive,
    isPairLive,
    isScheduledTimeReached
} from '../utils/matchCenterData';

describe('matchCenterData live detection', () => {
    const now = new Date('2026-06-13T12:00:00.000Z').getTime();

    test('isScheduledTimeReached when scheduledAt is in the past', () => {
        const pair = { scheduledAt: '2026-06-13T11:00:00.000Z' };
        expect(isScheduledTimeReached(pair, now)).toBe(true);
    });

    test('isScheduledTimeReached when scheduledAt equals now', () => {
        const pair = { scheduledAt: '2026-06-13T12:00:00.000Z' };
        expect(isScheduledTimeReached(pair, now)).toBe(true);
    });

    test('isScheduledTimeReached is false for future schedule', () => {
        const pair = { scheduledAt: '2026-06-13T13:00:00.000Z' };
        expect(isScheduledTimeReached(pair, now)).toBe(false);
    });

    test('isScheduledTimeReached ignores tournament date without scheduledAt', () => {
        const pair = { tournamentDate: '2020-01-01T12:00:00.000Z' };
        expect(isScheduledTimeReached(pair, now)).toBe(false);
    });

    test('isGameSessionActive during restarts before castles are picked', () => {
        expect(
            isGameSessionActive({
                castle1: '',
                castle2: '',
                restartsFinished: false,
                restart1_111: 1
            })
        ).toBe(true);
    });

    test('isGameSessionActive when map castles are selected', () => {
        expect(
            isGameSessionActive({
                castle1: 'Castle',
                castle2: 'Rampart',
                castleWinner: ''
            })
        ).toBe(true);
    });

    test('isPairLive combines schedule time and active session', () => {
        expect(isPairLive({ scheduledAt: '2026-06-13T11:00:00.000Z', games: [] }, now)).toBe(true);
        expect(isPairLive({ scheduledAt: '2026-06-13T14:00:00.000Z', games: [] }, now)).toBe(false);
        expect(
            isPairLive(
                {
                    scheduledAt: '2026-06-13T14:00:00.000Z',
                    games: [{ castle1: '', castle2: '', gameStatus: 'In Progress' }]
                },
                now
            )
        ).toBe(true);
    });

    test('fetchMatchCenterMatches excludes unscheduled fixtures from upcoming', async () => {
        const tournaments = {
            cup1: {
                name: 'Unscheduled Cup',
                status: 'Started!',
                isPublic: true,
                players: {
                    p1: { name: 'Alice' },
                    p2: { name: 'Bob' }
                },
                bracket: {
                    playoffPairs: [
                        [
                            {
                                team1: 'Alice',
                                team2: 'Bob',
                                type: 'bo-1',
                                score1: 0,
                                score2: 0
                            }
                        ]
                    ]
                }
            }
        };

        global.fetch = jest.fn((url) => {
            if (String(url).includes('/tournaments/heroes3.json')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve(tournaments) });
            }
            if (String(url).includes('/users.json')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
            }
            return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
        });

        const { liveGames, upcomingMatches } = await fetchMatchCenterMatches();

        expect(liveGames).toHaveLength(0);
        expect(upcomingMatches).toHaveLength(0);
        expect(hasScheduledAt({ scheduledAt: '2030-01-01T12:00:00.000Z' })).toBe(true);
        expect(hasScheduledAt({})).toBe(false);
    });
});
