import { getMatchCenterLink, hasWatchableStreams, parseMatchCenterParams } from '../utils/matchCenterRoute';

describe('matchCenterRoute', () => {
    test('builds match center path from bracket match', () => {
        expect(
            getMatchCenterLink({
                tournamentId: 'cup-1',
                stageIndex: 0,
                pairIndex: 2
            })
        ).toBe('/live/match/cup-1/0/2');
    });

    test('detects watchable streams from player twitch logins', () => {
        expect(hasWatchableStreams({ team1TwitchLogin: 'alice_streams' })).toBe(true);
        expect(hasWatchableStreams({})).toBe(false);
    });

    test('parses route params', () => {
        expect(parseMatchCenterParams('cup-1', '3', '7')).toEqual({
            tournamentId: 'cup-1',
            stageIndex: 3,
            pairIndex: 7
        });
    });
});
