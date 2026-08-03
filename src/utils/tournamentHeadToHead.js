import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { normalizeCastleName } from './tournamentMetaStats';

const buildNicknameCandidates = (nickname) => {
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

const nickMatches = (value, candidates) => {
    const name = String(value || '')
        .trim()
        .toLowerCase();
    if (!name) {
        return false;
    }
    return candidates.some((candidate) => candidate.trim().toLowerCase() === name);
};

/**
 * Wider than tournamentId-only: name, stage metadata, or nested cup maps.
 * Still excludes plain manual / lobby posts with none of those signals.
 */
export const isTournamentMatch = (match) => {
    if (!match) {
        return false;
    }
    if (String(match.tournamentId || '').trim()) {
        return true;
    }
    if (String(match.tournamentName || '').trim()) {
        return true;
    }
    // Legacy bracket posts: stage + nested maps, even if id/name missing
    if (
        (match.stage != null || match.stageIndex != null) &&
        Array.isArray(match.games) &&
        match.games.some((g) => g?.castle1 && g?.castle2)
    ) {
        return true;
    }
    return false;
};

const matchYear = (match) => {
    if (!match?.date) {
        return null;
    }
    const year = new Date(match.date).getFullYear();
    return Number.isFinite(year) ? year : null;
};

const loadJson = async (path, { authFetch, firebaseUrl } = {}) => {
    const base = firebaseUrl || FIREBASE_DATABASE_URL;
    const response = authFetch ? await authFetch(`${base}${path}`) : await fetch(`${base}${path}`);
    if (!response.ok) {
        throw new Error(`Failed to load ${path}`);
    }
    return (await response.json()) || {};
};

const loadHeroes3Games = async (options = {}) => loadJson('/games/heroes3.json', options);

const flattenBracketPairs = (pairsOrStages) => {
    if (!Array.isArray(pairsOrStages)) {
        return [];
    }
    if (pairsOrStages.length === 0) {
        return [];
    }
    if (Array.isArray(pairsOrStages[0])) {
        return pairsOrStages.flat().filter(Boolean);
    }
    return pairsOrStages.filter(Boolean);
};

const pairLooksFinished = (pair) => {
    if (!pair || pair.isBye || pair.team2 === 'BYE') {
        return false;
    }
    if (pair.winner && pair.winner !== 'TBD') {
        return true;
    }
    const games = Array.isArray(pair.games) ? pair.games : [];
    return games.some((g) => g?.gameWinner && g.gameWinner !== '' && g.castle1 && g.castle2);
};

/**
 * Turn live / stored brackets into match-shaped records so older cups
 * still feed H2H and signature castles even when /games/heroes3 omitted tournamentId.
 */
export const collectMatchesFromTournaments = (tournamentsById) => {
    const collected = [];

    Object.entries(tournamentsById || {}).forEach(([tournamentId, tournament]) => {
        if (!tournament || typeof tournament !== 'object') {
            return;
        }
        const pairs = flattenBracketPairs(tournament.bracket?.playoffPairs || tournament.playoffPairs);
        const tournamentName = tournament.name || tournament.tournamentName || null;

        pairs.forEach((pair, pairIndex) => {
            if (!pairLooksFinished(pair)) {
                return;
            }
            const games = Array.isArray(pair.games) ? pair.games : [];
            const score =
                pair.score1 != null && pair.score2 != null
                    ? `${pair.score1}-${pair.score2}`
                    : pair.score || null;

            collected.push({
                id: `bracket:${tournamentId}:${pair.stageIndex ?? 's'}:${pairIndex}:${pair.team1}:${pair.team2}`,
                opponent1: pair.team1,
                opponent2: pair.team2,
                winner: pair.winner && pair.winner !== 'TBD' ? pair.winner : null,
                score,
                date: pair.scheduledAt || pair.finishedAt || pair.reportedAt || null,
                tournamentId,
                tournamentName,
                stage: pair.stage || null,
                stageIndex: pair.stageIndex ?? null,
                games,
                opponent1Castle: games[0]?.castle1 || pair.castle1 || '',
                opponent2Castle: games[0]?.castle2 || pair.castle2 || '',
                _source: 'bracket'
            });
        });
    });

    return collected;
};

const normalizeScore = (score) =>
    String(score || '')
        .trim()
        .replace(/\s+/g, '')
        .replace(':', '-');

const normalizeNick = (value) =>
    String(value || '')
        .trim()
        .replace(/\s*\(demo\)\s*$/i, '')
        .trim()
        .toLowerCase();

const normalizeTournamentLabel = (match) => {
    const name = String(match?.tournamentName || '')
        .trim()
        .toLowerCase();
    if (name) {
        return name;
    }
    return String(match?.tournamentId || '')
        .trim()
        .toLowerCase();
};

/** Soft key so game-log (id) and bracket (name) rows for the same cup series collapse. */
const seriesDedupeKey = (match) => {
    const a = normalizeNick(match.opponent1);
    const b = normalizeNick(match.opponent2);
    const [left, right] = a < b ? [a, b] : [b, a];
    return [
        normalizeTournamentLabel(match),
        left,
        right,
        normalizeScore(match.score),
        normalizeNick(match.winner)
    ].join('|');
};

/** Players + score + winner only — catches same series when one side has id and the other has name. */
const seriesEncounterKey = (match) => {
    const a = normalizeNick(match.opponent1);
    const b = normalizeNick(match.opponent2);
    const [left, right] = a < b ? [a, b] : [b, a];
    return [left, right, normalizeScore(match.score), normalizeNick(match.winner)].join('|');
};

const matchRichness = (match) => {
    let score = 0;
    if (match?.date) {
        score += 4;
    }
    if (match?._source === 'gameLog') {
        score += 3;
    }
    if (match?.tournamentName) {
        score += 2;
    }
    if (match?.tournamentId) {
        score += 1;
    }
    if (Array.isArray(match?.games) && match.games.length) {
        score += 1;
    }
    return score;
};

const preferMatch = (existing, incoming) =>
    matchRichness(incoming) > matchRichness(existing) ? incoming : existing;

const mergeMatchSources = (gamesById, bracketMatches) => {
    const byKey = new Map();
    const encounterToKey = new Map();

    const upsert = (match) => {
        if (!match || !isTournamentMatch(match)) {
            return;
        }
        const softKey = seriesDedupeKey(match);
        const encounter = seriesEncounterKey(match);
        const existingKey = byKey.has(softKey)
            ? softKey
            : encounterToKey.has(encounter)
              ? encounterToKey.get(encounter)
              : softKey;
        const prev = byKey.get(existingKey);
        const next = prev ? preferMatch(prev, match) : match;
        if (prev && existingKey !== softKey) {
            byKey.delete(existingKey);
        }
        byKey.set(softKey, next);
        encounterToKey.set(encounter, softKey);
    };

    Object.entries(gamesById || {}).forEach(([id, match]) => {
        upsert({ ...match, id: match.id || id, _source: match._source || 'gameLog' });
    });

    (bracketMatches || []).forEach((match) => {
        upsert(match);
    });

    return [...byKey.values()];
};

const collectBansForPlayer = (match, playerCandidates, banCounts) => {
    const games = Array.isArray(match.games) ? match.games : [];
    const isOpp1 = nickMatches(match.opponent1, playerCandidates);

    games.forEach((game) => {
        const bans = isOpp1 ? game.bannedCastles1 || [] : game.bannedCastles2 || [];
        (Array.isArray(bans) ? bans : []).forEach((raw) => {
            const castle = normalizeCastleName(raw);
            if (!castle) {
                return;
            }
            banCounts[castle] = (banCounts[castle] || 0) + 1;
        });
    });
};

const topBanEntries = (banCounts, limit = 3) =>
    Object.entries(banCounts)
        .map(([castle, count]) => ({ castle, count }))
        .sort((a, b) => b.count - a.count || a.castle.localeCompare(b.castle))
        .slice(0, limit);

const filterSeriesForYear = (series, year) => {
    if (year == null) {
        return series;
    }
    return series.filter((entry) => entry.year === year);
};

const mapOutcomeDedupeKey = (match, subGame, isOpp1) => {
    const castle = normalizeCastleName(isOpp1 ? subGame?.castle1 : subGame?.castle2) || '';
    const winner = String(subGame?.gameWinner || '')
        .trim()
        .toLowerCase();
    return [
        String(match.tournamentId || match.tournamentName || '').trim().toLowerCase(),
        String(match.opponent1 || '')
            .trim()
            .toLowerCase(),
        String(match.opponent2 || '')
            .trim()
            .toLowerCase(),
        subGame?.gameId ?? '',
        castle,
        winner,
        subGame?.gold1 ?? '',
        subGame?.gold2 ?? ''
    ].join('|');
};

/**
 * Tournament-only head-to-head: series records, year slice, ban patterns.
 * `matches` should already be merged game-log + bracket cup matches.
 */
export const buildTournamentHeadToHeadFromMatches = (matches, playerA, playerB, { year = null } = {}) => {
    const candidatesA = buildNicknameCandidates(playerA);
    const candidatesB = buildNicknameCandidates(playerB);
    if (!candidatesA.length || !candidatesB.length) {
        return null;
    }

    const series = [];
    const bansA = {};
    const bansB = {};

    (matches || []).forEach((match) => {
        if (!isTournamentMatch(match)) {
            return;
        }
        const aIs1 = nickMatches(match.opponent1, candidatesA) && nickMatches(match.opponent2, candidatesB);
        const aIs2 = nickMatches(match.opponent1, candidatesB) && nickMatches(match.opponent2, candidatesA);
        if (!aIs1 && !aIs2) {
            return;
        }

        const winner = match.winner;
        let seriesWinner = null;
        if (winner && winner !== 'draw') {
            if (nickMatches(winner, candidatesA)) {
                seriesWinner = playerA;
            } else if (nickMatches(winner, candidatesB)) {
                seriesWinner = playerB;
            }
        }

        series.push({
            id: match.id,
            date: match.date || null,
            year: matchYear(match),
            tournamentId: match.tournamentId || null,
            tournamentName: match.tournamentName || null,
            score: match.score || null,
            winner: seriesWinner,
            opponent1: match.opponent1,
            opponent2: match.opponent2
        });

        collectBansForPlayer(match, candidatesA, bansA);
        collectBansForPlayer(match, candidatesB, bansB);
    });

    series.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    // Extra pass: collapse any near-duplicates that survived source merge
    const uniqueSeries = [];
    const seenSeries = new Set();
    const seenEncounters = new Set();
    series.forEach((entry) => {
        const payload = {
            opponent1: entry.opponent1,
            opponent2: entry.opponent2,
            tournamentId: entry.tournamentId,
            tournamentName: entry.tournamentName,
            score: entry.score,
            winner: entry.winner
        };
        const key = seriesDedupeKey(payload);
        const encounter = seriesEncounterKey(payload);
        if (seenSeries.has(key) || seenEncounters.has(encounter)) {
            return;
        }
        seenSeries.add(key);
        seenEncounters.add(encounter);
        uniqueSeries.push(entry);
    });
    series.length = 0;
    series.push(...uniqueSeries);

    const activeYear = year != null ? year : new Date().getFullYear();
    const yearSeries = filterSeriesForYear(series, activeYear);
    const decided = (list) => list.filter((entry) => entry.winner === playerA || entry.winner === playerB);

    const summarize = (list) => {
        const finished = decided(list);
        const wins = finished.filter((entry) => entry.winner === playerA).length;
        const losses = finished.filter((entry) => entry.winner === playerB).length;
        const draws = list.length - finished.length;
        return {
            seriesTotal: list.length,
            seriesWins: wins,
            seriesLosses: losses,
            seriesDraws: draws,
            seriesScore: `${wins}–${losses}`
        };
    };

    const allSummary = summarize(series);
    const yearSummary = summarize(yearSeries);

    if (allSummary.seriesTotal === 0) {
        return {
            playerA,
            playerB,
            year: activeYear,
            all: allSummary,
            thisYear: yearSummary,
            recentSeries: [],
            bansA: [],
            bansB: [],
            banInsightA: null,
            banInsightB: null
        };
    }

    const bansATop = topBanEntries(bansA);
    const bansBTop = topBanEntries(bansB);

    return {
        playerA,
        playerB,
        year: activeYear,
        all: allSummary,
        thisYear: yearSummary,
        recentSeries: series.slice(0, 5),
        bansA: bansATop,
        bansB: bansBTop,
        banInsightA: bansATop[0]
            ? `${playerA} most often bans ${bansATop[0].castle} vs ${playerB} (${bansATop[0].count}×)`
            : null,
        banInsightB: bansBTop[0]
            ? `${playerB} most often bans ${bansBTop[0].castle} vs ${playerA} (${bansBTop[0].count}×)`
            : null
    };
};

/** @deprecated Prefer buildTournamentHeadToHeadFromMatches with merged sources. */
export const buildTournamentHeadToHead = (gamesById, playerA, playerB, options = {}) => {
    const matches = mergeMatchSources(gamesById, []);
    return buildTournamentHeadToHeadFromMatches(matches, playerA, playerB, options);
};

export const fetchTournamentHeadToHead = async (playerA, playerB, options = {}) => {
    const [gamesById, tournamentsById] = await Promise.all([
        loadHeroes3Games(options),
        loadJson('/tournaments/heroes3.json', options).catch((error) => {
            console.warn('Tournament bracket supplement failed:', error);
            return {};
        })
    ]);
    const bracketMatches = collectMatchesFromTournaments(tournamentsById);
    const matches = mergeMatchSources(gamesById, bracketMatches);
    return buildTournamentHeadToHeadFromMatches(matches, playerA, playerB, {
        year: options.year != null ? options.year : new Date().getFullYear()
    });
};

const applyMapResult = (castleStats, castle, isWin) => {
    if (!castle) {
        return;
    }
    if (!castleStats[castle]) {
        castleStats[castle] = { wins: 0, loses: 0 };
    }
    if (isWin) {
        castleStats[castle].wins += 1;
    } else {
        castleStats[castle].loses += 1;
    }
};

/**
 * Castle W/L for a player from cup matches (game log + brackets).
 */
export const buildTournamentCastleStatsFromMatches = (matches, playerName) => {
    const candidates = buildNicknameCandidates(playerName);
    if (!candidates.length) {
        return {};
    }

    const castleStats = {};
    const seenMaps = new Set();

    (matches || []).forEach((match) => {
        if (!isTournamentMatch(match)) {
            return;
        }
        const isOpp1 = nickMatches(match.opponent1, candidates);
        const isOpp2 = nickMatches(match.opponent2, candidates);
        if (!isOpp1 && !isOpp2) {
            return;
        }

        const games = Array.isArray(match.games) ? match.games : [];
        if (games.length > 0) {
            games.forEach((subGame) => {
                if (!subGame?.gameWinner || subGame.gameWinner === 'draw') {
                    return;
                }
                const rawCastle = isOpp1 ? subGame.castle1 : subGame.castle2;
                const castle = normalizeCastleName(rawCastle);
                if (!castle) {
                    return;
                }
                const key = mapOutcomeDedupeKey(match, subGame, isOpp1);
                if (seenMaps.has(key)) {
                    return;
                }
                seenMaps.add(key);
                applyMapResult(castleStats, castle, nickMatches(subGame.gameWinner, candidates));
            });
            return;
        }

        const rawCastle = isOpp1 ? match.opponent1Castle : match.opponent2Castle;
        const castle = normalizeCastleName(rawCastle);
        if (!castle || !match.winner || match.winner === 'draw') {
            return;
        }
        const key = mapOutcomeDedupeKey(
            match,
            {
                gameId: 'series',
                castle1: match.opponent1Castle,
                castle2: match.opponent2Castle,
                gameWinner: match.winner
            },
            isOpp1
        );
        if (seenMaps.has(key)) {
            return;
        }
        seenMaps.add(key);
        applyMapResult(castleStats, castle, nickMatches(match.winner, candidates));
    });

    return castleStats;
};

export const buildTournamentCastleStatsForPlayer = (gamesById, playerName, bracketMatches = []) => {
    const matches = mergeMatchSources(gamesById, bracketMatches);
    return buildTournamentCastleStatsFromMatches(matches, playerName);
};

export const summarizeTournamentCastleStats = (castleStats) => {
    const rows = Object.entries(castleStats || {})
        .map(([castle, stats]) => {
            const wins = stats.wins || 0;
            const loses = stats.loses || 0;
            const total = wins + loses;
            return {
                castle,
                wins,
                loses,
                total,
                winRate: total > 0 ? (wins / total) * 100 : 0
            };
        })
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total || b.winRate - a.winRate || a.castle.localeCompare(b.castle));

    const withSample = rows.filter((row) => row.total >= 2);
    const pool = withSample.length ? withSample : rows;

    let best = null;
    let signature = null;
    let worst = null;

    if (pool.length) {
        best = [...pool].sort((a, b) => b.winRate - a.winRate || b.total - a.total)[0];
        worst = [...pool].sort((a, b) => a.winRate - b.winRate || b.total - a.total)[0];
        const strong = pool.filter((row) => row.winRate >= 55);
        signature = (strong.length ? strong : pool).sort((a, b) => b.total - a.total || b.winRate - a.winRate)[0];
    }

    return {
        rows,
        best,
        worst,
        signature,
        mapCount: rows.reduce((sum, row) => sum + row.total, 0)
    };
};

export const fetchTournamentCastleStatsForPlayer = async (playerName, options = {}) => {
    const [gamesById, tournamentsById] = await Promise.all([
        loadHeroes3Games(options),
        loadJson('/tournaments/heroes3.json', options).catch((error) => {
            console.warn('Tournament bracket supplement failed:', error);
            return {};
        })
    ]);
    const bracketMatches = collectMatchesFromTournaments(tournamentsById);
    const castleStats = buildTournamentCastleStatsForPlayer(gamesById, playerName, bracketMatches);
    return {
        castleStats,
        summary: summarizeTournamentCastleStats(castleStats)
    };
};
