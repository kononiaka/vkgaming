import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { authFetch } from './authFetch';

const tournamentBase = (tournamentId) =>
    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${encodeURIComponent(tournamentId)}`;

export const requestTournamentCommentator = async (tournamentId, payload) => {
    const { firebaseUid, nickname, twitchLogin } = payload;
    if (!firebaseUid || !nickname || !twitchLogin) {
        throw new Error('Log in with Twitch to request commentator access.');
    }

    const response = await authFetch(
        `${tournamentBase(tournamentId)}/commentatorRequests/${encodeURIComponent(firebaseUid)}.json`,
        {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nickname,
                registeredUid: firebaseUid,
                twitchLogin,
                requestedAt: new Date().toISOString(),
                status: 'pending'
            })
        }
    );

    if (!response.ok) {
        throw new Error('Could not submit commentator request.');
    }

    return { ok: true };
};

export const withdrawCommentatorRequest = async (tournamentId, firebaseUid) => {
    const response = await authFetch(
        `${tournamentBase(tournamentId)}/commentatorRequests/${encodeURIComponent(firebaseUid)}.json`,
        { method: 'DELETE' }
    );

    if (!response.ok) {
        throw new Error('Could not withdraw commentator request.');
    }

    return { ok: true };
};

export const approveCommentatorRequest = async (tournamentId, firebaseUid, request, approvedByUid) => {
    const commentatorPayload = {
        name: request.name,
        registeredUid: request.registeredUid || firebaseUid,
        twitchLogin: request.twitchLogin,
        approvedAt: new Date().toISOString(),
        approvedByUid: approvedByUid || null,
        isCommentating: false
    };

    const approveResponse = await authFetch(
        `${tournamentBase(tournamentId)}/commentators/${encodeURIComponent(firebaseUid)}.json`,
        {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(commentatorPayload)
        }
    );

    if (!approveResponse.ok) {
        throw new Error('Could not approve commentator.');
    }

    const deleteResponse = await authFetch(
        `${tournamentBase(tournamentId)}/commentatorRequests/${encodeURIComponent(firebaseUid)}.json`,
        { method: 'DELETE' }
    );

    if (!deleteResponse.ok) {
        throw new Error('Commentator approved, but the pending request could not be cleared.');
    }

    return { ok: true };
};

export const rejectCommentatorRequest = async (tournamentId, firebaseUid) => {
    const response = await authFetch(
        `${tournamentBase(tournamentId)}/commentatorRequests/${encodeURIComponent(firebaseUid)}.json`,
        { method: 'DELETE' }
    );

    if (!response.ok) {
        throw new Error('Could not reject commentator request.');
    }

    return { ok: true };
};

export const setTournamentCommentating = async (tournamentId, firebaseUid, commentator, isCommentating) => {
    const response = await authFetch(
        `${tournamentBase(tournamentId)}/commentators/${encodeURIComponent(firebaseUid)}.json`,
        {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...commentator,
                isCommentating: Boolean(isCommentating)
            })
        }
    );

    if (!response.ok) {
        throw new Error('Could not update commentating status.');
    }

    return { ok: true };
};
