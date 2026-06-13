import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { isPublicTournament } from './tournamentVisibility';
import { buildCountryLookup, lookupCountryCode } from './country';
import { extractTwitchLogin } from './twitchUtils';
import { getActiveCommentatorLogins } from './tournamentCommentators';
import { buildMatchStageLabel } from './matchFixtureLabels';

const parseNumericValue = (value) => {
    if (typeof value === 'string' && value.includes(',')) {
        return Number(value.split(',').at(-1).trim()) || 0;
    }
    return Number(value) || 0;
};

const buildUserLookups = (usersData = {}) => {
    const avatarByNickname = {};
    const countryLookup = buildCountryLookup(usersData);
    const rankByNickname = {};
    const twitchByNickname = {};

    const getLatestRating = (user) => {
        const rating = user.ratings;
        if (typeof rating === 'string' && rating.includes(',')) {
            return parseFloat(rating.split(',').at(-1)) || 0;
        }
        return parseFloat(rating) || 0;
    };

    const sortedUsers = Object.values(usersData)
        .filter((user) => user && user.ratings !== undefined)
        .sort((a, b) => getLatestRating(b) - getLatestRating(a));

    sortedUsers.forEach((user, index) => {
        if (user?.enteredNickname) {
            rankByNickname[user.enteredNickname] = index + 1;
        }
    });

    Object.values(usersData).forEach((user) => {
        if (!user?.enteredNickname) {
            return;
        }

        avatarByNickname[user.enteredNickname] = user.avatar || user.profileImageUrl || null;
        twitchByNickname[user.enteredNickname] =
            extractTwitchLogin(user.twitch) || extractTwitchLogin(user.twitchDisplayName);
    });

    return { avatarByNickname, countryLookup, rankByNickname, twitchByNickname };
};

export const isMapLiveGame = (game) => Boolean(game?.castle1 && game?.castle2 && !game?.castleWinner);

export const isGameSessionActive = (game) => {
    if (!game || game.castleWinner) {
        return false;
    }

    if (isMapLiveGame(game)) {
        return true;
    }

    const status = String(game.gameStatus || '').trim();
    if (status === 'In Progress') {
        return true;
    }

    return Boolean(
        game.restartsFinished === false ||
        game.restart1_111 ||
        game.restart1_112 ||
        game.restart2_111 ||
        game.restart2_112 ||
        game.gold1 ||
        game.gold2
    );
};

export const parseScheduledAtMs = (iso) => {
    if (!iso) {
        return null;
    }

    const time = new Date(iso).getTime();
    return Number.isNaN(time) ? null : time;
};

export const hasScheduledAt = (pair) => parseScheduledAtMs(pair?.scheduledAt) != null;

/** Match is live when schedule time has passed, a map is in progress, or restarts have started. */
export const isScheduledTimeReached = (pair, nowMs = Date.now()) => {
    const scheduledMs = parseScheduledAtMs(pair?.scheduledAt);
    return scheduledMs != null && scheduledMs <= nowMs;
};

export const isPairLive = (pair, nowMs = Date.now()) =>
    (pair?.games || []).some(isGameSessionActive) || isScheduledTimeReached(pair, nowMs);

