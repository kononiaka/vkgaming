import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { authFetch, getFirebaseUid } from './authFetch';
import { fetchLeaderboard, lookForUserId } from './api';
import { getTournamentData } from '../components/tournaments/tournament_api';
import { isRegistrationOpen } from '../utils/tournamentAttendance';
import { resolveCountryCode } from '../utils/country';

export const canLeaveTournament = (tournament) => {
    const status = tournament?.status;
    if (!status || status === 'Started!' || String(status).includes('Finished')) {
        return false;
    }
    return isRegistrationOpen(status);
};

const buildPlayerPayload = async (nickname) => {
    const normalizedNickname = String(nickname || '').trim();
    if (!normalizedNickname) {
        throw new Error('Nickname is required.');
    }

    const userId = await lookForUserId(normalizedNickname);
    if (!userId) {
        throw new Error(`Player "${normalizedNickname}" was not found.`);
    }

    const userResponse = await authFetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`);
    const data = await userResponse.json();
    if (!data) {
        throw new Error(`Player "${normalizedNickname}" has invalid profile data.`);
    }

    const lastRating = data.ratings
        ? parseFloat(data.ratings.split(',').pop().trim()).toFixed(2)
        : parseFloat(0).toFixed(2);

    return {
        payload: {
            name: data.enteredNickname || normalizedNickname,
            stars: data.stars ?? 0,
            ratings: lastRating,
            placeInLeaderboard: await fetchLeaderboard(data),
            registeredUid: getFirebaseUid() || null,
            siteUserId: userId,
            countryCode: resolveCountryCode(data)
        },
        userId
    };
};

export const findRegisteredPlayerKey = (players, { nickname, firebaseUid }) => {
    if (!players || typeof players !== 'object') {
        return null;
    }

    const normalizedNick = String(nickname || '')
        .trim()
        .toLowerCase();

    for (const [key, player] of Object.entries(players)) {
        if (!player || typeof player !== 'object') {
            continue;
        }
        if (firebaseUid && player.registeredUid === firebaseUid) {
            return key;
        }
        if (
            normalizedNick &&
            String(player.name || '')
                .trim()
                .toLowerCase() === normalizedNick
        ) {
            return key;
        }
    }

    return null;
};

export const addCreatorToTournament = async (tournamentId, nickname) => {
    const tournament = await getTournamentData(tournamentId);
    if (!tournament) {
        throw new Error('Tournament not found.');
    }

    const players = tournament.players && typeof tournament.players === 'object' ? tournament.players : {};
    const existingKey = findRegisteredPlayerKey(players, {
        nickname,
        firebaseUid: getFirebaseUid()
    });
    if (existingKey) {
        return { alreadyRegistered: true };
    }

    const registeredCount = Object.values(players).filter(
        (player) => player?.name && player.name.trim() !== '' && player.name.trim() !== 'TBD'
    ).length;

    if (registeredCount >= Number(tournament.maxPlayers)) {
        throw new Error('Tournament is already full.');
    }

    const { payload } = await buildPlayerPayload(nickname);

    const response = await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/players/.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error('Could not add you to the tournament.');
    }

    return { ok: true };
};

export const leaveTournament = async (tournamentId, nickname) => {
    const tournament = await getTournamentData(tournamentId);
    if (!tournament) {
        throw new Error('Tournament not found.');
    }

    if (!canLeaveTournament(tournament)) {
        throw new Error('You cannot leave this tournament at its current stage.');
    }

    const players = tournament.players && typeof tournament.players === 'object' ? tournament.players : {};
    const playerKey = findRegisteredPlayerKey(players, {
        nickname,
        firebaseUid: getFirebaseUid()
    });

    if (!playerKey) {
        throw new Error('You are not registered for this tournament.');
    }

    const response = await authFetch(
        `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/players/${playerKey}.json`,
        { method: 'DELETE' }
    );

    if (!response.ok) {
        throw new Error('Could not leave the tournament.');
    }

    return { ok: true };
};

export const kickPlayerFromTournament = async (tournamentId, playerKey) => {
    const tournament = await getTournamentData(tournamentId);
    if (!tournament) {
        throw new Error('Tournament not found.');
    }

    if (!canLeaveTournament(tournament)) {
        throw new Error('Players cannot be removed at this tournament stage.');
    }

    const players = tournament.players && typeof tournament.players === 'object' ? tournament.players : {};
    if (!playerKey || !players[playerKey]) {
        throw new Error('Player not found in this tournament.');
    }

    const response = await authFetch(
        `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/players/${playerKey}.json`,
        { method: 'DELETE' }
    );

    if (!response.ok) {
        throw new Error('Could not remove the player.');
    }

    return { ok: true };
};
