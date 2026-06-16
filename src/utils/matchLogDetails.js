import { getApprovedCommentators } from './tournamentCommentators';
import {
    extractTwitchLogin,
    getTwitchVideosUrl,
    isTwitchRecordingUrl,
    normalizeTwitchRecordingWatchUrl
} from './twitchUtils';

const RECORDING_URL_KEYS = ['twitchVodUrl', 'recordingUrl', 'vodUrl', 'streamUrl', 'twitchUrl', 'videoUrl'];

export const namesMatch = (left, right) =>
    String(left || '')
        .trim()
        .toLowerCase() ===
    String(right || '')
        .trim()
        .toLowerCase();

export const formatMatchLogDate = (value) => {
    if (!value) {
        return 'Unknown date';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

export const normalizeMatchLogGame = (raw = {}, id = '') => ({
    id,
    date: raw.date || null,
    gameName: raw.gameName || null,
    gameType: raw.gameType || null,
    tournamentName: raw.tournamentName || null,
    tournamentId: raw.tournamentId || null,
    stage: raw.stage || null,
    stageIndex: raw.stageIndex ?? null,
    pairIndex: raw.pairIndex ?? null,
    opponent1: raw.opponent1 || '',
    opponent1Castle: raw.opponent1Castle || '',
    opponent2: raw.opponent2 || '',
    opponent2Castle: raw.opponent2Castle || '',
    score: raw.score || '',
    winner: raw.winner || '',
    matchKey: raw.matchKey || id,
    streamUrl: raw.streamUrl || null,
    streamLogin: raw.streamLogin || null,
    twitchRecording: raw.twitchRecording || null,
    games: Array.isArray(raw.games) ? raw.games : []
});

const collectRecordingUrls = (source, bucket = []) => {
    if (!source || typeof source !== 'object') {
        return bucket;
    }

    RECORDING_URL_KEYS.forEach((key) => {
        const value = source[key];
        if (typeof value === 'string' && value.trim()) {
            bucket.push(value.trim());
        }
    });

    return bucket;
};

export const findBracketMatchForGame = (tournamentsData, game) => {
    if (!tournamentsData || !game) {
        return null;
    }

    const tournamentEntries =
        game.tournamentId && tournamentsData[game.tournamentId]
            ? [[game.tournamentId, tournamentsData[game.tournamentId]]]
            : Object.entries(tournamentsData).filter(([, tournament]) =>
                  namesMatch(tournament?.name, game.tournamentName)
              );

    for (const [tournamentId, tournament] of tournamentEntries) {
        const stages = tournament?.bracket?.playoffPairs;
        if (!Array.isArray(stages)) {
            continue;
        }

        if (game.stageIndex != null && game.pairIndex != null) {
            const pair = stages[game.stageIndex]?.[game.pairIndex];
            if (pair) {
                return {
                    tournamentId,
                    tournament,
                    stageIndex: game.stageIndex,
                    pairIndex: game.pairIndex,
                    pair,
                    stageLabel: game.stage || pair.stage || null
                };
            }
        }

        for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
            const stage = stages[stageIndex];
            if (!Array.isArray(stage)) {
                continue;
            }

            for (let pairIndex = 0; pairIndex < stage.length; pairIndex += 1) {
                const pair = stage[pairIndex];
                const matched =
                    (namesMatch(pair.team1, game.opponent1) && namesMatch(pair.team2, game.opponent2)) ||
                    (namesMatch(pair.team1, game.opponent2) && namesMatch(pair.team2, game.opponent1));

                if (matched) {
                    return {
                        tournamentId,
                        tournament,
                        stageIndex,
                        pairIndex,
                        pair,
                        stageLabel: pair.stage || game.stage || null
                    };
                }
            }
        }
    }

    return null;
};

export const resolveMatchLogRecordingLinks = (game, bracketContext = null, usersData = {}) => {
    const links = [];
    const seen = new Set();

    const addLink = (label, url) => {
        const normalized = normalizeTwitchRecordingWatchUrl(url);
        if (!normalized || seen.has(normalized)) {
            return;
        }

        seen.add(normalized);
        links.push({
            label,
            url: normalized,
            isRecording: isTwitchRecordingUrl(normalized)
        });
    };

    collectRecordingUrls(game).forEach((url) => addLink('Twitch recording', url));

    if (game.twitchRecording) {
        addLink('Twitch recording', game.twitchRecording);
    }

    (game.games || []).forEach((mapGame, index) => {
        collectRecordingUrls(mapGame).forEach((url) => addLink(`Map ${index + 1} recording`, url));
    });

    const pair = bracketContext?.pair;
    if (pair) {
        collectRecordingUrls(pair).forEach((url) => addLink('Match stream recording', url));
    }

    const logins = new Set();
    const registerLogin = (value) => {
        const login = extractTwitchLogin(value);
        if (login) {
            logins.add(login);
        }
    };

    registerLogin(game.streamUrl);
    registerLogin(game.streamLogin);
    if (pair) {
        registerLogin(pair.streamUrl);
        registerLogin(pair.streamLogin);
    }

    [game.opponent1, game.opponent2].forEach((nickname) => {
        const user = Object.values(usersData || {}).find((entry) => namesMatch(entry?.enteredNickname, nickname));
        registerLogin(user?.twitch);
        registerLogin(user?.twitchDisplayName);
    });

    getApprovedCommentators(bracketContext?.tournament).forEach((commentator) => {
        registerLogin(commentator.twitchLogin);
    });

    logins.forEach((login) => {
        addLink(`Twitch VODs @${login}`, getTwitchVideosUrl(login));
    });

    return links;
};

export const buildMatchLogMapRows = (game) => {
    const maps = Array.isArray(game.games) ? game.games : [];

    if (maps.length === 0) {
        return [
            {
                label: 'Map 1',
                castle1: game.opponent1Castle,
                castle2: game.opponent2Castle,
                winner: game.winner,
                gold1: null,
                gold2: null,
                restarts: null
            }
        ];
    }

    return maps.map((mapGame, index) => {
        const restarts =
            mapGame.restart1_111 || mapGame.restart1_112 || mapGame.restart2_111 || mapGame.restart2_112
                ? `${mapGame.restart1_111 || 0}/${mapGame.restart1_112 || 0} · ${mapGame.restart2_111 || 0}/${mapGame.restart2_112 || 0}`
                : null;

        return {
            label: `Map ${(mapGame.gameId ?? index) + 1}`,
            castle1: mapGame.castle1 || '',
            castle2: mapGame.castle2 || '',
            winner: mapGame.gameWinner || mapGame.winner || '',
            gold1: mapGame.gold1 ?? null,
            gold2: mapGame.gold2 ?? null,
            restarts
        };
    });
};
