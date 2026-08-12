import { META_MIN_SAMPLE, aggregateCastleStats, mergeWithHotaFactions } from '../utils/tournamentMetaStats';
import {
    BAN_INSIGHT_MIN_COUNT,
    BAN_INSIGHT_MIN_RATE,
    buildTournamentHeadToHeadFromMatches
} from '../utils/tournamentHeadToHead';

describe('tournamentMetaStats sample gate', () => {
    test('marks castles reliable only at META_MIN_SAMPLE maps', () => {
        expect(META_MIN_SAMPLE).toBe(5);

        const games = [];
        for (let i = 0; i < 4; i++) {
            games.push({
                castle1: 'Castle',
                castle2: 'Rampart',
                gameWinner: i % 2 === 0 ? 'A' : 'B',
                team1: 'A',
                team2: 'B'
            });
        }

        const low = mergeWithHotaFactions(aggregateCastleStats(games), []);
        const castleRow = low.find((row) => row.name === 'Castle');
        expect(castleRow.total).toBe(4);
        expect(castleRow.sampleReliable).toBe(false);
        expect(castleRow.displayWinRate).toBeNull();
        expect(castleRow.delta).toBeNull();

        games.push({
            castle1: 'Castle',
            castle2: 'Rampart',
            gameWinner: 'A',
            team1: 'A',
            team2: 'B'
        });
        const enough = mergeWithHotaFactions(aggregateCastleStats(games), [
            { faction_name: 'Castle', winrate: 50 }
        ]);
        const reliable = enough.find((row) => row.name === 'Castle');
        expect(reliable.sampleReliable).toBe(true);
        expect(reliable.displayWinRate).not.toBeNull();
        expect(reliable.delta).not.toBeNull();
    });
});

describe('tournamentHeadToHead ban confidence', () => {
    const makeMatch = (bans1, bans2) => ({
        tournamentId: 'cup1',
        tournamentName: 'Cup',
        opponent1: 'Alice',
        opponent2: 'Bob',
        winner: 'Alice',
        score: '1:0',
        date: '2026-08-01',
        games: [
            {
                gameId: 0,
                castle1: 'Castle',
                castle2: 'Rampart',
                gameWinner: 'Alice',
                bannedCastles1: bans1,
                bannedCastles2: bans2
            }
        ]
    });

    test('omits ban insight below min count or rate', () => {
        expect(BAN_INSIGHT_MIN_COUNT).toBe(3);
        expect(BAN_INSIGHT_MIN_RATE).toBe(0.5);

        const weak = buildTournamentHeadToHeadFromMatches(
            [makeMatch(['Inferno'], []), makeMatch(['Inferno'], [])],
            'Alice',
            'Bob',
            { year: 2026 }
        );
        expect(weak.banInsightA).toBeNull();
    });

    test('shows often-bans insight when thresholds met', () => {
        const matches = [
            makeMatch(['Inferno'], []),
            makeMatch(['Inferno'], []),
            makeMatch(['Inferno'], []),
            makeMatch(['Dungeon'], [])
        ];
        // Inferno banned 3/4 maps = 75% >= 50%, count >= 3
        const strong = buildTournamentHeadToHeadFromMatches(matches, 'Alice', 'Bob', { year: 2026 });
        expect(strong.banInsightA).toContain('often bans Inferno');
        expect(strong.banInsightA).toContain('3×');
    });
});
