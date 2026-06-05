import { FIREBASE_FUNCTIONS_BASE } from '../config/firebase';
import { getAuthToken } from './authFetch';

export async function deleteAccount(confirmNickname) {
    const token = getAuthToken();
    if (!token) {
        throw new Error('You must be logged in to delete your account.');
    }

    const res = await fetch(`${FIREBASE_FUNCTIONS_BASE}/deleteAccount`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ data: { confirmNickname: confirmNickname.trim() } })
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(payload?.error?.message || 'Failed to delete account.');
    }

    return payload.result;
}
