import { collectMyUpcomingMatches } from '../utils/myUpcomingMatches';

describe('myUpcomingMatches', () => {
    test('collects active bracket fixtures for a player with stars and flags context', () => {
        const tournamentsData = {
            cup1: {
                name: 'Test Cup',
                status: 'Started!',
                isPublic: true,
                bracket: {
                    playoffPairs: [
                        [
                            {
                                team1: 'Alice',
                                team2: 'Bob',
                                stage: 'Semi-final',
                                type: 'bo-1',
                                score1: 0,
                                score2: 0,
                                scheduledAt: '2030-06-04T16:00:00.000Z',
                                stars1: 4,
                                stars2: 2
                            }
                        ]
                    ]
                },
                players: {
                    p1: { name: 'Alice', countryCode: 'PL' },
                    p2: { name: 'Bob', countryCode: 'RU' }
                }
            }
        };

        const matches = collectMyUpcomingMatches(tournamentsData, 'Alice', {
            avatarByNickname: { Alice: 'alice.png', Bob: 'bob.png' },
            countryLookup: { alice: 'PL', bob: 'RU' },
            rankByNickname: { Alice: 3, Bob: 8 }
        });

        expect(matches).toHaveLength(1);
        expect(matches[0]).toMatchObject({
            tournamentName: 'Test Cup',
            team1: 'Alice',
            team2: 'Bob',
            team1Stars: 4,
            team2Stars: 2,
            team1Avatar: 'alice.png',
            team2Avatar: 'bob.png',
            variant: 'upcoming'
        });
    });

    test('skips finished series', () => {
        const tournamentsData = {
            cup1: {
                name: 'Test Cup',
                status: 'Started!',
                isPublic: true,
                bracket: {
                    playoffPairs: [[{ team1: 'Alice', team2: 'Bob', score1: 1, score2: 0, winner: 'Alice' }]]
                },
                players: {}
            }
        };

        expect(collectMyUpcomingMatches(tournamentsData, 'Alice')).toEqual([]);
    });

    test('skips unscheduled fixtures that are not live', () => {
        const tournamentsData = {
            cup1: {
                name: 'Test Cup',
                status: 'Started!',
                isPublic: true,
                bracket: {
                    playoffPairs: [
                        [
                            {
                                team1: 'Alice',
                                team2: 'Bob',
                                stage: 'Semi-final',
                                type: 'bo-1',
                                score1: 0,
                                score2: 0
                            }
                        ]
                    ]
                },
                players: {
                    p1: { name: 'Alice' },
                    p2: { name: 'Bob' }
                }
            }
        };

        expect(collectMyUpcomingMatches(tournamentsData, 'Alice')).toEqual([]);
    });
});
