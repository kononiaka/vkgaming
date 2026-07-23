/**
 * @jest-environment node
 */

import { resolveAuthProvider } from '../utils/authProvider';

describe('resolveAuthProvider', () => {
    test('uses authProvider when set', () => {
        expect(resolveAuthProvider({ authProvider: 'twitch' })).toBe('twitch');
        expect(resolveAuthProvider({ authProvider: 'youtube' })).toBe('youtube');
    });

    test('falls back to provider ids', () => {
        expect(resolveAuthProvider({ twitchId: '123' })).toBe('twitch');
        expect(resolveAuthProvider({ youtubeId: 'UC123' })).toBe('youtube');
    });

    test('returns null when unknown', () => {
        expect(resolveAuthProvider(null)).toBe(null);
        expect(resolveAuthProvider({})).toBe(null);
    });
});
