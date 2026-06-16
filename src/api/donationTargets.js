import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { authFetch } from './authFetch';

export const loadDonationTargetTournamentIds = async (firebaseUid) => {
    if (!firebaseUid) {
        return null;
    }

    const response = await authFetch(`${FIREBASE_DATABASE_URL}/users/${firebaseUid}/donationTargetTournamentIds.json`);
    if (!response.ok) {
        return null;
    }

    const data = await response.json();
    return Array.isArray(data) ? data.map(String) : null;
};

export const saveDonationTargetTournamentIds = async (firebaseUid, tournamentIds) => {
    if (!firebaseUid) {
        throw new Error('Log in to save donation targets.');
    }

    const payload = Array.isArray(tournamentIds) ? tournamentIds.map(String) : [];
    const response = await authFetch(`${FIREBASE_DATABASE_URL}/users/${firebaseUid}/donationTargetTournamentIds.json`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        throw new Error('Could not save donation targets.');
    }

    return payload;
};
