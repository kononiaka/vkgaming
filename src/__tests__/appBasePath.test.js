/**
 * @jest-environment jsdom
 */

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
        if (originalPublicUrl === undefined) {
            delete process.env.PUBLIC_URL;
        } else {
            process.env.PUBLIC_URL = originalPublicUrl;
        }
        delete process.env.REACT_APP_SITE_URL;
        delete process.env.REACT_APP_TWITCH_REDIRECT_URI;
        if (originalSiteUrl !== undefined) {
            process.env.REACT_APP_SITE_URL = originalSiteUrl;
        }
        if (originalRedirectUri !== undefined) {
            process.env.REACT_APP_TWITCH_REDIRECT_URI = originalRedirectUri;
        }
    });

    test('getAppBasePath is empty for github.io root homepage', () => {
        process.env.PUBLIC_URL = 'https://kononiaka.github.io';
        expect(getAppBasePath()).toBe('');
    });

    test('getAppBasePath reads subpath from legacy github pages homepage', () => {
        process.env.PUBLIC_URL = 'https://kononiaka.github.io/vkgaming';
        expect(getAppBasePath()).toBe('/vkgaming');
    });

    test('getSiteBaseUrl uses runtime github.io origin at root', () => {
        process.env.PUBLIC_URL = 'https://kononiaka.github.io';
        const originalLocation = window.location;
        delete window.location;
        window.location = new URL('https://kononiaka.github.io/');
        expect(getSiteBaseUrl()).toBe('https://kononiaka.github.io');
        window.location = originalLocation;
    });

    test('getSiteBaseUrl ignores baked localhost env on GitHub Pages', () => {
        process.env.REACT_APP_SITE_URL = 'http://localhost:3000';
        process.env.PUBLIC_URL = 'https://kononiaka.github.io';
        const originalLocation = window.location;
        delete window.location;
        window.location = new URL('https://kononiaka.github.io/');
        expect(getSiteBaseUrl()).toBe('https://kononiaka.github.io');
        window.location = originalLocation;
    });

    test('getTwitchRedirectUri uses github.io root callback', () => {
        process.env.PUBLIC_URL = 'https://kononiaka.github.io';
        const originalLocation = window.location;
        delete window.location;
        window.location = new URL('https://kononiaka.github.io/');
        expect(getTwitchRedirectUri()).toBe('https://kononiaka.github.io/auth/twitch/callback');
        window.location = originalLocation;
    });

    test('getTwitchRedirectUri uses current origin on localhost', () => {
        process.env.REACT_APP_TWITCH_REDIRECT_URI = 'http://localhost:3000/auth/twitch/callback';
        process.env.PUBLIC_URL = 'https://kononiaka.github.io';
        const originalLocation = window.location;
        delete window.location;
        window.location = new URL('http://localhost:3000/');
        expect(getTwitchRedirectUri()).toBe('http://localhost:3000/auth/twitch/callback');
        window.location = originalLocation;
    });

    test('getTwitchRedirectUri uses live origin on konoplay.com', () => {
        process.env.REACT_APP_TWITCH_REDIRECT_URI = 'https://kononiaka.github.io/auth/twitch/callback';
        const originalLocation = window.location;
        delete window.location;
        window.location = new URL('https://konoplay.com/');
        expect(getTwitchRedirectUri()).toBe('https://konoplay.com/auth/twitch/callback');
        window.location = originalLocation;
    });

    test('getSiteBaseUrl ignores stale github.io SITE_URL on konoplay.com', () => {
        process.env.REACT_APP_SITE_URL = 'https://kononiaka.github.io';
        const originalLocation = window.location;
        delete window.location;
        window.location = new URL('https://konoplay.com/#/auth');
        expect(getSiteBaseUrl()).toBe('https://konoplay.com');
        window.location = originalLocation;
    });

    test('isTwitchCallbackPath accepts trailing slash from GitHub Pages', () => {
        expect(isTwitchCallbackPath('/auth/twitch/callback/')).toBe(true);
        expect(isTwitchCallbackPath('/auth/twitch/callback')).toBe(true);
        expect(isTwitchCallbackPath('/vkgaming/auth/twitch/callback/')).toBe(true);
    });

    test('isTwitchOAuthReturn detects code in query string', () => {
        expect(isTwitchOAuthReturn('?code=abc&state=xyz')).toBe(true);
        expect(isTwitchOAuthReturn('?error=access_denied')).toBe(true);
        expect(isTwitchOAuthReturn('')).toBe(false);
    });

    test('shouldHandleTwitchOAuth covers path and query callbacks', () => {
        expect(shouldHandleTwitchOAuth('/auth/twitch/callback/', '')).toBe(true);
        expect(shouldHandleTwitchOAuth('/', '?code=abc&state=xyz')).toBe(true);
        expect(shouldHandleTwitchOAuth('/', '')).toBe(false);
    });
});
