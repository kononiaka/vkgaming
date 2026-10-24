import {
    buildSeasonRecord,
    buildSeasonRows,
    countCupsInSeason,
    groupTournamentsBySeason,
    isValidSeasonId,
    nextAvailableSeasonId,
    normalizeSeasonId,
    parseSeasonList,
    suggestSeasonId,
    suggestSeasonName
} from '../utils/seasonData';

describe('season ids', () => {
    test('normalizes a readable id', () => {
        expect(normalizeSeasonId(' 2026 S1 ')).toBe('2026-s1');
        expect(isValidSeasonId('2026-s1')).toBe(true);
        expect(isValidSeasonId('2026 s1')).toBe(false);
        expect(isValidSeasonId('')).toBe(false);
    });

    test('suggests the current half-year', () => {
        expect(suggestSeasonId(new Date(2026, 2, 1))).toBe('2026-s1');
        expect(suggestSeasonId(new Date(2026, 9, 11))).toBe('2026-s2');
        expect(suggestSeasonName('2026-s2')).toBe('2026 Season 2');
        expect(suggestSeasonName('spring-open')).toBe('');
        expect(nextAvailableSeasonId(['2026-s2'], new Date(2026, 9, 11))).toBe('2026-s3');
    });
});

describe('season records', () => {
    test('builds an active season and parses the database map', () => {
        const record = buildSeasonRecord({
            name: ' 2026 Season 1 ',
            createdBy: 'Kono',
            createdByUid: 'uid-1',
            now: '2026-10-11T00:00:00.000Z'
        });

        expect(record).toEqual({
            name: '2026 Season 1',
            status: 'active',
            createdAt: '2026-10-11T00:00:00.000Z',
            createdBy: 'Kono',
            createdByUid: 'uid-1'
        });

        expect(
            parseSeasonList({
                '2026-s1': record,
                '2025-s2': { ...record, name: '2025 Season 2', createdAt: '2025-07-01T00:00:00.000Z' }
            }).map((season) => season.id)
        ).toEqual(['2026-s1', '2025-s2']);
    });
});

describe('grouping cups under a season', () => {
    const seasons = [
        { id: '2026-s1', name: '2026 Season 1' },
        { id: '2026-s2', name: '2026 Season 2' }
    ];
    const cups = [
        { id: 'a', name: 'Open', seasonId: '2026-s1' },
        { id: 'b', name: 'Swiss', seasonId: '2026-s1' },
        { id: 'c', name: 'Loose' },
        { id: 'd', name: 'Missing season', seasonId: 'gone' }
    ];

    test('groups assigned cups and leaves the rest unassigned', () => {
        const grouped = groupTournamentsBySeason(cups, seasons);
        expect(grouped.groups.map((group) => group.season.id)).toEqual(['2026-s1']);
        expect(grouped.groups[0].tournaments.map((cup) => cup.id)).toEqual(['a', 'b']);
        expect(grouped.unassigned.map((cup) => cup.id)).toEqual(['c', 'd']);
        expect(countCupsInSeason(cups, '2026-s1')).toBe(2);
    });

    test('builds headings for the full list and a flat list for one season', () => {
        const rows = buildSeasonRows(cups, seasons, '');
        expect(rows.map((row) => (row.kind === 'heading' ? row.season.name : row.tournament.id))).toEqual([
            '2026 Season 1',
            'a',
            'b',
            'Cups outside a season',
            'c',
            'd'
        ]);

        expect(buildSeasonRows(cups, seasons, '2026-s1').map((row) => row.tournament.id)).toEqual(['a', 'b']);
    });
});
