/**
 * Production readiness checks — wiring, env template, and config shape.
 * Run live endpoint checks with: npm run verify:live
 */

import fs from 'fs';
import path from 'path';
import { FIREBASE_DATABASE_URL, FIREBASE_FUNCTIONS_BASE, FIREBASE_PROJECT_ID } from '../config/firebase';
import { getTwitchEmbedUrl, getTwitchWatchUrl } from '../utils/twitchUtils';

const readRepoFile = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const REQUIRED_ENV_KEYS = [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_DATABASE_URL',
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_TWITCH_CLIENT_ID'
];

describe('production readiness — codebase wiring', () => {
    test('Live Arena route and nav are registered', () => {
        const appSource = readRepoFile('src/App.js');
        const headerSource = readRepoFile('src/Layout/MainHeader.js');

        expect(appSource).toMatch(/path="\/live"/);
        expect(appSource).toMatch(/LiveArenaPage/);
        expect(headerSource).toMatch(/Live Arena/);
        expect(headerSource).toMatch(/to="\/live"/);
    });

    test('twitchStreamStatus function is exported', () => {
        const functionsSource = readRepoFile('functions/index.js');
        expect(functionsSource).toMatch(/exports\.twitchStreamStatus/);
        expect(functionsSource).toMatch(/client_credentials/);
    });

    test('youtubeAuth function is exported', () => {
        const functionsSource = readRepoFile('functions/index.js');
        expect(functionsSource).toMatch(/exports\.youtubeAuth/);
        expect(functionsSource).toMatch(/youtube:\$\{youtubeId\}/);
        expect(functionsSource).toMatch(/authProvider:\s*'youtube'/);
    });

    test('YouTube OAuth client id is documented in env example', () => {
        const envExample = readRepoFile('.env.example');
        expect(envExample).toMatch(/REACT_APP_YOUTUBE_OAUTH_CLIENT_ID/);
        expect(envExample).toMatch(/REACT_APP_YOUTUBE_REDIRECT_URI/);
        expect(envExample).toMatch(/auth\/youtube\/callback/);
    });

    test('telegram match center links to Live Arena', () => {
        const telegramSource = readRepoFile('functions/telegram.js');
        expect(telegramSource).toMatch(/\/live/);
        expect(telegramSource).not.toMatch(/matchCenterLink\(siteUrl\)[\s\S]*return `\$\{siteUrl[^`]*\}\/`;/);
    });

    test('frontend calls twitchStreamStatus Cloud Function', () => {
        const apiSource = readRepoFile('src/api/twitchStreams.js');
        expect(apiSource).toMatch(/twitchStreamStatus/);
        expect(apiSource).toMatch(/liveLogins/);
    });

    test('Live Arena page and data utilities exist', () => {
        expect(fs.existsSync(path.join(process.cwd(), 'src/components/LiveArena/LiveArenaPage.js'))).toBe(true);
        expect(fs.existsSync(path.join(process.cwd(), 'src/utils/matchCenterData.js'))).toBe(true);
        expect(fs.existsSync(path.join(process.cwd(), 'src/utils/twitchUtils.js'))).toBe(true);
    });

    test('tournament format utilities are present', () => {
        expect(fs.existsSync(path.join(process.cwd(), 'src/components/tournaments/homm3/swissUtils.js'))).toBe(true);
        expect(
            fs.existsSync(path.join(process.cwd(), 'src/components/tournaments/homm3/championsLeagueUtils.js'))
        ).toBe(true);
        expect(fs.existsSync(path.join(process.cwd(), 'src/components/tournaments/homm3/loserBracketUtils.js'))).toBe(
            true
        );
    });

    test('.env.example documents required production variables', () => {
        const envExample = readRepoFile('.env.example');
        REQUIRED_ENV_KEYS.forEach((key) => {
            expect(envExample).toContain(key);
        });
        expect(envExample).toContain('REACT_APP_FIREBASE_FUNCTIONS_BASE');
        expect(envExample).toContain('telegram.bot_token');
    });

    test('database rules file exists for RTDB deploy', () => {
        expect(fs.existsSync(path.join(process.cwd(), 'database.rules.json'))).toBe(true);
    });
});

describe('production readiness — runtime config shape', () => {
    test('Firebase URLs use a real project id and match functions base', () => {
        expect(FIREBASE_PROJECT_ID).toBeTruthy();
        expect(FIREBASE_PROJECT_ID).not.toBe('your-project-id');
        expect(FIREBASE_DATABASE_URL).toMatch(/^https:\/\/.+\.firebaseio\.com$/);
        expect(FIREBASE_FUNCTIONS_BASE).toContain(FIREBASE_PROJECT_ID);
        expect(FIREBASE_FUNCTIONS_BASE).toMatch(/cloudfunctions\.net$/);
    });

    test('Twitch embed and watch URLs are well-formed', () => {
        const watch = getTwitchWatchUrl('konoplay_test');
        const embed = getTwitchEmbedUrl('konoplay_test');

        expect(watch).toBe('https://www.twitch.tv/konoplay_test');
        expect(embed).toContain('https://player.twitch.tv/');
        expect(embed).toContain('channel=konoplay_test');
        expect(embed).toContain('parent=');
    });

    test('production env vars are set when VERIFY_PRODUCTION_ENV=1', () => {
        if (process.env.VERIFY_PRODUCTION_ENV !== '1') {
            return;
        }

        REQUIRED_ENV_KEYS.forEach((key) => {
            const value = process.env[key];
            expect(value).toBeTruthy();
            expect(String(value).trim()).not.toBe('');
            expect(String(value)).not.toContain('your-project');
        });

        const functionsBase = process.env.REACT_APP_FIREBASE_FUNCTIONS_BASE;
        if (functionsBase) {
            expect(functionsBase).toContain(process.env.REACT_APP_FIREBASE_PROJECT_ID);
        }
    });
});
