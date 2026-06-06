import { FIREBASE_FUNCTIONS_BASE } from '../config/firebase';

const callHotaFunction = async (name, data = {}) => {
    const res = await fetch(`${FIREBASE_FUNCTIONS_BASE}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(payload?.error?.message || `HotA Meta request failed (${name})`);
    }

    return payload.result;
};

export const HOTA_FACTIONS = [
    { id: 0, name: 'Castle', konoplayName: 'Castle' },
    { id: 1, name: 'Rampart', konoplayName: 'Rampart' },
    { id: 2, name: 'Tower', konoplayName: 'Tower' },
    { id: 3, name: 'Inferno', konoplayName: 'Inferno' },
    { id: 4, name: 'Necropolis', konoplayName: 'Necropolis' },
    { id: 5, name: 'Dungeon', konoplayName: 'Dungeon' },
    { id: 6, name: 'Stronghold', konoplayName: 'Stronghold' },
    { id: 7, name: 'Fortress', konoplayName: 'Fortress' },
    { id: 8, name: 'Conflux', konoplayName: 'Conflux' },
    { id: 9, name: 'Cove', konoplayName: 'Cove' },
    { id: 10, name: 'Factory', konoplayName: 'Factory' },
    { id: 11, name: 'Bulwark', konoplayName: 'Kronverk' }
];

export const searchHotaPlayers = async (query) => {
    const { results } = await callHotaFunction('hotaSearch', { query });
    return results || [];
};

export const fetchHotaSummary = async () => {
    const { summary } = await callHotaFunction('hotaSummary');
    return summary;
};

export const fetchHotaFactions = async () => {
    const { factions } = await callHotaFunction('hotaFactions');
    return factions || [];
};

export const fetchHotaPlayer = async (playerId) => {
    const { player } = await callHotaFunction('hotaPlayer', { playerId });
    return player;
};

export const fetchHotaLeaderboard = async ({ limit = 100 } = {}) => {
    const { leaderboard } = await callHotaFunction('hotaLeaderboard', { limit });
    return leaderboard || [];
};

export const findHotaLeaderboardRank = (nickname, leaderboard) => {
    const query = nickname?.trim().toLowerCase();
    if (!query || !Array.isArray(leaderboard)) {
        return null;
    }

    const index = leaderboard.findIndex((entry) => entry.username?.toLowerCase() === query);
    return index >= 0 ? index + 1 : null;
};

export const fetchHotaPlayerMatches = async (playerId, { limit = 50, heroId = null } = {}) => {
    const payload = { playerId, limit };
    if (heroId != null) {
        payload.heroId = heroId;
    }
    const { matches } = await callHotaFunction('hotaPlayerMatches', payload);
    return matches || [];
};

export const getHotaPlayerUrl = (playerId) => `https://hotameta.com/player/${playerId}`;

const mapFactionName = (factionName) => {
    const mapping = HOTA_FACTIONS.find((entry) => entry.name === factionName);
    return mapping?.konoplayName || factionName;
};

export const deriveHotaTradeStats = (matches, playerId) => {
    if (!Array.isArray(matches) || !playerId) {
        return null;
    }

    const trades = matches
        .map((match) => {
            if (match.p1_player_id === playerId) {
                return match.p1_trade;
            }
            if (match.p2_player_id === playerId) {
                return match.p2_trade;
            }
            return null;
        })
        .filter((trade) => trade != null && Number.isFinite(Number(trade)));

    if (!trades.length) {
        return null;
    }

    const total = trades.reduce((sum, trade) => sum + Number(trade), 0);

    return {
        averageTrade: total / trades.length,
        games: trades.length
    };
};

export const deriveHotaPlayerSummary = (profile) => {
    const summary = profile?.summary;
    if (!summary) {
        return null;
    }

    return {
        wins: summary.wins ?? 0,
        losses: summary.losses ?? 0,
        totalGames: summary.games ?? 0,
        winRate: summary.winrate ?? 0,
        rating: summary.current_rating,
        peakRating: summary.peak_rating,
        avgDurationMin: summary.avg_duration_min
    };
};

export const deriveBestWorstFaction = (profile, minGames = 3) => {
    const factions = (profile?.faction_stats || []).filter((row) => row.games >= minGames);
    if (!factions.length) {
        return { best: null, worst: null };
    }

    const sorted = [...factions].sort((a, b) => b.winrate - a.winrate);
    const toCard = (row) => ({
        castle: mapFactionName(row.faction_name),
        wins: row.wins,
        loses: row.games - row.wins,
        winrate: row.winrate
    });

    return {
        best: toCard(sorted[0]),
        worst: toCard(sorted[sorted.length - 1])
    };
};

export const deriveBestWorstOpponent = (profile, minGames = 3) => {
    const opponents = (profile?.opponents || []).filter((row) => row.games >= minGames);
    if (!opponents.length) {
        return { best: null, worst: null };
    }

    const sorted = [...opponents].sort((a, b) => b.winrate - a.winrate);
    const toCard = (row) => ({
        opponent: row.opp_name,
        wins: row.wins,
        loses: row.games - row.wins,
        winrate: row.winrate
    });

    return {
        best: toCard(sorted[0]),
        worst: toCard(sorted[sorted.length - 1])
    };
};

export const fetchHotaPlayerByLobbyNickname = async (nickname) => {
    const query = nickname?.trim();
    if (!query || query.length < 2) {
        return { status: 'invalid' };
    }

    const results = await searchHotaPlayers(query);
    const exact = results.find((entry) => entry.username?.toLowerCase() === query.toLowerCase());

    if (!exact) {
        return {
            status: 'not_found',
            query,
            suggestions: results.filter((entry) => entry.username).slice(0, 5)
        };
    }

    const [profile, matches] = await Promise.all([
        fetchHotaPlayer(exact.player_id),
        fetchHotaPlayerMatches(exact.player_id, { limit: 50 })
    ]);

    return {
        status: 'ok',
        playerId: exact.player_id,
        username: exact.username,
        profile,
        matches
    };
};
