import { extractTwitchLogin, getTwitchWatchUrl, pickMatchStreamLogin } from '../utils/twitchUtils';

describe('twitchUtils', () => {
    test('extracts login from twitch URL', () => {
        expect(extractTwitchLogin('https://www.twitch.tv/MyStreamer')).toBe('mystreamer');
    });

    test('builds watch URL', () => {
        expect(getTwitchWatchUrl('streamer_name')).toBe('https://www.twitch.tv/streamer_name');
    });

    test('prefers live login for featured stream', () => {
        const match = {
            team1TwitchLogin: 'alpha',
            team2TwitchLogin: 'beta'
        };
        expect(pickMatchStreamLogin(match, new Set(['beta']))).toBe('beta');
    });

    test('prefers active commentator stream when listed', () => {
        const match = {
            commentatorStreamLogin: 'caster',
            team1TwitchLogin: 'alpha',
            team2TwitchLogin: 'beta'
        };
        expect(pickMatchStreamLogin(match, new Set())).toBe('caster');
    });
});
