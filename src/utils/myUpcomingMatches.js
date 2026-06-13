import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { buildCountryLookup, lookupCountryCode } from './country';
import { isPublicTournament } from './tournamentVisibility';

const parseNumericValue = (value) => {
    if (typeof value === 'string' && value.includes(',')) {
        return Number(value.split(',').at(-1).trim()) || 0;
    }
    return Number(value) || 0;
};

const buildRankByNickname = (usersData = {}) => {
    const getLatestRating = (user) => {
        const ratings = user.ratings;
        if (typeof ratings === 'string' && ratings.includes(',')) {
            return parseFloat(ratings.split(',').at(-1)) || 0;
        }
        return parseFloat(ratings) || 0;
    };

    const rankByNickname = {};
    Object.values(usersData)
        .filter((user) => user && user.ratings !== undefined)
        .sort((a, b) => getLatestRating(b) - getLatestRating(a))
        .forEach((user, index) => {
            if (user.enteredNickname) {
                rankByNickname[user.enteredNickname] = index + 1;
            }
        });

    return rankByNickname;
};

const buildAvatarByNickname = (usersData = {}) => {
    const avatarByNickname = {};
    Object.values(usersData).forEach((user) => {
        if (user?.enteredNickname) {
            avatarByNickname[user.enteredNickname] = user.avatar || null;
        }
    });
    return avatarByNickname;
};

export const collectMyUpcomingMatches = (
    tournamentsData,
    playerName,
    { avatarByNickname = {}, countryLookup = {}, rankByNickname = {} } = {}
) => {
    const normalizedPlayer = String(playerName || '').trim();
    if (!normalizedPlayer || !tournamentsData) {
        return [];
    }

    const matches = [];

    Object.keys(tournamentsData).forEach((tournamentId) => {
        const tournament = tournamentsData[tournamentId];
        if (
            !tournament ||
            !isPublicTournament(tournament) ||
            tournament.status !== 'Started!' ||
            !tournament.bracket?.playoffPairs
        ) {
            return;
        }

        const tournamentPlayers = Object.values(tournament.players || {}).filter(Boolean);

        tournament.bracket.playoffPairs.forEach((stage, stageIndex) => {
            if (!Array.isArray(stage)) {
                return;
            }

            stage.forEach((pair, pairIndex) => {
                const isMyPair = pair.team1 === normalizedPlayer || pair.team2 === normalizedPlayer;
                if (!isMyPair) {
                    return;
                }

                const bestOf = pair.type === 'bo-5' ? 5 : pair.type === 'bo-3' ? 3 : 1;
                const winThreshold = Math.floor(bestOf / 2) + 1;
                const score1 = Number(pair.score1) || 0;
                const score2 = Number(pair.score2) || 0;
                if (score1 >= winThreshold || score2 >= winThreshold || pair.winner) {
                    return;
                }

                const team1Player = tournamentPlayers.find((player) => player.name === pair.team1);
                const team2Player = tournamentPlayers.find((player) => player.name === pair.team2);
                const liveGame = (pair.games || []).find(
                    (game) => game.castle1 && game.castle2 && !game.castleWinner
                );
                const isLive = Boolean(liveGame);

                matches.push({
                    tournamentId,
                    tournamentName: tournament.name,
                    stageLabel: pair.stage || `Stage ${stageIndex + 1}`,
                    stageIndex,
                    pairIndex,
                    scheduledAt: pair.scheduledAt || null,
                    tournamentDate: pair.scheduledAt || tournament.date || null,
                    team1: pair.team1,
                    team2: pair.team2,
                    team1Avatar: avatarByNickname[pair.team1] || null,
                    team2Avatar: avatarByNickname[pair.team2] || null,
                    team1CountryCode: lookupCountryCode(pair.team1, countryLookup, team1Player),
                    team2CountryCode: lookupCountryCode(pair.team2, countryLookup, team2Player),
                    score1,
                    score2,
                    type: pair.type,
                    variant: isLive ? 'live' : 'upcoming',
                    statusLabel: isLive ? 'Live' : 'Upcoming',
                    team1Stars: parseNumericValue(pair.stars1 ?? team1Player?.stars),
                    team2Stars: parseNumericValue(pair.stars2 ?? team2Player?.stars),
                    team1Place: rankByNickname[pair.team1] || team1Player?.placeInLeaderboard || null,
                    team2Place: rankByNickname[pair.team2] || team2Player?.placeInLeaderboard || null,
                    castle1: liveGame?.castle1 || null,
                    castle2: liveGame?.castle2 || null,
                    gameNumber: liveGame ? (liveGame.gameId || 0) + 1 : null
                });
            });
        });
    });

    return matches.sort((a, b) => {
        if (a.variant === 'live' && b.variant !== 'live') {
            return -1;
        }
        if (a.variant !== 'live' && b.variant === 'live') {
            return 1;
        }
        const aTime = a.tournamentDate ? new Date(a.tournamentDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.tournamentDate ? new Date(b.tournamentDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
    });
};

export const fetchMyUpcomingMatches = async (
    playerName,
    firebaseUrl = FIREBASE_DATABASE_URL
) => {
    const normalizedPlayer = String(playerName || '').trim();
    if (!normalizedPlayer) {
        return [];
    }

    const [tournamentsResponse, usersResponse] = await Promise.all([
        fetch(`${firebaseUrl}/tournaments/heroes3.json`),
        fetch(`${firebaseUrl}/users.json`)
    ]);

    if (!tournamentsResponse.ok) {
        return [];
    }

    const tournamentsData = await tournamentsResponse.json();
    const usersData = usersResponse.ok ? await usersResponse.json() : {};

    return collectMyUpcomingMatches(tournamentsData, normalizedPlayer, {
        avatarByNickname: buildAvatarByNickname(usersData),
        countryLookup: buildCountryLookup(usersData),
        rankByNickname: buildRankByNickname(usersData)
    });
};
