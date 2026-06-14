import {
    getAppBasePath,
    getSiteBaseUrl,
    getTwitchRedirectUri,
    isTwitchCallbackPath,
    isTwitchOAuthReturn,
    shouldHandleTwitchOAuth
} from '../utils/appBasePath';

describe('appBasePath', () => {
    const originalPublicUrl = process.env.PUBLIC_URL;
    const originalSiteUrl = process.env.REACT_APP_SITE_URL;
    const originalRedirectUri = process.env.REACT_APP_TWITCH_REDIRECT_URI;

    afterEach(() => {
        process.env.PUBLIC_URL = originalPublicUrl;
        process.env.REACT_APP_SITE_URL = originalSiteUrl;
        process.env.REACT_APP_TWITCH_REDIRECT_URI = originalRedirectUri;
        delete process.env.REACT_APP_SITE_URL;
        delete process.env.REACT_APP_TWITCH_REDIRECT_URI;
    });

    test('getAppBasePath reads path from homepage URL', () => {
        process.env.PUBLIC_URL = 'https://kononiaka.github.io/vkgaming';
        expect(getAppBasePath()).toBe('/vkgaming');
    });

    test('getSiteBaseUrl prefers configured REACT_APP_SITE_URL', () => {
        process.env.REACT_APP_SITE_URL = 'https://kononiaka.github.io/vkgaming';
        expect(getSiteBaseUrl()).toBe('https://kononiaka.github.io/vkgaming');
    });

    test('getTwitchRedirectUri uses configured production callback', () => {
        process.env.REACT_APP_TWITCH_REDIRECT_URI =
            'https://kononiaka.github.io/vkgaming/auth/twitch/callback';
        expect(getTwitchRedirectUri()).toBe(
            'https://kononiaka.github.io/vkgaming/auth/twitch/callback'
        );
    });

    test('getTwitchRedirectUri defaults to path callback on GitHub Pages', () => {
        process.env.REACT_APP_SITE_URL = 'https://kononiaka.github.io/vkgaming';
        expect(getTwitchRedirectUri()).toBe('https://kononiaka.github.io/vkgaming/auth/twitch/callback');
    });

    test('isTwitchCallbackPath accepts trailing slash from GitHub Pages', () => {
        expect(isTwitchCallbackPath('/vkgaming/auth/twitch/callback/')).toBe(true);
        expect(isTwitchCallbackPath('/vkgaming/auth/twitch/callback')).toBe(true);
    });

    test('isTwitchOAuthReturn detects code in query string', () => {
        expect(isTwitchOAuthReturn('?code=abc&state=xyz')).toBe(true);
        expect(isTwitchOAuthReturn('?error=access_denied')).toBe(true);
        expect(isTwitchOAuthReturn('')).toBe(false);
    });

    test('shouldHandleTwitchOAuth covers path and query callbacks', () => {
        expect(shouldHandleTwitchOAuth('/vkgaming/auth/twitch/callback/', '')).toBe(true);
        expect(shouldHandleTwitchOAuth('/vkgaming/', '?code=abc&state=xyz')).toBe(true);
        expect(shouldHandleTwitchOAuth('/vkgaming/', '')).toBe(false);
    });
});
