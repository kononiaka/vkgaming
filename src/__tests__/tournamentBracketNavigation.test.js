import {
    calculateAvailableCastlesFromBracket,
    getTournamentMatchLink,
    inferScheduleView,
    normalizePlayoffPairs
} from '../utils/tournamentBracketNavigation';

describe('tournamentBracketNavigation', () => {
    test('normalizes object-shaped playoffPairs from Firebase', () => {
        expect(normalizePlayoffPairs({ 0: [{ team1: 'A', team2: 'B' }], 1: [] })).toEqual([
            [{ team1: 'A', team2: 'B' }],
            []
        ]);
    });

    test('infers schedule view for league-style single stage fixtures', () => {
        const playoffPairs = [
            [
                { team1: 'A', team2: 'B', stage: 'LEAGUE' },
                { team1: 'C', team2: 'D', stage: 'LEAGUE' },
                { team1: 'A', team2: 'C', stage: 'LEAGUE' }
            ]
        ];

        expect(
            inferScheduleView({
                type: null,
                playoffPairs,
                maxPlayers: 8
            })
        ).toBe(true);
    });

    test('keeps knockout view for a standard first round', () => {
        const playoffPairs = [
            [
                { team1: 'A', team2: 'B' },
                { team1: 'C', team2: 'D' }
            ],
            [],
            []
        ];

        expect(
            inferScheduleView({
                type: 'kick-off',
                playoffPairs,
                maxPlayers: 4
            })
        ).toBe(false);
    });

    test('switches champions league from schedule to bracket after knockout starts', () => {
        const groupPairs = [{ team1: 'A', team2: 'B', group: 'A', winner: 'A' }];
        const knockoutPairs = [{ team1: 'A', team2: 'C' }];

        expect(
            inferScheduleView({
                type: 'champions-league',
                playoffPairs: [groupPairs],
                maxPlayers: 8,
                championsLeaguePhase: 'group',
                isChampionsLeague: true
            })
        ).toBe(true);

        expect(
            inferScheduleView({
                type: 'champions-league',
                playoffPairs: [groupPairs, knockoutPairs],
                maxPlayers: 8,
                championsLeaguePhase: 'knockout',
                isChampionsLeague: true
            })
        ).toBe(false);
    });

    test('builds focused tournament match links', () => {
        expect(
            getTournamentMatchLink({
                tournamentId: 'cup-1',
                stageIndex: 0,
                pairIndex: 2,
                round: 5
            })
        ).toBe('/tournaments/homm3/cup-1?status=started&stage=0&pair=2&round=5&focus=1');
    });

    test('calculateAvailableCastlesFromBracket ignores test-only bracket games', () => {
        const apiCastles = [{ name: 'Castle-Замок', total: 5, win: 3, lose: 2 }];
        const pairs = [
            [
                {
                    testReport: true,
                    games: [
                        {
                            testOnly: true,
                            castle1: 'Castle-Замок',
                            castle2: 'Rampart-Башня',
                            gameStatus: 'In Progress'
                        }
                    ]
                }
            ]
        ];

        const result = calculateAvailableCastlesFromBracket(apiCastles, pairs);
        expect(result[0].liveGames).toBe(0);
        expect(result[0].total).toBe(5);
    });
});
