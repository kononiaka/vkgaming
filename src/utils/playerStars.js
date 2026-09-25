import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { calculateStarsFromRating } from '../api/api';
import { authFetch as defaultAuthFetch } from '../api/authFetch';

/** Frozen cup stars: always the first value in a comma history (entry / start stamp). */
export const getTournamentEntryStars = (value) => {
    if (value == null || value === '') {
        return 0;
    }
    const raw = String(value);
    const first = raw.includes(',') ? raw.split(',')[0].trim() : raw.trim();
    const amount = Number(first);
    return Number.isFinite(amount) ? amount : 0;
};

const getCurrentRating = (ratings) => {
    if (ratings == null || ratings === '') {
        return 0;
    }
    const raw = String(ratings);
    const latest = raw.includes(',') ? raw.split(',').pop().trim() : raw.trim();
    const amount = Number(latest);
    return Number.isFinite(amount) ? amount : 0;
};

/**
 * Recalculate site (users/{id}.stars) from current ratings.
 * Pass attendeeNames to limit to cup players; omit to update everyone.
 */
export const recalculateSitePlayerStars = async ({
    attendeeNames = null,
    authFetch = defaultAuthFetch,
    firebaseUrl = FIREBASE_DATABASE_URL
} = {}) => {
    const usersResponse = await authFetch(`${firebaseUrl}/users.json`);
    const usersData = await usersResponse.json();

    const allPlayers = Object.entries(usersData || {})
        .map(([id, userData]) => ({
            id,
            name: userData.enteredNickname || userData.name,
            ratings: getCurrentRating(userData.ratings),
            stars: getTournamentEntryStars(userData.stars)
        }))
        .filter((player) => player.name && player.ratings > 0)
        .sort((a, b) => b.ratings - a.ratings);

    if (allPlayers.length === 0) {
        return { updatedCount: 0, starsByName: {} };
    }

    const highestRating = allPlayers[0].ratings;
    const lowestRating = Math.min(...allPlayers.map((player) => player.ratings));
    const nameSet = attendeeNames ? new Set(attendeeNames) : null;
    const playersToUpdate = nameSet ? allPlayers.filter((player) => nameSet.has(player.name)) : allPlayers;

    const starsByName = {};

    for (const player of playersToUpdate) {
        const newStars = calculateStarsFromRating(player.ratings, highestRating, lowestRating);

        await authFetch(`${firebaseUrl}/users/${player.id}.json`, {
            method: 'PATCH',
            body: JSON.stringify({ stars: newStars }),
            headers: { 'Content-Type': 'application/json' }
        });

        starsByName[player.name] = newStars;
    }

    // Include attendees with no rating so freeze can still clear/keep a value.
    if (nameSet) {
        for (const name of nameSet) {
            if (starsByName[name] == null) {
                const match = Object.values(usersData || {}).find(
                    (user) => (user?.enteredNickname || user?.name) === name
                );
                starsByName[name] = getTournamentEntryStars(match?.stars);
            }
        }
    }

    return {
        updatedCount: playersToUpdate.length,
        highestRating,
        lowestRating,
        starsByName
    };
};

/**
 * Stamp a single frozen stars value onto each tournament.players entry.
 * Prefer starsByName (from a fresh site recalc); otherwise read users.json.
 */
export const freezeTournamentRosterStars = async (
    tournamentId,
    playersObj,
    {
        starsByName = null,
        authFetch = defaultAuthFetch,
        firebaseUrl = FIREBASE_DATABASE_URL
    } = {}
) => {
    if (!tournamentId || !playersObj) {
        return playersObj || {};
    }

    let resolvedByName = starsByName;
    if (!resolvedByName) {
        const usersResponse = await authFetch(`${firebaseUrl}/users.json`);
        const usersData = await usersResponse.json();
        resolvedByName = {};
        for (const user of Object.values(usersData || {})) {
            const name = user?.enteredNickname || user?.name;
            if (name) {
                resolvedByName[name] = getTournamentEntryStars(user.stars);
            }
        }
    }

    const nextPlayers = { ...playersObj };

    await Promise.all(
        Object.entries(playersObj).map(async ([key, player]) => {
            if (!player?.name) {
                return;
            }
            const frozen =
                resolvedByName[player.name] != null
                    ? getTournamentEntryStars(resolvedByName[player.name])
                    : getTournamentEntryStars(player.stars);

            await authFetch(`${firebaseUrl}/tournaments/heroes3/${tournamentId}/players/${key}.json`, {
                method: 'PATCH',
                body: JSON.stringify({ stars: frozen }),
                headers: { 'Content-Type': 'application/json' }
            });

            nextPlayers[key] = { ...player, stars: frozen };
        })
    );

    return nextPlayers;
};

/** Recalc site stars for attendees (optional) then freeze them onto the tournament roster. */
export const refreshAndFreezeTournamentStars = async (
    tournamentId,
    playersObj,
    { recalculate = true, authFetch = defaultAuthFetch, firebaseUrl = FIREBASE_DATABASE_URL } = {}
) => {
    const attendeeNames = Object.values(playersObj || {})
        .filter((player) => player && player.name)
        .map((player) => player.name);

    let starsByName = null;
    let recalcResult = { updatedCount: 0 };

    if (recalculate && attendeeNames.length > 0) {
        recalcResult = await recalculateSitePlayerStars({
            attendeeNames,
            authFetch,
            firebaseUrl
        });
        starsByName = recalcResult.starsByName;
    }

    const frozenPlayers = await freezeTournamentRosterStars(tournamentId, playersObj, {
        starsByName,
        authFetch,
        firebaseUrl
    });

    return { players: frozenPlayers, ...recalcResult };
};
