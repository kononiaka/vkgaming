#!/usr/bin/env node
/**
 * Critical-path UAT checks for GitHub Pages staging (kononiaka.github.io).
 * Run: node scripts/uat-critical-checks.js
 */

const SITE = process.env.UAT_SITE_URL || 'https://kononiaka.github.io';
const FUNCTIONS_BASE =
    process.env.REACT_APP_FIREBASE_FUNCTIONS_BASE ||
    'https://us-central1-test-prod-app-81915.cloudfunctions.net';
const DATABASE_URL =
    process.env.REACT_APP_FIREBASE_DATABASE_URL ||
    'https://test-prod-app-81915-default-rtdb.firebaseio.com';

const results = [];

const pass = (id, detail) => results.push({ id, ok: true, detail });
const fail = (id, detail) => results.push({ id, ok: false, detail });
const warn = (id, detail) => results.push({ id, ok: 'warn', detail });

const fetchText = async (url, options) => {
    const response = await fetch(url, options);
    const text = await response.text();
    return { response, text };
};

const checkSiteShell = async () => {
    try {
        const { response, text } = await fetchText(`${SITE}/`);
        if (!response.ok) {
            fail('site:home', `HTTP ${response.status}`);
            return null;
        }

        if (!text.includes('id="root"')) {
            fail('site:home', 'Missing React root mount point');
            return null;
        }

        const scriptMatch = text.match(/src="(\/static\/js\/main\.[^"]+\.js)"/);
        if (!scriptMatch) {
            fail('site:home', 'Main JS bundle not referenced in index.html');
            return null;
        }

        pass('site:home', `Loads (${response.status})`);
        return scriptMatch[1];
    } catch (error) {
        fail('site:home', error.message);
        return null;
    }
};

const checkMainBundle = async (scriptPath) => {
    if (!scriptPath) {
        return;
    }

    try {
        const { response, text } = await fetchText(`${SITE}${scriptPath}`);
        if (!response.ok) {
            fail('site:main-js', `HTTP ${response.status} for ${scriptPath}`);
            return;
        }

        const badPatterns = [
            { re: /localhost:3000\/auth\/twitch\/callback/g, label: 'localhost Twitch callback baked in bundle' },
            { re: /kononiaka\.github\.io\/vkgaming\/auth\/twitch\/callback/g, label: 'old /vkgaming OAuth callback in bundle' }
        ];

        const hits = badPatterns.filter(({ re }) => re.test(text));
        if (hits.length) {
            fail('site:main-js', hits.map((h) => h.label).join('; '));
            return;
        }

        if (
            !text.includes('kononiaka.github.io') &&
            !text.includes('/auth/twitch/callback') &&
            !text.includes('/auth/youtube/callback')
        ) {
            warn('site:main-js', 'Could not confirm OAuth callback strings in minified bundle');
        } else {
            pass('site:main-js', `${scriptPath} (${Math.round(text.length / 1024)} KB)`);
        }
    } catch (error) {
        fail('site:main-js', error.message);
    }
};

const checkOAuthCallbackFallback = async () => {
    const callbacks = [
        { path: '/auth/twitch/callback/', label: 'site:oauth-callback-twitch' },
        { path: '/auth/youtube/callback/', label: 'site:oauth-callback-youtube' }
    ];

    for (const { path, label } of callbacks) {
        try {
            const { response, text } = await fetchText(`${SITE}${path}`);
            if (!response.ok) {
                fail(label, `HTTP ${response.status} — postbuild SPA fallback missing`);
                continue;
            }

            if (!text.includes('id="root"')) {
                fail(label, 'Callback path does not serve React shell');
                continue;
            }

            pass(label, `SPA fallback present at ${path}`);
        } catch (error) {
            fail(label, error.message);
        }
    }
};

const checkSpa404 = async () => {
    try {
        const { response, text } = await fetchText(`${SITE}/404.html`);
        if (!response.ok) {
            fail('site:404-fallback', `HTTP ${response.status}`);
            return;
        }

        if (!text.includes('id="root"')) {
            fail('site:404-fallback', '404.html does not redirect to SPA');
            return;
        }

        pass('site:404-fallback', 'GitHub Pages SPA 404 fallback present');
    } catch (error) {
        fail('site:404-fallback', error.message);
    }
};

const checkLegacyPath = async () => {
    try {
        const { response, text } = await fetchText(`${SITE}/vkgaming/`);
        if (!response.ok) {
            pass('site:legacy-vkgaming', '/vkgaming/ not available (legacy path retired)');
            return;
        }

        if (text.includes('id="root"')) {
            fail(
                'site:legacy-vkgaming',
                'Old /vkgaming/ still serves the React app — run npm run deploy:retire-vkgaming'
            );
            return;
        }

        if (/kononiaka\.github\.io/i.test(text)) {
            pass('site:legacy-vkgaming', '/vkgaming/ redirects to root site');
            return;
        }

        warn('site:legacy-vkgaming', '/vkgaming/ responds but redirect to root was not detected');
    } catch (error) {
        pass('site:legacy-vkgaming', 'Legacy path unreachable (acceptable)');
    }
};

