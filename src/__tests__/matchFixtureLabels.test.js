import {
    buildLeagueRoundMap,
    buildMatchBannerLabel,
    buildMatchScheduleBadge,
    buildMatchStageLabel,
    formatTournamentTypeLabel,
    resolveLeagueRound
} from '../utils/matchFixtureLabels';

describe('matchFixtureLabels', () => {
    test('formatTournamentTypeLabel maps cup formats', () => {
        expect(formatTournamentTypeLabel('league')).toBe('League');
        expect(formatTournamentTypeLabel('kick-off')).toBe('Kick-off');
        expect(formatTournamentTypeLabel('swiss')).toBe('Swiss');
        expect(formatTournamentTypeLabel('champions-league')).toBe('Champions League');
    });

    test('league uses leg number when round is set', () => {
        expect(buildMatchStageLabel({ type: 'league' }, { round: 3, stage: 'League' }, 0)).toBe('Leg 3');
        expect(buildMatchScheduleBadge({ type: 'league' }, { round: 3 }, 0)).toBe('LEG 3');
    });

    test('league derives leg from round-robin when round is missing', () => {
        const tournament = {
            type: 'league',
            bracket: {
                playoffPairs: [
                    [
                        { team1: 'A', team2: 'D' },
                        { team1: 'B', team2: 'C' },
                        { team1: 'A', team2: 'C' },
                        { team1: 'D', team2: 'B' },
                        { team1: 'A', team2: 'B' },
                        { team1: 'C', team2: 'D' }
                    ]
                ]
            }
        };
        const pair = { team1: 'A', team2: 'D', stage: 'League' };
        const round = resolveLeagueRound(tournament, pair);

        expect(round).not.toBeNull();
        expect(buildMatchStageLabel(tournament, pair, 0)).toBe(`Leg ${round}`);
    });

    test('buildLeagueRoundMap mirrors bracket leg assignment', () => {
        const map = buildLeagueRoundMap(['A', 'B', 'C', 'D']);
        expect(map['A|D']).toBe(1);
        expect(map['D|A']).toBe(1);
    });

    test('buildMatchBannerLabel shows type and leg without duplicating league', () => {
        expect(
            buildMatchBannerLabel({
                tournamentName: 'KONOCUP-V',
                tournamentType: 'league',
                stageLabel: 'Leg 13'
            })
        ).toBe('KONOCUP-V · League · Leg 13');

        expect(
            buildMatchBannerLabel({
                tournamentName: 'KONOCUP-V',
                tournamentType: 'league',
                stageLabel: 'League'
            })
        ).toBe('KONOCUP-V · League');
    });

    test('champions league group stage uses group label', () => {
        expect(buildMatchStageLabel({ type: 'champions-league' }, { group: 'B', stage: 'Group stage' }, 0)).toBe(
            'Group B'
        );
    });

    test('kick-off uses bracket stage name', () => {
        expect(buildMatchStageLabel({ type: 'kick-off' }, { stage: 'Semi-final' }, 2)).toBe('Semi-final');
    });
});
