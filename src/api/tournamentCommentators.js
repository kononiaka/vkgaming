import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { authFetch } from './authFetch';

const tournamentBase = (tournamentId) =>
    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${encodeURIComponent(tournamentId)}`;

const profileCommentatorRequestBase = (creatorUid, tournamentId, requesterUid) =>
    `${FIREBASE_DATABASE_URL}/users/${encodeURIComponent(creatorUid)}/profileCommentatorRequests/${encodeURIComponent(tournamentId)}/${encodeURIComponent(requesterUid)}.json`;

const buildCommentatorRequestPayload = ({ firebaseUid, nickname, twitchLogin }) => ({
    name: nickname,
    registeredUid: firebaseUid,
    twitchLogin,
    requestedAt: new Date().toISOString(),
    status: 'pending'
});

const buildProfileCommentatorRequestPayload = (tournamentId, tournamentName, requestPayload) => ({
    ...requestPayload,
    tournamentId,
    tournamentName: tournamentName || 'Tournament'
});

const writeProfileCommentatorRequest = async (creatorUid, tournamentId, tournamentName, requestPayload) => {
    if (!creatorUid) {
        return;
    }

    const response = await authFetch(
        profileCommentatorRequestBase(creatorUid, tournamentId, requestPayload.registeredUid),
        {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildProfileCommentatorRequestPayload(tournamentId, tournamentName, requestPayload))
        }
    );

    if (!response.ok) {
        throw new Error('Commentator request saved for the cup, but could not notify the host profile.');
    }
};

const deleteProfileCommentatorRequest = async (creatorUid, tournamentId, requesterUid) => {
    if (!creatorUid || !requesterUid) {
        return;
    }

    await authFetch(profileCommentatorRequestBase(creatorUid, tournamentId, requesterUid), {
        method: 'DELETE'
    });
};

export const requestTournamentCommentator = async (tournamentId, payload) => {
    const { firebaseUid, nickname, twitchLogin, creatorUid, tournamentName } = payload;
    if (!firebaseUid || !nickname || !twitchLogin) {
        throw new Error('Log in with Twitch to request commentator access.');
    }

    const requestPayload = buildCommentatorRequestPayload({ firebaseUid, nickname, twitchLogin });

    const response = await authFetch(
        `${tournamentBase(tournamentId)}/commentatorRequests/${encodeURIComponent(firebaseUid)}.json`,
        {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload)
        }
    );

    if (!response.ok) {
        throw new Error('Could not submit commentator request.');
    }

    if (creatorUid) {
        try {
            await writeProfileCommentatorRequest(creatorUid, tournamentId, tournamentName, requestPayload);
        } catch (error) {
            await authFetch(
                `${tournamentBase(tournamentId)}/commentatorRequests/${encodeURIComponent(firebaseUid)}.json`,
                { method: 'DELETE' }
            );
            throw error;
        }
    }

    return { ok: true };
};

export const withdrawCommentatorRequest = async (tournamentId, firebaseUid, options = {}) => {
    const response = await authFetch(
        `${tournamentBase(tournamentId)}/commentatorRequests/${encodeURIComponent(firebaseUid)}.json`,
        { method: 'DELETE' }
    );

    if (!response.ok) {
        throw new Error('Could not withdraw commentator request.');
    }

    await deleteProfileCommentatorRequest(options.creatorUid, tournamentId, firebaseUid);

    return { ok: true };
};

export const approveCommentatorRequest = async (tournamentId, firebaseUid, request, approvedByUid, options = {}) => {
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

    await deleteProfileCommentatorRequest(options.creatorUid, tournamentId, firebaseUid);

    return { ok: true };
};

export const rejectCommentatorRequest = async (tournamentId, firebaseUid, options = {}) => {
    const response = await authFetch(
        `${tournamentBase(tournamentId)}/commentatorRequests/${encodeURIComponent(firebaseUid)}.json`,
        { method: 'DELETE' }
    );

    if (!response.ok) {
        throw new Error('Could not reject commentator request.');
    }

    await deleteProfileCommentatorRequest(options.creatorUid, tournamentId, firebaseUid);

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

export const loadProfileCommentatorRequests = async (creatorUid) => {
    if (!creatorUid) {
        return {};
    }

    const response = await authFetch(
        `${FIREBASE_DATABASE_URL}/users/${encodeURIComponent(creatorUid)}/profileCommentatorRequests.json`
    );

    if (!response.ok) {
        throw new Error('Could not load commentator requests.');
    }

    return (await response.json()) || {};
};