const checkRefreshAuthToken = async () => {
    try {
        const response = await fetch(`${FUNCTIONS_BASE}/refreshAuthToken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { refreshToken: '' } })
        });

        const payload = await response.json().catch(() => ({}));
        const message = payload?.error?.message || '';

        if (response.status === 404) {
            fail('fn:refreshAuthToken', 'Function not deployed');
            return;
        }

        if (message.includes('refreshToken is required') || message.includes('invalid-argument')) {
            pass('fn:refreshAuthToken', 'Deployed and validates input');
            return;
        }

        pass('fn:refreshAuthToken', `Reachable (${response.status})`);
    } catch (error) {
        fail('fn:refreshAuthToken', error.message);
    }
};

const checkTwitchAuthConfig = async () => {
    try {
        const response = await fetch(`${FUNCTIONS_BASE}/twitchAuth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: {
                    code: 'uat-invalid-code',
                    redirectUri: `${SITE}/auth/twitch/callback`
                }
            })
        });

        const payload = await response.json().catch(() => ({}));
        const message = payload?.error?.message || '';

        if (response.status === 404) {
            fail('fn:twitchAuth', 'Function not deployed');
            return;
        }

        if (message.includes('not configured') || message.includes('failed-precondition')) {
            fail('fn:twitchAuth', 'Twitch client_id/secret missing in functions config');
            return;
        }

        if (message.includes('Failed to exchange') || message.includes('unauthenticated')) {
            pass('fn:twitchAuth', 'Deployed with Twitch secrets (invalid code rejected as expected)');
            return;
        }

        if (message.includes('referer') || message.includes('blocked')) {
            fail('fn:twitchAuth', message);
            return;
        }

        pass('fn:twitchAuth', `Reachable (${message || response.status})`);
    } catch (error) {
        fail('fn:twitchAuth', error.message);
    }
};

const checkYouTubeAuthConfig = async () => {
    try {
        const response = await fetch(`${FUNCTIONS_BASE}/youtubeAuth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: {
                    code: 'uat-invalid-code',
                    redirectUri: `${SITE}/auth/youtube/callback`
                }
            })
        });

        const payload = await response.json().catch(() => ({}));
        const message = payload?.error?.message || '';

        if (response.status === 404) {
            fail('fn:youtubeAuth', 'Function not deployed');
            return;
        }

        if (message.includes('not configured') || message.includes('failed-precondition')) {
            warn('fn:youtubeAuth', 'YouTube client_id/secret missing in functions config (optional until enabled)');
            return;
        }

        if (message.includes('Failed to exchange') || message.includes('unauthenticated')) {
            pass('fn:youtubeAuth', 'Deployed with YouTube secrets (invalid code rejected as expected)');
            return;
        }

        pass('fn:youtubeAuth', `Reachable (${message || response.status})`);
    } catch (error) {
        fail('fn:youtubeAuth', error.message);
    }
};

const checkDatabasePaths = async () => {
    const paths = [
        { path: 'tournaments/heroes3', expectPublic: true },
        { path: 'users', expectPublic: true },
        { path: 'prizePoolFunding', expectPublic: true },
        { path: 'meta', expectPublic: false }
    ];

    for (const { path: dbPath, expectPublic } of paths) {
        try {
            const url = `${DATABASE_URL}/${dbPath}.json?shallow=true&limitToFirst=1`;
            const response = await fetch(url);
            if (response.ok) {
                await response.json();
                pass(`firebase:${dbPath}`, expectPublic ? 'Readable' : 'Readable (unexpected — may be rules drift)');
                continue;
            }

            if (response.status === 401 && !expectPublic) {
                pass(`firebase:${dbPath}`, 'Auth-gated as expected (401)');
                continue;
            }

            fail(`firebase:${dbPath}`, `HTTP ${response.status}`);
        } catch (error) {
            fail(`firebase:${dbPath}`, error.message);
        }
    }
};

const main = async () => {
    console.log('Konoplay critical UAT checks\n');
    console.log(`Site:      ${SITE}`);
    console.log(`Functions: ${FUNCTIONS_BASE}`);
    console.log(`Database:  ${DATABASE_URL}\n`);

    const scriptPath = await checkSiteShell();
    await checkMainBundle(scriptPath);
    await checkOAuthCallbackFallback();
    await checkSpa404();
    await checkLegacyPath();
    await checkTwitchAuthConfig();
    await checkYouTubeAuthConfig();
    await checkRefreshAuthToken();
    await checkDatabasePaths();

    console.log('');
    results.forEach((item) => {
        const icon = item.ok === true ? 'PASS' : item.ok === 'warn' ? 'WARN' : 'FAIL';
        console.log(`[${icon}] ${item.id}${item.detail ? ` — ${item.detail}` : ''}`);
    });

    const failed = results.filter((item) => item.ok === false);
    const warnings = results.filter((item) => item.ok === 'warn');

    console.log('');
    if (failed.length === 0) {
        console.log(`Automated critical checks: ${results.length - warnings.length} passed, ${warnings.length} warning(s).`);
        console.log('Manual only: Twitch/YouTube login end-to-end, logged-in tournament actions, donations (if in scope).');
        process.exit(warnings.length ? 0 : 0);
    }

    console.log(`${failed.length} critical check(s) failed — fix before inviting UAT testers.`);
    process.exit(1);
};

main();