const enrichPair = (pair, context) => {
    const {
        tournamentId,
        tournament,
        stageIndex,
        pairIndex,
        avatarByNickname,
        countryLookup,
        twitchByNickname,
        commentatorStreamLogin = null
    } = context;

    const tournamentPlayers = Object.values(tournament?.players || {}).filter(Boolean);
    const team1Player = tournamentPlayers.find((player) => player.name === pair.team1);
    const team2Player = tournamentPlayers.find((player) => player.name === pair.team2);

    const bestOf = pair.type === 'bo-5' ? 5 : pair.type === 'bo-3' ? 3 : 1;
    const reqWins = Math.floor(bestOf / 2) + 1;
    const ps1 = Number(pair.score1) || 0;
    const ps2 = Number(pair.score2) || 0;
    const seriesDone = ps1 >= reqWins || ps2 >= reqWins || pair.winner || pair.gameStatus === 'Processed';
    const team1Ready = pair.team1 && pair.team1 !== 'TBD' && pair.team1 !== 'null';
    const team2Ready = pair.team2 && pair.team2 !== 'TBD' && pair.team2 !== 'null';

    const team1TwitchLogin =
        extractTwitchLogin(pair.streamLogin) ||
        twitchByNickname[pair.team1] ||
        extractTwitchLogin(team1Player?.twitch);
    const team2TwitchLogin = twitchByNickname[pair.team2] || extractTwitchLogin(team2Player?.twitch);
    const streamLogin =
        extractTwitchLogin(commentatorStreamLogin) ||
        extractTwitchLogin(pair.streamUrl) ||
        team1TwitchLogin ||
        team2TwitchLogin;
    const team1Stars = parseNumericValue(pair.stars1 ?? team1Player?.stars);
    const team2Stars = parseNumericValue(pair.stars2 ?? team2Player?.stars);
    const stageLabel = buildMatchStageLabel(tournament, pair, stageIndex);

    let liveGame = null;
    const activeGame = (pair.games || []).find(isGameSessionActive) || null;
    const pairIsLive = isPairLive(pair);

    if (pairIsLive && !seriesDone && team1Ready && team2Ready) {
        const game = activeGame;

        liveGame = {
            tournamentId,
            tournamentName: tournament.name,
            tournamentType: tournament.type || null,
            tournamentDate: tournament.date || null,
            stageLabel,
            team1: pair.team1,
            team2: pair.team2,
            team1Avatar: avatarByNickname[pair.team1] || null,
            team2Avatar: avatarByNickname[pair.team2] || null,
            team1CountryCode: lookupCountryCode(pair.team1, countryLookup, team1Player),
            team2CountryCode: lookupCountryCode(pair.team2, countryLookup, team2Player),
            score1: pair.score1 || 0,
            score2: pair.score2 || 0,
            type: pair.type,
            stageIndex,
            pairIndex,
            castle1: game?.castle1 || null,
            castle2: game?.castle2 || null,
            gameNumber: game ? (game.gameId || 0) + 1 : ps1 + ps2 + 1,
            team1TwitchLogin,
            team2TwitchLogin,
            streamLogin,
            commentatorStreamLogin,
            team1Stars,
            team2Stars,
            scheduledAt: pair.scheduledAt || null,
            variant: 'live',
            statusLabel: 'Live'
        };
    }

    const upcoming =
        !seriesDone && team1Ready && team2Ready && !pairIsLive && hasScheduledAt(pair)
            ? {
                  tournamentId,
                  tournamentName: tournament.name,
                  tournamentType: tournament.type || null,
                  tournamentDate: pair.scheduledAt || null,
                  stageLabel,
                  team1: pair.team1,
                  team2: pair.team2,
                  team1Avatar: avatarByNickname[pair.team1] || null,
                  team2Avatar: avatarByNickname[pair.team2] || null,
                  team1CountryCode: lookupCountryCode(pair.team1, countryLookup, team1Player),
                  team2CountryCode: lookupCountryCode(pair.team2, countryLookup, team2Player),
                  score1: ps1,
                  score2: ps2,
                  scheduledAt: pair.scheduledAt || null,
                  type: pair.type,
                  stageIndex,
                  pairIndex,
                  team1TwitchLogin,
                  team2TwitchLogin,
                  streamLogin,
                  commentatorStreamLogin,
                  team1Stars,
                  team2Stars,
                  statusLabel: ps1 + ps2 > 0 ? 'Next map' : 'Upcoming',
                  variant: 'upcoming'
              }
            : null;

    return { liveGame, upcoming };
};

