import {
    buildHotaLast5Games,
    buildNicknameCandidates,
    findHotaOpponentRow,
    getHeadToHeadSourceLabel,
    HEAD_TO_HEAD_SOURCES,
    resolveHotaHeadToHeadFromProfiles
} from '../utils/headToHeadStats';

describe('headToHeadStats', () => {
    test('buildNicknameCandidates strips demo suffix', () => {
        expect(buildNicknameCandidates('Imrael (demo)')).toEqual(['Imrael (demo)', 'Imrael']);
    });

    test('findHotaOpponentRow matches case-insensitively', () => {
        const profile = {
            opponents: [{ opp_name: 'Chester', games: 4, wins: 2 }]
        };

        expect(findHotaOpponentRow(profile, 'chester')).toEqual({
            opp_name: 'Chester',
            games: 4,
            wins: 2
        });
    });

    test('resolveHotaHeadToHeadFromProfiles uses player A opponent row first', () => {
        const summary = resolveHotaHeadToHeadFromProfiles(
            'Imrael',
            'Chester',
            { opponents: [{ opp_name: 'Chester', games: 5, wins: 3 }] },
            { opponents: [{ opp_name: 'Imrael', games: 5, wins: 2 }] }
        );

        expect(summary).toEqual({
            total: 5,
            wins: 3,
            losses: 2,
            winPercent: '60.0'
        });
    });

    test('resolveHotaHeadToHeadFromProfiles falls back to player B opponent row', () => {
        const summary = resolveHotaHeadToHeadFromProfiles(
            'Imrael',
            'Chester',
            { opponents: [] },
            { opponents: [{ opp_name: 'Imrael', games: 4, wins: 1 }] }
        );

        expect(summary).toEqual({
            total: 4,
            wins: 3,
            losses: 1,
            winPercent: '75.0'
        });
    });

    test('buildHotaLast5Games maps recent matches from player perspective', () => {
        const last5 = buildHotaLast5Games(
            [
                {
                    side: 'p1',
                    p1_name: 'Imrael',
                    p2_name: 'Chester',
                    result: 'win',
                    start_time_iso: '2026-01-02T10:00:00Z'
                },
                {
                    side: 'p1',
                    p1_name: 'Imrael',
                    p2_name: 'Chester',
                    result: 'loss',
                    start_time_iso: '2026-01-01T10:00:00Z'
                }
            ],
            'Imrael',
            'Chester'
        );

        expect(last5).toHaveLength(2);
        expect(last5[0].winner).toBe('Imrael');
        expect(last5[1].winner).toBe('Chester');
    });

    test('getHeadToHeadSourceLabel returns readable labels', () => {
        expect(getHeadToHeadSourceLabel(HEAD_TO_HEAD_SOURCES.HOTA)).toBe('HotA Meta');
        expect(getHeadToHeadSourceLabel(HEAD_TO_HEAD_SOURCES.KONOPLAY)).toBe('Konoplay');
    });
});
