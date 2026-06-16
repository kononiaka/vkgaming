import { FIREBASE_FUNCTIONS_BASE } from '../config/firebase';

const callFirebaseFunction = async (functionName, data) => {
    const response = await fetch(`${FIREBASE_FUNCTIONS_BASE}/${functionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = payload?.error?.message || `${functionName} failed`;
        throw new Error(message);
    }

    return payload?.result ?? payload;
};

export const refreshFirebaseAuthToken = (refreshToken) => callFirebaseFunction('refreshAuthToken', { refreshToken });
