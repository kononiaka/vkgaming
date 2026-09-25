import { FIREBASE_DATABASE_URL, FIREBASE_FUNCTIONS_BASE } from '../config/firebase';
import { authFetch, getAuthToken } from './authFetch';
import { buildGazetteFacts, fillGazetteText, gazetteArchiveIdsForIssue, isSameGazetteIssue, listGazetteIssues, nextPublishedGazetteIssue, preferMatchingGazetteDraft, previewGazetteIssue, sanitizeGazetteIssue, selectGazetteFacts } from '../utils/gazette';

const GAZETTE_CURRENT_URL = `${FIREBASE_DATABASE_URL}/gazette/current.json`;
const GAZETTE_DRAFT_URL = `${FIREBASE_DATABASE_URL}/gazette/draft.json`;
const GAZETTE_ISSUES_URL = `${FIREBASE_DATABASE_URL}/gazette/issues.json`;
const LOCAL_CURRENT_KEY = 'konoplay.gazette.current';
const LOCAL_ISSUES_KEY = 'konoplay.gazette.issues';

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

const readLocalIssues = () => {
    if (typeof localStorage === 'undefined') {
        return {};
    }
    try {
        const raw = localStorage.getItem(LOCAL_ISSUES_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

const writeLocalIssues = (issuesById) => {
    if (typeof localStorage === 'undefined') {
        return;
    }
    localStorage.setItem(LOCAL_ISSUES_KEY, JSON.stringify(issuesById));
};

const clearLocalCurrent = () => {
    if (typeof localStorage === 'undefined') {
        return;
    }
    localStorage.removeItem(LOCAL_CURRENT_KEY);
};

const removeLocalIssue = (issue) => {
    const issues = readLocalIssues();
    Object.entries(issues).forEach(([id, stored]) => {
        if (id === issue?.id || isSameGazetteIssue({ ...stored, id }, issue)) {
            delete issues[id];
        }
    });
    writeLocalIssues(issues);
    return issues;
};

const issueArchiveUrl = (id) => `${FIREBASE_DATABASE_URL}/gazette/issues/${encodeURIComponent(id)}.json`;

const hasRealAuthToken = () => {
    const token = getAuthToken();
    return Boolean(token) && token !== 'local-dev-admin' && token.split('.').length === 3;
};

const asIssueMap = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

const loadRemoteIssuesById = async () => {
    const response = await fetch(GAZETTE_ISSUES_URL);
    if (!response.ok) {
        return {};
    }
    return asIssueMap(await response.json());
};

const writeRemoteJson = async (url, value, errorMessage) => {
    const response = await authFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value)
    });
    if (!response.ok) {
        throw new Error(
            response.status === 401 || response.status === 403
                ? 'Failed to update Gazette (not signed in as admin, or database rules not deployed).'
                : errorMessage || `Failed to update Gazette (${response.status})`
        );
    }
    return response;
};

export async function fetchGazetteCurrent() {
    const response = await fetch(GAZETTE_CURRENT_URL);
    if (!response.ok) {
        throw new Error('Failed to load Gazette');
    }
    const remote = await response.json();
    if (remote) {
        return remote;
    }
    return hasRealAuthToken() ? null : readLocalCurrent();
}

export async function fetchGazetteFacts() {
    const response = await fetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3.json`);
    if (!response.ok) {
        throw new Error('Failed to load cups for Gazette');
    }
    const tournaments = await response.json();
    return buildGazetteFacts(tournaments);
}

export async function fetchGazetteIssues() {
    const remote = await loadRemoteIssuesById();
    const current = await fetchGazetteCurrent();
    const issuesById = hasRealAuthToken() ? remote : { ...remote, ...readLocalIssues() };
    return listGazetteIssues(issuesById, current);
}

export async function fetchGazetteDraft() {
    const response = await authFetch(GAZETTE_DRAFT_URL);
    if (!response.ok) {
        return null;
    }
    return response.json();
}

const composeLocalDraft = async (eventId) => {
    const response = await fetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3.json`);
    if (!response.ok) {
        throw new Error('Failed to load cups for Gazette');
    }
    const tournaments = await response.json();
    const facts = selectGazetteFacts(buildGazetteFacts(tournaments), eventId);
    return {
        facts,
        issue: sanitizeGazetteIssue(previewGazetteIssue(facts, eventId), facts)
    };
};

