import {
    buildTournamentFormatPreview,
    getKnockoutRoundColumns
} from '../utils/tournamentFormatPreview';
import { CHAMPIONS_LEAGUE_TWO_GROUP_TYPE } from '../components/tournaments/homm3/championsLeagueUtils';

describe('tournamentFormatPreview', () => {
    test('builds kick-off knockout columns for 16 players', () => {
        const preview = buildTournamentFormatPreview({ type: 'kick-off', maxPlayers: 16 });
        expect(preview.mode).toBe('knockout');
        expect(preview.columns.map((column) => column.matchCount)).toEqual([8, 4, 2, 1]);
        expect(preview.columns.map((column) => column.label)).toEqual(['R8', 'QF', 'SF', 'F']);
    });

    test('builds two-group champions league flow for 32 players', () => {
        const preview = buildTournamentFormatPreview({
            type: CHAMPIONS_LEAGUE_TWO_GROUP_TYPE,
            maxPlayers: 32
        });
        expect(preview.mode).toBe('flow');
        expect(preview.phases).toHaveLength(3);
        expect(preview.phases[0].label).toBe('8×4');
        expect(preview.phases[1].label).toBe('4×4');
        expect(preview.columns.map((column) => column.label)).toEqual(['QF', 'SF', 'F']);
    });

    test('returns empty preview when max players missing', () => {
        const preview = buildTournamentFormatPreview({ type: 'kick-off', maxPlayers: null });
        expect(preview.mode).toBe('empty');
    });

    test('getKnockoutRoundColumns handles small brackets', () => {
        expect(getKnockoutRoundColumns(4).map((column) => column.matchCount)).toEqual([2, 1]);
    });
});