export const fetchMatchCenterMatches = async () => {
    const [tournamentsResponse, usersResponse] = await Promise.all([
        fetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3.json`),
        fetch(`${FIREBASE_DATABASE_URL}/users.json`)
    ]);

    const tournamentsData = tournamentsResponse.ok ? await tournamentsResponse.json() : null;
    const usersData = usersResponse.ok ? await usersResponse.json() : {};

    if (!tournamentsData) {
        return { liveGames: [], upcomingMatches: [] };
    }

    const { avatarByNickname, countryLookup, twitchByNickname } = buildUserLookups(usersData);
    const liveGames = [];
    const upcomingMatches = [];

    Object.entries(tournamentsData).forEach(([tournamentId, tournament]) => {
        if (
            !tournament ||
            !isPublicTournament(tournament) ||
            tournament.status !== 'Started!' ||
            !tournament.bracket?.playoffPairs
        ) {
            return;
        }

        tournament.bracket.playoffPairs.forEach((stage, stageIndex) => {
            if (!Array.isArray(stage)) {
                return;
            }

            const commentatorStreamLogin = getActiveCommentatorLogins(tournament)[0] || null;

            stage.forEach((pair, pairIndex) => {
                const { liveGame, upcoming } = enrichPair(pair, {
                    tournamentId,
                    tournament,
                    stageIndex,
                    pairIndex,
                    avatarByNickname,
                    countryLookup,
                    twitchByNickname,
                    commentatorStreamLogin
                });

                if (liveGame) {
                    liveGames.push(liveGame);
                }
                if (upcoming) {
                    upcomingMatches.push(upcoming);
                }
            });
        });
    });

    upcomingMatches.sort((a, b) => {
        const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
    });

    return { liveGames, upcomingMatches };
};

export const fetchMatchCenterMatch = async (tournamentId, stageIndex, pairIndex) => {
    const stageIdx = Number(stageIndex) || 0;
    const pairIdx = Number(pairIndex) || 0;

    const [tournamentsResponse, usersResponse] = await Promise.all([
        fetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3.json`),
        fetch(`${FIREBASE_DATABASE_URL}/users.json`)
    ]);

    if (!tournamentsResponse.ok) {
        return null;
    }

    const tournamentsData = await tournamentsResponse.json();
    const usersData = usersResponse.ok ? await usersResponse.json() : {};
    const tournament = tournamentsData?.[tournamentId];

    if (!tournament || !isPublicTournament(tournament) || !tournament.bracket?.playoffPairs) {
        return null;
    }

    const stage = tournament.bracket.playoffPairs[stageIdx];
    const pair = Array.isArray(stage) ? stage[pairIdx] : null;

    if (!pair) {
        return null;
    }

    const { avatarByNickname, countryLookup, twitchByNickname } = buildUserLookups(usersData);
    const commentatorStreamLogin = getActiveCommentatorLogins(tournament)[0] || null;
    const context = {
        tournamentId,
        tournament,
        stageIndex: stageIdx,
        pairIndex: pairIdx,
        avatarByNickname,
        countryLookup,
        twitchByNickname,
        commentatorStreamLogin
    };

    const { liveGame, upcoming } = enrichPair(pair, context);
    let match = liveGame || upcoming;

    if (!match) {
        const tournamentPlayers = Object.values(tournament?.players || {}).filter(Boolean);
        const team1Player = tournamentPlayers.find((player) => player.name === pair.team1);
        const team2Player = tournamentPlayers.find((player) => player.name === pair.team2);
        const team1TwitchLogin =
            extractTwitchLogin(pair.streamLogin) ||
            twitchByNickname[pair.team1] ||
            extractTwitchLogin(team1Player?.twitch);
        const team2TwitchLogin = twitchByNickname[pair.team2] || extractTwitchLogin(team2Player?.twitch);

        match = {
            tournamentId,
            tournamentName: tournament.name,
            tournamentType: tournament.type || null,
            tournamentDate: pair.scheduledAt || null,
            stageLabel: buildMatchStageLabel(tournament, pair, stageIdx),
            team1: pair.team1,
            team2: pair.team2,
            team1Avatar: avatarByNickname[pair.team1] || null,
            team2Avatar: avatarByNickname[pair.team2] || null,
            team1CountryCode: lookupCountryCode(pair.team1, countryLookup, team1Player),
            team2CountryCode: lookupCountryCode(pair.team2, countryLookup, team2Player),
            score1: Number(pair.score1) || 0,
            score2: Number(pair.score2) || 0,
            scheduledAt: pair.scheduledAt || null,
            type: pair.type,
            stageIndex: stageIdx,
            pairIndex: pairIdx,
            team1TwitchLogin,
            team2TwitchLogin,
            streamLogin:
                extractTwitchLogin(commentatorStreamLogin) ||
                extractTwitchLogin(pair.streamUrl) ||
                team1TwitchLogin ||
                team2TwitchLogin,
            commentatorStreamLogin,
            team1Stars: parseNumericValue(pair.stars1 ?? team1Player?.stars),
            team2Stars: parseNumericValue(pair.stars2 ?? team2Player?.stars),
            variant: 'upcoming',
            statusLabel: 'Match'
        };
    }

    return { match, tournament };
};

export { parseNumericValue };