export async function generateGazetteDraft(eventId) {
    const localDraft = await composeLocalDraft(eventId);
    let issue = localDraft.issue;

    if (hasRealAuthToken()) {
        try {
            const response = await fetch(`${FIREBASE_FUNCTIONS_BASE}/generateGazette`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify({ data: { eventId: eventId || null } })
            });
            const payload = await response.json().catch(() => ({}));
            if (response.ok) {
                const remote = sanitizeGazetteIssue(payload.result?.issue || payload.result);
                const chosen = preferMatchingGazetteDraft(localDraft.issue, remote, eventId);
                issue = sanitizeGazetteIssue(
                    {
                        ...chosen,
                        headline: fillGazetteText(chosen.headline, localDraft.facts),
                        body: fillGazetteText(chosen.body, localDraft.facts)
                    },
                    localDraft.facts
                );
            }
        } catch (error) {
            console.error('generateGazette function failed, using local draft:', error);
        }

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
        const localId = next.id || `local-${Date.now()}`;
        const stored = { ...next, id: localId };
        const issues = readLocalIssues();
        issues[localId] = stored;
        writeLocalIssues(issues);
        writeLocalCurrent(stored);
        return stored;
    }

    const archiveResponse = await authFetch(GAZETTE_ISSUES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
    });
    if (!archiveResponse.ok) {
        throw new Error(
            archiveResponse.status === 401 || archiveResponse.status === 403
                ? 'Failed to archive Gazette issue (database rules not deployed). Run: firebase deploy --only database'
                : `Failed to archive Gazette issue (${archiveResponse.status})`
        );
    }
    const archive = await archiveResponse.json().catch(() => ({}));
    const archiveId = archive?.name || next.id;
    const stored = sanitizeGazetteIssue({
        ...next,
        id: archiveId
    });

    if (archive?.name) {
        await writeRemoteJson(issueArchiveUrl(archive.name), stored, 'Failed to archive Gazette issue');
    }

    await writeRemoteJson(GAZETTE_CURRENT_URL, stored, 'Failed to publish Gazette');

    await authFetch(GAZETTE_DRAFT_URL, { method: 'DELETE' });
    return stored;
}

export async function discardGazetteDraft() {
    if (!hasRealAuthToken()) {
        return;
    }
    await authFetch(GAZETTE_DRAFT_URL, { method: 'DELETE' });
}

export async function deleteGazetteIssue(issue) {
    if (!issue) {
        throw new Error('That Gazette issue cannot be deleted.');
    }

    const current = await fetchGazetteCurrent();
    const removingCurrent =
        isSameGazetteIssue(issue, current) || Boolean(issue.id && current?.id && issue.id === current.id);
    const remoteIssues = await loadRemoteIssuesById();
    const archiveIds = gazetteArchiveIdsForIssue(remoteIssues, issue);

    const applyCurrent = async (next) => {
        if (hasRealAuthToken()) {
            await writeRemoteJson(GAZETTE_CURRENT_URL, next, 'Failed to update the Gazette on the stands.');
        }
        if (next) {
            writeLocalCurrent(next);
        } else {
            clearLocalCurrent();
        }
        return next;
    };

    if (!hasRealAuthToken()) {
        if (archiveIds.length > 0 || (removingCurrent && current && !String(current.id || '').startsWith('local-'))) {
            throw new Error('Sign in with Twitch as an admin to delete Gazette issues from the database.');
        }
        const remainingById = removeLocalIssue(issue);
        const remaining = listGazetteIssues(remainingById, removingCurrent ? null : current).filter(
            (item) => !isSameGazetteIssue(item, issue)
        );
        const nextCurrent = removingCurrent ? nextPublishedGazetteIssue(remaining, issue) : current;
        if (removingCurrent) {
            await applyCurrent(nextCurrent);
        }
        return { current: removingCurrent ? nextCurrent : current };
    }

    if (archiveIds.length === 0 && !removingCurrent) {
        throw new Error('That Gazette issue was not found in the database.');
    }

    await Promise.all(
        archiveIds.map((id) => writeRemoteJson(issueArchiveUrl(id), null, `Failed to delete Gazette issue (${id})`))
    );
    removeLocalIssue(issue);

    if (!removingCurrent) {
        return { current };
    }

    const remaining = listGazetteIssues(await loadRemoteIssuesById(), null).filter(
        (item) => !isSameGazetteIssue(item, issue)
    );
    const nextCurrent = nextPublishedGazetteIssue(remaining, issue);
    await applyCurrent(nextCurrent);
    return { current: nextCurrent };
}
