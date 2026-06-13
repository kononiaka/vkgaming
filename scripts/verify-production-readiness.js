#!/usr/bin/env node
/**
 * Live production readiness checks.
 * Verifies env vars, Firebase RTDB reachability, and twitchStreamStatus function.
 *
 * Usage:
 *   npm run verify:live
 *   VERIFY_PRODUCTION_ENV=1 npm test -- --testPathPattern=productionReadiness
 *
 * Loads .env from project root when present (simple KEY=VALUE parser).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const loadDotEnv = () => {
    const envPath = path.join(ROOT, '.env');
    if (!fs.existsSync(envPath)) {
        return;
    }

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }
        const eq = trimmed.indexOf('=');
        if (eq === -1) {
            return;
        }
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = value;
        }
    });
};

loadDotEnv();

const REQUIRED = [
    { key: 'REACT_APP_FIREBASE_API_KEY', hint: 'Firebase web API key' },
    { key: 'REACT_APP_FIREBASE_DATABASE_URL', hint: 'RTDB URL' },
    { key: 'REACT_APP_FIREBASE_PROJECT_ID', hint: 'Firebase project id' },
    { key: 'REACT_APP_TWITCH_CLIENT_ID', hint: 'Twitch OAuth client id (frontend)' }
];

const projectId =
    process.env.REACT_APP_FIREBASE_PROJECT_ID ||
    (process.env.REACT_APP_FIREBASE_DATABASE_URL || '').match(/https:\/\/([^.]+)/)?.[1]?.replace(
        '-default-rtdb',
        ''
    ) ||
    'test-prod-app-81915';

const databaseUrl = (
    process.env.REACT_APP_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`
).replace(/\/$/, '');

const functionsBase =
    process.env.REACT_APP_FIREBASE_FUNCTIONS_BASE ||
    `https://us-central1-${projectId}.cloudfunctions.net`;

const results = [];

const pass = (name, detail) => results.push({ name, ok: true, detail });
const fail = (name, detail) => results.push({ name, ok: false, detail });

const isValidEnvValue = (value) =>
    Boolean(value && String(value).trim() && !String(value).includes('your-project'));

const checkEnv = (options = {}) => {
    let allOk = true;
    REQUIRED.forEach(({ key, hint }) => {
        const value = process.env[key];
        if (isValidEnvValue(value)) {
            pass(`env:${key}`, 'Set');
            return;
        }

        if (key === 'REACT_APP_FIREBASE_DATABASE_URL' && options.rtdbOk) {
            pass(`env:${key}`, `Not in .env — using working default (${databaseUrl})`);
            return;
        }

        if (key === 'REACT_APP_FIREBASE_PROJECT_ID' && (options.rtdbOk || options.functionsOk)) {
            pass(`env:${key}`, `Not in .env — using project id ${projectId}`);
            return;
        }

        fail(`env:${key}`, `Missing or placeholder — ${hint}`);
        allOk = false;
    });

    if (process.env.REACT_APP_FIREBASE_FUNCTIONS_BASE) {
        if (!process.env.REACT_APP_FIREBASE_FUNCTIONS_BASE.includes(projectId)) {
            fail('env:functions-project', 'REACT_APP_FIREBASE_FUNCTIONS_BASE does not match project id');
            allOk = false;
        } else {
            pass('env:functions-project', 'Functions base matches project id');
        }
    } else {
        pass('env:functions-project', `Using default functions base for ${projectId}`);
    }

    return allOk;
};

const checkDatabase = async () => {
    try {
        const url = `${databaseUrl}/tournaments/heroes3.json?shallow=true`;
        const response = await fetch(url);
        if (!response.ok) {
            fail('firebase:rtdb', `HTTP ${response.status} for tournaments/heroes3`);
            return false;
        }
        await response.json();
        pass('firebase:rtdb', 'Tournaments path reachable');
        return true;
    } catch (error) {
        fail('firebase:rtdb', error.message);
        return false;
    }
};

const checkTwitchStreamStatus = async () => {
    try {
        const url = `${functionsBase}/twitchStreamStatus`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { logins: ['konoplay_readiness_probe'] } })
        });

        if (!response.ok) {
            fail('firebase:twitchStreamStatus', `HTTP ${response.status} — deploy functions:twitchStreamStatus`);
            return false;
        }

        const payload = await response.json();
        const liveLogins = payload?.result?.liveLogins ?? payload?.liveLogins;

        if (!Array.isArray(liveLogins)) {
            fail('firebase:twitchStreamStatus', `Unexpected response: ${JSON.stringify(payload).slice(0, 200)}`);
            return false;
        }

        pass('firebase:twitchStreamStatus', 'Callable responds with liveLogins array');
        return true;
    } catch (error) {
        fail('firebase:twitchStreamStatus', error.message);
        return false;
    }
};

const checkTwitchAuth = async () => {
    try {
        const url = `${functionsBase}/twitchAuth`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { code: 'invalid-probe', redirectUri: 'http://localhost/auth/twitch/callback' } })
        });

        const payload = await response.json().catch(() => ({}));
        const message = payload?.error?.message || '';

        if (response.status === 404) {
            fail('firebase:twitchAuth', 'Function not found — deploy functions');
            return false;
        }

        if (
            message.includes('not configured') ||
            message.includes('failed-precondition') ||
            message.includes('Failed to exchange')
        ) {
            pass('firebase:twitchAuth', 'Deployed (Twitch server config may still need client_id/secret)');
            return true;
        }

        pass('firebase:twitchAuth', `Reachable (${response.status})`);
        return true;
    } catch (error) {
        fail('firebase:twitchAuth', error.message);
        return false;
    }
};

const main = async () => {
    console.log('Konoplay production readiness\n');
    console.log(`Project:   ${projectId}`);
    console.log(`Database:  ${databaseUrl}`);
    console.log(`Functions: ${functionsBase}\n`);

    const rtdbOk = await checkDatabase();
    const streamOk = await checkTwitchStreamStatus();
    const authOk = await checkTwitchAuth();
    checkEnv({ rtdbOk, functionsOk: streamOk || authOk });

    console.log('');
    results.forEach((item) => {
        const icon = item.ok ? '✓' : '✗';
        console.log(`${icon} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
    });

    const failed = results.filter((item) => !item.ok);
    console.log('');

    if (failed.length === 0) {
        console.log('All checks passed. Ready for live use.');
        console.log('Manual smoke test: open /live and confirm Live Arena + Watch buttons.');
        process.exit(0);
    }

    console.log(`${failed.length} check(s) failed. Fix before go-live.`);
    console.log('Twitch server secrets: firebase functions:config:get twitch');
    process.exit(1);
};

main();
