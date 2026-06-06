import { getFirebaseUid } from '../api/authFetch';

export const isPublicTournament = (tournament) => tournament?.isPublic !== false;

export const isTournamentCreator = (tournament, userNickName, firebaseUid = getFirebaseUid()) => {
    if (!tournament) {
        return false;
    }

    if (tournament.createdByUid && firebaseUid) {
        return tournament.createdByUid === firebaseUid;
    }

    if (tournament.createdBy && userNickName) {
        return tournament.createdBy === userNickName;
    }

    return false;
};

export const isTournamentDeleteBlocked = (tournament) => tournament?.status === 'Started!';

export const canDeleteTournament = (tournament, { isAdmin, userNickName, firebaseUid = getFirebaseUid() }) => {
    if (!tournament) {
        return false;
    }

    if (isAdmin) {
        return true;
    }

    return isTournamentCreator(tournament, userNickName, firebaseUid);
};

export const isPlayerVisibleTournament = (tournament) => {
    if (!isPublicTournament(tournament)) {
        return false;
    }

    const status = tournament?.status;
    return (
        status === 'Registration' ||
        status === 'Registration Started' ||
        status === 'Started!'
    );
};
