import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { HOTA_FACTIONS } from '../api/hotaMeta';

const CASTLE_CANONICAL = [
    'Castle',
    'Rampart',
    'Tower',
    'Inferno',
    'Necropolis',
    'Dungeon',
    'Stronghold',
    'Fortress',
    'Conflux',
    'Cove',
    'Factory',
    'Kronverk'
];

/** English castle name before bilingual "Castle-Замок" suffix; Bulwark → Kronverk. */
export const normalizeCastleName = (raw) => {
    if (raw == null || raw === '') {
        return null;
    }
    const english = String(raw).split('-')[0].trim();
    if (!english) {
        return null;
    }
    const lower = english.toLowerCase();
    if (lower === 'bulwark') {
        return 'Kronverk';
    }
    const match = CASTLE_CANONICAL.find((name) => name.toLowerCase() === lower);
    return match || english;
};

const flattenPairs = (pairsOrStages) => {
    if (!Array.isArray(pairsOrStages)) {
        return [];
    }
    if (pairsOrStages.length === 0) {
        return [];
    }
    // Stages: [[pair, pair], [pair]] vs flat: [pair, pair]
    if (Array.isArray(pairsOrStages[0])) {
        return pairsOrStages.flat().filter(Boolean);
    }
    return pairsOrStages.filter(Boolean);
};

const gameDedupeKey = (game) => {
    const gameId = game.gameId ?? '';
    const c1 = normalizeCastleName(game.castle1) || '';
    const c2 = normalizeCastleName(game.castle2) || '';
    const winner = String(game.gameWinner || game.castleWinner || '')
        .trim()
        .toLowerCase();
    return `${gameId}:${c1}:${c2}:${winner}:${game.gold1 ?? ''}:${game.gold2 ?? ''}`;
};

const resolveWinningCastle = (game, team1, team2) => {
    if (game.castleWinner) {
        return normalizeCastleName(game.castleWinner);
    }
    const winner = game.gameWinner;
    if (!winner || winner === 'draw') {
        return null;
    }
    if (team1 && winner === team1) {
        return normalizeCastleName(game.castle1);
    }
    if (team2 && winner === team2) {
        return normalizeCastleName(game.castle2);
    }
    // gameWinner sometimes stores the castle string
    const asCastle = normalizeCastleName(winner);
    if (asCastle) {
        const c1 = normalizeCastleName(game.castle1);
        const c2 = normalizeCastleName(game.castle2);
        if (asCastle === c1 || asCastle === c2) {
            return asCastle;
        }
    }
    return null;
};

const isCountableGame = (game) => {
    if (!game?.castle1 || !game?.castle2) {
        return false;
    }
    if (!game.gameWinner || game.gameWinner === 'draw') {
        return false;
    }
    return true;
};

/** Extract countable map games from bracket pairs (flat or staged). */
export const collectGamesFromPairs = (pairsOrStages) => {
    const pairs = flattenPairs(pairsOrStages);
    const collected = [];

    pairs.forEach((pair) => {
        const games = Array.isArray(pair.games) ? pair.games : [];
        games.forEach((game) => {
            if (!isCountableGame(game)) {
                return;
            }
            collected.push({
                ...game,
                team1: pair.team1,
                team2: pair.team2,
                _source: 'bracket'
            });
        });
    });

    return collected;
};

/** Extract countable map games from /games/heroes3 records for one tournament. */
export const collectGamesFromGameLog = (gamesById, tournamentId) => {
    if (!gamesById || !tournamentId) {
        return [];
    }

    const collected = [];
    Object.values(gamesById).forEach((match) => {
        if (!match || String(match.tournamentId) !== String(tournamentId)) {
            return;
        }
        const games = Array.isArray(match.games) ? match.games : [];
        games.forEach((game) => {
            if (!isCountableGame(game)) {
                return;
            }
            collected.push({
                ...game,
                team1: match.opponent1 || match.team1,
                team2: match.opponent2 || match.team2,
                _source: 'gameLog'
            });
        });
    });

    return collected;
};

export const mergeTournamentGames = (...lists) => {
    const byKey = new Map();
    lists.flat().forEach((game) => {
        if (!game) {
            return;
        }
        const key = gameDedupeKey(game);
        if (!byKey.has(key)) {
            byKey.set(key, game);
        }
    });
    return [...byKey.values()];
};

export const aggregateCastleStats = (games = []) => {
    const byCastle = {};
    const list = Array.isArray(games) ? games : [];

    list.forEach((game) => {
        if (!game) {
            return;
        }
        const c1 = normalizeCastleName(game.castle1);
        const c2 = normalizeCastleName(game.castle2);
        const winner = resolveWinningCastle(game, game.team1, game.team2);
        if (!c1 || !c2 || !winner || c1 === c2) {
            return;
        }

        [c1, c2].forEach((name) => {
            if (!byCastle[name]) {
                byCastle[name] = { name, win: 0, lose: 0, total: 0 };
            }
        });

        byCastle[c1].total += 1;
        byCastle[c2].total += 1;

        if (winner === c1) {
            byCastle[c1].win += 1;
            byCastle[c2].lose += 1;
        } else if (winner === c2) {
            byCastle[c2].win += 1;
            byCastle[c1].lose += 1;
        }
    });

    return Object.values(byCastle)
        .map((row) => ({
            ...row,
            winRate: row.total > 0 ? (row.win / row.total) * 100 : 0
        }))
        .sort((a, b) => b.winRate - a.winRate || b.total - a.total || a.name.localeCompare(b.name));
};

export const mergeWithHotaFactions = (castleRows, hotaFactions) => {
    const hotaByKonoplay = new Map();
    (hotaFactions || []).forEach((faction) => {
        const hotaName = faction.faction_name || faction.name;
        const mapping = HOTA_FACTIONS.find(
            (entry) => entry.name === hotaName || entry.konoplayName === hotaName
        );
        const key = mapping?.konoplayName || normalizeCastleName(hotaName);
        if (key) {
            hotaByKonoplay.set(key, faction);
        }
    });

    return (castleRows || []).map((row) => {
        const hota = hotaByKonoplay.get(row.name);
        const hotaWinRate =
            hota?.winrate != null && Number.isFinite(Number(hota.winrate)) ? Number(hota.winrate) : null;
        const delta = hotaWinRate != null ? row.winRate - hotaWinRate : null;
        return {
            ...row,
            hotaWinRate,
            hotaGames: hota?.games ?? null,
            hotaPickRate: hota?.pick_rate ?? null,
            delta
        };
    });
};

export const fetchTournamentGameLog = async (tournamentId) => {
    if (!tournamentId) {
        return [];
    }
    const response = await fetch(`${FIREBASE_DATABASE_URL}/games/heroes3.json`);
    if (!response.ok) {
        throw new Error('Failed to load tournament game log');
    }
    const data = await response.json();
    return collectGamesFromGameLog(data || {}, tournamentId);
};

export const buildTournamentMetaRows = ({ pairs, gameLogGames, hotaFactions }) => {
    const fromBracket = collectGamesFromPairs(pairs);
    const merged = mergeTournamentGames(fromBracket, gameLogGames || []);
    const aggregated = aggregateCastleStats(merged);
    const rows = mergeWithHotaFactions(aggregated, hotaFactions);
    return {
        rows,
        gameCount: merged.length,
        castleCount: rows.length
    };
};
