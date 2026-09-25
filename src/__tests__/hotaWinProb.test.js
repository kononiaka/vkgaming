import {
    canFetchHotaWinProb,
    formatHotaWinProbPercents,
    hotaWinProbNameCandidates,
    hotaWinProbPairKey
} from '../utils/hotaWinProb';

describe('hotaWinProb', () => {
    test('pair key is order-sensitive and case-insensitive', () => {
        expect(hotaWinProbPairKey('Alice', 'Bob')).toBe('alice|bob');
        expect(hotaWinProbPairKey('Alice', 'Bob')).not.toBe(hotaWinProbPairKey('Bob', 'Alice'));
    });

    test('name candidates strip demo suffix', () => {
        expect(hotaWinProbNameCandidates('Imrael (demo)')).toEqual(['Imrael (demo)', 'Imrael']);
    });

    test('canFetch rejects placeholders', () => {
        expect(canFetchHotaWinProb('Alice', 'Bob')).toBe(true);
        expect(canFetchHotaWinProb('TBD', 'Bob')).toBe(false);
        expect(canFetchHotaWinProb('Alice', 'BYE')).toBe(false);
    });

    test('formatHotaWinProbPercents converts p_a to percents', () => {
        expect(formatHotaWinProbPercents({ p_a: 0.4596, inputs: { with_picks: false } })).toEqual({
            team1: '46.0',
            team2: '54.0',
            withPicks: false
        });
    });

    test('formatHotaWinProbPercents returns null for bad payload', () => {
        expect(formatHotaWinProbPercents(null)).toBeNull();
        expect(formatHotaWinProbPercents({})).toBeNull();
    });
});
