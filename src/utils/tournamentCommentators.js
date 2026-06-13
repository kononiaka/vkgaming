import { isRegistrationOpen } from './tournamentAttendance';
import { isTournamentCreator } from './tournamentVisibility';

export const canRequestTournamentCommentator = (tournament) => {
    const status = tournament?.status;
    if (!status || String(status).includes('Finished')) {
        return false;
    }

    return (
        status === 'Started!' ||
        status === 'Registration finished!' ||
        isRegistrationOpen(status)
    );
};

export const getCommentatorRequestForUser = (tournament, firebaseUid) => {
    if (!firebaseUid || !tournament?.commentatorRequests) {
        return null;
    }

    return tournament.commentatorRequests[firebaseUid] || null;
};

export const getApprovedCommentator = (tournament, firebaseUid) => {
    if (!firebaseUid || !tournament?.commentators) {
        return null;
    }

    return tournament.commentators[firebaseUid] || null;
};

export const getPendingCommentatorRequests = (tournament) =>
    Object.entries(tournament?.commentatorRequests || {})
        .map(([requestId, request]) => ({ requestId, ...request }))
        .filter((request) => request?.status === 'pending' || !request?.status);

export const getApprovedCommentators = (tournament) =>
    Object.entries(tournament?.commentators || {}).map(([commentatorUid, commentator]) => ({
        commentatorUid,
        ...commentator
    }));

export const getActiveCommentatorLogins = (tournament) =>
    getApprovedCommentators(tournament)
        .filter((commentator) => commentator.isCommentating && commentator.twitchLogin)
        .map((commentator) => commentator.twitchLogin);

export const canManageCommentatorRequests = (
    tournament,
    { isAdmin, userNickName, firebaseUid }
) => isAdmin || isTournamentCreator(tournament, userNickName, firebaseUid);

export const canToggleTournamentCommentating = (tournament, firebaseUid) => {
    const commentator = getApprovedCommentator(tournament, firebaseUid);
    return Boolean(commentator) && tournament?.status === 'Started!';
};
