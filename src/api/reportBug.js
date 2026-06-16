import { FIREBASE_FUNCTIONS_BASE } from '../config/firebase';

const REPORT_BUG_URL = `${FIREBASE_FUNCTIONS_BASE}/reportBug`;

export async function submitBugReport(payload) {
    const response = await fetch(REPORT_BUG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload })
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = body?.error?.message || 'Failed to submit bug report';
        throw new Error(message);
    }

    return body.result || body;
}
