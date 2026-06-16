import { fetchHotaPlayerByLobbyNickname } from '../api/hotaMeta';

export const HEAD_TO_HEAD_SOURCES = {
    HOTA: 'hota-meta',
    KONOPLAY: 'konoplay'
};

export const buildNicknameCandidates = (nickname) => {
    const trimmed = String(nickname || '').trim();
    if (!trimmed) {
        return [];
    }

    const candidates = [trimmed];
    const withoutDemo = trimmed.replace(/\s*\(demo\)\s*$/i, '').trim();
    if (withoutDemo && withoutDemo !== trimmed) {
        candidates.push(withoutDemo);
    }

    return [...new Set(candidates)];
};

export const findHotaOpponentRow = (profile, opponentName) => {
    const query = String(opponentName || '')
        .trim()
        .toLowerCase();
    if (!query || !profile?.opponents) {
        return null;
    }

    return profile.opponents.find((row) => row?.opp_name?.trim().toLowerCase() === query) || null;
};

export const resolveHotaHeadToHeadFromProfiles = (playerA, playerB, profileA, profileB) => {
    const rowFromA = findHotaOpponentRow(profileA, playerB);
    if (rowFromA?.games > 0) {
        return {
            total: rowFromA.games,
            wins: rowFromA.wins,
            losses: rowFromA.games - rowFromA.wins,
            winPercent: ((rowFromA.wins / rowFromA.games) * 100).toFixed(1)
        };
    }

    const rowFromB = findHotaOpponentRow(profileB, playerA);
    if (rowFromB?.games > 0) {
        const winsForB = rowFromB.wins;
        const winsForA = rowFromB.games - rowFromB.wins;
        return {
            total: rowFromB.games,
            wins: winsForA,
            losses: winsForB,
            winPercent: ((winsForA / rowFromB.games) * 100).toFixed(1)
        };
    }

    return null;
};

export const buildHotaLast5Games = (matches, playerA, playerB) => {
    const opponentQuery = String(playerB || '')
        .trim()
        .toLowerCase();

    return (matches || [])
        .filter((match) => {
            const opponent = match.side === 'p2' ? match.p1_name : match.p2_name;
            return opponent?.trim().toLowerCase() === opponentQuery;
        })
        .sort((a, b) => new Date(b.start_time_iso) - new Date(a.start_time_iso))
        .slice(0, 5)
        .map((match) => ({
            date: match.start_time_iso,
            opponent1: playerA,
            opponent2: playerB,
            score: match.result === 'win' ? '1:0' : '0:1',
            winner: match.result === 'win' ? playerA : playerB,
            id: null
        }));
};

const resolveHotaPlayerByNickname = async (nickname) => {
    for (const candidate of buildNicknameCandidates(nickname)) {
        try {
            const result = await fetchHotaPlayerByLobbyNickname(candidate);
            if (result.status === 'ok') {
                return result;
            }
        } catch (error) {
            console.warn(`HotA Meta lookup failed for ${candidate}:`, error);
        }
    }

    return null;
};

export const fetchHotaHeadToHead = async (playerA, playerB) => {
    const [resultA, resultB] = await Promise.all([
        resolveHotaPlayerByNickname(playerA),
        resolveHotaPlayerByNickname(playerB)
    ]);

    const summary = resolveHotaHeadToHeadFromProfiles(playerA, playerB, resultA?.profile, resultB?.profile);

    if (!summary) {
        return null;
    }

    const last5Games = resultA?.matches ? buildHotaLast5Games(resultA.matches, playerA, playerB) : [];

    return {
        ...summary,
        playerA,
        playerB,
        last5Games,
        source: HEAD_TO_HEAD_SOURCES.HOTA
    };
};

export const fetchKonoplayHeadToHead = async (playerA, playerB, { authFetch, firebaseUrl, playoffPairs = [] }) => {
    const response = await authFetch(`${firebaseUrl}/games.json`);
    const data = await response.json();

    const games = Object.entries(data.heroes3 || {})
        .filter(
            ([, game]) =>
                (game.opponent1 === playerA && game.opponent2 === playerB) ||
                (game.opponent1 === playerB && game.opponent2 === playerA)
        )
        .map(([id, game]) => ({ ...game, id }));

    const total = games.length;
    const wins = games.filter((g) => g.winner === playerA).length;
    const losses = games.filter((g) => g.winner === playerB).length;
    const winPercent = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';
    const last5Games = games.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    let restartCoeffA = 0;
    let restartCoeffB = 0;
    let team1GamesCount = 0;

    playoffPairs.forEach((stageGames) => {
        if (!Array.isArray(stageGames)) {
            return;
        }

        stageGames.forEach((pair) => {
            if (
                !(
                    (pair.team1 === playerA && pair.team2 === playerB) ||
                    (pair.team1 === playerB && pair.team2 === playerA)
                )
            ) {
                return;
            }

            if (!pair.games || !Array.isArray(pair.games)) {
                return;
            }

            pair.games.forEach((game) => {
                const isTeam1Side = pair.team1 === playerA;

                if (isTeam1Side) {
                    restartCoeffA += Math.min(
                        1.0 + (game.restart1_111 || 0) * 0.5 + (game.restart1_112 || 0) * 1.0,
                        2.0
                    );
                    restartCoeffB += Math.min(
                        1.0 + (game.restart2_111 || 0) * 0.5 + (game.restart2_112 || 0) * 1.0,
                        2.0
                    );
                } else {
                    restartCoeffA += Math.min(
                        1.0 + (game.restart2_111 || 0) * 0.5 + (game.restart2_112 || 0) * 1.0,
                        2.0
                    );
                    restartCoeffB += Math.min(
                        1.0 + (game.restart1_111 || 0) * 0.5 + (game.restart1_112 || 0) * 1.0,
                        2.0
                    );
                }

                team1GamesCount += 1;
            });
        });
    });

    if (team1GamesCount > 0) {
        restartCoeffA /= team1GamesCount;
        restartCoeffB /= team1GamesCount;
    }

    return {
        total,
        wins,
        losses,
        winPercent,
        playerA,
        playerB,
        last5Games,
        source: HEAD_TO_HEAD_SOURCES.KONOPLAY,
        ...(team1GamesCount > 0 ? { restartCoeffA, restartCoeffB } : {})
    };
};

export const fetchHeadToHeadStats = async (playerA, playerB, options) => {
    try {
        const hotaStats = await fetchHotaHeadToHead(playerA, playerB);
        if (hotaStats?.total > 0) {
            return hotaStats;
        }
    } catch (error) {
        console.warn('HotA Meta head-to-head lookup failed, falling back to Konoplay:', error);
    }

    return fetchKonoplayHeadToHead(playerA, playerB, options);
};

export const getHeadToHeadSourceLabel = (source) => (source === HEAD_TO_HEAD_SOURCES.HOTA ? 'HotA Meta' : 'Konoplay');
