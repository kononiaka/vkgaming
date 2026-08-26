import { FIREBASE_DATABASE_URL, FIREBASE_FUNCTIONS_BASE } from '../config/firebase';
import { authFetch, getAuthToken } from './authFetch';
import { buildGazetteFacts, composeGazetteIssue, sanitizeGazetteIssue } from '../utils/gazette';

const GAZETTE_CURRENT_URL = `${FIREBASE_DATABASE_URL}/gazette/current.json`;
const GAZETTE_DRAFT_URL = `${FIREBASE_DATABASE_URL}/gazette/draft.json`;
const LOCAL_CURRENT_KEY = 'konoplay.gazette.current';

const readLocalCurrent = () => {
    if (typeof localStorage === 'undefined') {
        return null;
    }
    try {
        const raw = localStorage.getItem(LOCAL_CURRENT_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const writeLocalCurrent = (issue) => {
    if (typeof localStorage === 'undefined') {
        return;
    }
    localStorage.setItem(LOCAL_CURRENT_KEY, JSON.stringify(issue));
};

const hasRealAuthToken = () => {
    const token = getAuthToken();
    return Boolean(token) && token !== 'local-dev-admin' && token.split('.').length === 3;
};

export async function fetchGazetteCurrent() {
    const response = await fetch(GAZETTE_CURRENT_URL);
    if (!response.ok) {
        throw new Error('Failed to load Gazette');
    }
    const remote = await response.json();
    return remote || readLocalCurrent();
}

export async function fetchGazetteDraft() {
    const response = await authFetch(GAZETTE_DRAFT_URL);
    if (!response.ok) {
        return null;
    }
    return response.json();
}

const composeLocalDraft = async () => {
    const response = await fetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3.json`);
    if (!response.ok) {
        throw new Error('Failed to load cups for Gazette');
    }
    const tournaments = await response.json();
    const facts = buildGazetteFacts(tournaments);
    return sanitizeGazetteIssue(composeGazetteIssue(facts), facts);
};

export async function generateGazetteDraft() {
    if (hasRealAuthToken()) {
        const response = await fetch(`${FIREBASE_FUNCTIONS_BASE}/generateGazette`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ data: {} })
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
            return sanitizeGazetteIssue(payload.result?.issue || payload.result);
        }
    }

    const issue = await composeLocalDraft();
    if (hasRealAuthToken()) {
        await authFetch(GAZETTE_DRAFT_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(issue)
        });
    }
    return issue;
}

export async function publishGazetteIssue(issue) {
    const next = sanitizeGazetteIssue({
        ...issue,
        publishedAt: new Date().toISOString()
    });

    if (!hasRealAuthToken()) {
        writeLocalCurrent(next);
        return next;
    }

    const currentResponse = await authFetch(GAZETTE_CURRENT_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
    });
    if (!currentResponse.ok) {
        throw new Error('Failed to publish Gazette');
    }

    await authFetch(GAZETTE_DRAFT_URL, { method: 'DELETE' });
    return next;
}

export async function discardGazetteDraft() {
    if (!hasRealAuthToken()) {
        return;
    }
    await authFetch(GAZETTE_DRAFT_URL, { method: 'DELETE' });
}
