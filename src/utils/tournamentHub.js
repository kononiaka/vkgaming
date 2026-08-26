import { getTournamentPrizeLabel } from '../api/api';
import { getApprovedCommentators } from './tournamentCommentators';
import { formatMatchSchedule } from '../components/tournaments/homm3/matchScheduleUtils';
import { buildMatchStageLabel } from './matchFixtureLabels';
import { getTournamentMatchLink, normalizePlayoffPairs, pairHasLiveMap } from './tournamentBracketNavigation';

export const DEFAULT_TOURNAMENT_HUB_TAB = 'overview';

export const TOURNAMENT_HUB_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'matches', label: 'Matches' },
    { id: 'participants', label: 'Participants' },
    { id: 'statistics', label: 'Statistics' },
    { id: 'restarts', label: 'Restarts' }
];

const isPlaceholderName = (name) => {
    const value = String(name || '').trim();
    if (!value) {
        return true;
    }
    const lower = value.toLowerCase();
    return lower === 'tbd' || lower === 'bye' || lower === 'null';
};

const nickKey = (name) =>
    String(name || '')
        .trim()
        .toLowerCase();

const countFinishedMaps = (pair) => {
    const games = Array.isArray(pair?.games) ? pair.games : [];
    const finishedMaps = games.filter((game) => game?.gameWinner || game?.castleWinner || game?.winner).length;
    if (finishedMaps > 0) {
        return finishedMaps;
    }
    const score1 = Number(pair?.score1) || 0;
    const score2 = Number(pair?.score2) || 0;
    return score1 + score2;
};

const getTournamentPlayersObject = (tournament) => {
    const players = tournament?.players;
    return players && typeof players === 'object' ? players : {};
};

export const countHubRegisteredPlayers = (tournament) =>
    Object.values(getTournamentPlayersObject(tournament)).filter(
        (player) => player?.name && player.name.trim() !== '' && player.name.trim() !== 'TBD'
    ).length;

export const parseTournamentHubTab = (value) => {
    const id = String(value || '')
        .trim()
        .toLowerCase();
    return TOURNAMENT_HUB_TABS.some((tab) => tab.id === id) ? id : DEFAULT_TOURNAMENT_HUB_TAB;
};

export const setTournamentHubTabParam = (searchParams, tabId) => {
    const next = new URLSearchParams(searchParams);
    const tab = parseTournamentHubTab(tabId);
    if (tab === DEFAULT_TOURNAMENT_HUB_TAB) {
        next.delete('tab');
    } else {
        next.set('tab', tab);
    }
    return next;
};

export const buildTournamentHubSummary = (tournament) => {
    if (!tournament) {
        return [];
    }

    const items = [];
    const dateLabel = formatMatchSchedule(tournament.date) || tournament.date;
    if (dateLabel) {
        items.push({ label: 'Date', value: dateLabel });
    }

    const registered = countHubRegisteredPlayers(tournament);
    const maxPlayers = Number(tournament.maxPlayers);
    items.push({
        label: 'Players',
        value: Number.isFinite(maxPlayers) && maxPlayers > 0 ? `${registered} / ${maxPlayers}` : String(registered)
    });

    const prizeLabel = getTournamentPrizeLabel(tournament);
    if (prizeLabel) {
        items.push({ label: 'Prize pool', value: prizeLabel.replace(/ prize pool$/i, '') });
    }

    const commentators = getApprovedCommentators(tournament);
    const onAir = commentators.filter((commentator) => commentator.isCommentating);
    if (onAir.length > 0) {
        items.push({ label: 'Stream', value: 'On air' });
    } else if (commentators.length > 0) {
        items.push({
            label: 'Stream',
            value: commentators
                .map((commentator) => commentator.name)
                .filter(Boolean)
                .join(', ')
        });
    }

    return items;
};

export const collectHubMatches = (tournament) => {
    if (!tournament) {
        return [];
    }

    const matches = [];
    const stages = normalizePlayoffPairs(tournament.bracket?.playoffPairs);

    stages.forEach((stage, stageIndex) => {
        const pairs = Array.isArray(stage) ? stage : stage ? [stage] : [];
        pairs.forEach((pair, pairIndex) => {
            if (!pair || pair.isBye || pair.testReport) {
                return;
            }
            if (isPlaceholderName(pair.team1) || isPlaceholderName(pair.team2)) {
                return;
            }

            const finished = Boolean(pair.winner && pair.winner !== 'TBD');
            const live = !finished && (pairHasLiveMap(pair) || pair.gameStatus === 'In Progress');
            const score1 = Number(pair.score1) || 0;
            const score2 = Number(pair.score2) || 0;
            const maps = countFinishedMaps(pair);
            const sortTime = Date.parse(pair.scheduledAt || '') || 0;

            matches.push({
                id: `${stageIndex}-${pairIndex}`,
                tournamentId: tournament.id,
                stageIndex,
                pairIndex,
                round: pair.round,
                stageLabel: buildMatchStageLabel(tournament, pair, stageIndex),
                team1: pair.team1,
                team2: pair.team2,
                score1,
                score2,
                winner: finished && pair.winner !== 'draw' ? pair.winner : null,
                isDraw: pair.winner === 'draw',
                maps,
                scheduledAt: pair.scheduledAt || null,
                dateLabel: formatMatchSchedule(pair.scheduledAt) || null,
                status: finished ? 'finished' : live ? 'live' : 'upcoming',
                href: tournament.id
                    ? getTournamentMatchLink({
                          tournamentId: tournament.id,
                          stageIndex,
                          pairIndex,
                          round: pair.round
                      })
                    : null,
                sortTime
            });
        });
    });

    const statusOrder = { live: 0, upcoming: 1, finished: 2 };
    return matches.sort((a, b) => {
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) {
            return statusDiff;
        }
        if (a.status === 'finished') {
            return b.sortTime - a.sortTime || b.stageIndex - a.stageIndex || a.pairIndex - b.pairIndex;
        }
        return a.sortTime - b.sortTime || a.stageIndex - b.stageIndex || a.pairIndex - b.pairIndex;
    });
};

export const collectHubParticipants = (tournament) => {
    const players = Object.entries(getTournamentPlayersObject(tournament))
        .filter(([, player]) => player?.name && !isPlaceholderName(player.name))
        .map(([key, player]) => ({
            key,
            name: player.name,
            siteUserId: player.siteUserId || null,
            stars: player.stars,
            wins: 0,
            losses: 0,
            draws: 0,
            mapsWon: 0,
            mapsLost: 0,
            played: 0
        }));

    const byName = new Map(players.map((player) => [nickKey(player.name), player]));

    collectHubMatches(tournament).forEach((match) => {
        if (match.status !== 'finished') {
            return;
        }

        const team1 = byName.get(nickKey(match.team1));
        const team2 = byName.get(nickKey(match.team2));

        if (team1) {
            team1.played += 1;
            team1.mapsWon += match.score1;
            team1.mapsLost += match.score2;
        }
        if (team2) {
            team2.played += 1;
            team2.mapsWon += match.score2;
            team2.mapsLost += match.score1;
        }

        if (match.isDraw) {
            if (team1) {
                team1.draws += 1;
            }
            if (team2) {
                team2.draws += 1;
            }
            return;
        }

        if (nickKey(match.winner) === nickKey(match.team1)) {
            if (team1) {
                team1.wins += 1;
            }
            if (team2) {
                team2.losses += 1;
            }
        } else if (nickKey(match.winner) === nickKey(match.team2)) {
            if (team2) {
                team2.wins += 1;
            }
            if (team1) {
                team1.losses += 1;
            }
        }
    });

    return players.sort(
        (a, b) =>
            b.wins - a.wins || b.mapsWon - a.mapsWon || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
};

export const collectHubMapGames = (tournament) => {
    if (!tournament) {
        return [];
    }

    const games = [];
    const stages = normalizePlayoffPairs(tournament.bracket?.playoffPairs);

    stages.forEach((stage) => {
        const pairs = Array.isArray(stage) ? stage : stage ? [stage] : [];
        pairs.forEach((pair) => {
            if (!pair || pair.isBye || pair.testReport) {
                return;
            }
            (Array.isArray(pair.games) ? pair.games : []).forEach((game) => {
                if (!game) {
                    return;
                }
                games.push({
                    ...game,
                    team1: pair.team1,
                    team2: pair.team2
                });
            });
        });
    });

    return games;
};

const oppositeColor = (color) => {
    if (color === 'red') {
        return 'blue';
    }
    if (color === 'blue') {
        return 'red';
    }
    return null;
};

const resolveSideColor = (game, side) => {
    if (side === 1) {
        return game.color1 || oppositeColor(game.color2) || null;
    }
    return game.color2 || oppositeColor(game.color1) || null;
};

export const classifyRestartUsage = (restart111, restart112) => {
    const n112 = Number(restart112) || 0;
    const n111 = Number(restart111) || 0;
    if (n112 > 0) {
        return '112';
    }
    if (n111 >= 2) {
        return '111x2';
    }
    if (n111 === 1) {
        return '111x1';
    }
    return 'none';
};

export const restartCoefficient = (restart111, restart112) =>
    Math.min(1 + (Number(restart111) || 0) * 0.5 + (Number(restart112) || 0) * 1, 2);

const hasRestartData = (restart111, restart112) => restart111 != null || restart112 != null;

const emptyRestartBucket = () => ({
    maps: 0,
    coeffSum: 0,
    maps111x1: 0,
    maps111x2: 0,
    maps112: 0,
    mapsNone: 0,
    total111: 0,
    total112: 0
});

const addRestartSample = (bucket, restart111, restart112) => {
    const n111 = Number(restart111) || 0;
    const n112 = Number(restart112) || 0;
    const kind = classifyRestartUsage(n111, n112);
    bucket.maps += 1;
    bucket.coeffSum += restartCoefficient(n111, n112);
    bucket.total111 += n111;
    bucket.total112 += n112;
    if (kind === '112') {
        bucket.maps112 += 1;
    } else if (kind === '111x2') {
        bucket.maps111x2 += 1;
    } else if (kind === '111x1') {
        bucket.maps111x1 += 1;
    } else {
        bucket.mapsNone += 1;
    }
};

const finalizeRestartBucket = (bucket) => ({
    ...bucket,
    averageCoefficient: bucket.maps > 0 ? (bucket.coeffSum / bucket.maps).toFixed(2) : '1.00',
    percent111x1: bucket.maps > 0 ? ((bucket.maps111x1 / bucket.maps) * 100).toFixed(1) : '0.0',
    percent111x2: bucket.maps > 0 ? ((bucket.maps111x2 / bucket.maps) * 100).toFixed(1) : '0.0',
    percent112: bucket.maps > 0 ? ((bucket.maps112 / bucket.maps) * 100).toFixed(1) : '0.0',
    percentNone: bucket.maps > 0 ? ((bucket.mapsNone / bucket.maps) * 100).toFixed(1) : '0.0'
});

export const buildHubCupMechanics = (tournament) => {
    const games = collectHubMapGames(tournament);
    let goldSum = 0;
    let goldSamples = 0;
    let redWins = 0;
    let blueWins = 0;
    let colorMaps = 0;

    games.forEach((game) => {
        const goldValues = [game.gold1, game.gold2]
            .filter((gold) => gold != null && gold !== '')
            .map(Number)
            .filter((value) => Number.isFinite(value));
        if (goldValues.length > 0) {
            goldSum += goldValues.reduce((sum, value) => sum + Math.abs(value), 0) / goldValues.length;
            goldSamples += 1;
        }

        const color1 = resolveSideColor(game, 1);
        const color2 = resolveSideColor(game, 2);
        const winner = game.gameWinner || game.winner;
        if (!winner || winner === 'draw' || !color1 || !color2) {
            return;
        }

        colorMaps += 1;
        if (nickKey(winner) === nickKey(game.team1)) {
            if (color1 === 'red') {
                redWins += 1;
            } else if (color1 === 'blue') {
                blueWins += 1;
            }
        } else if (nickKey(winner) === nickKey(game.team2)) {
            if (color2 === 'red') {
                redWins += 1;
            } else if (color2 === 'blue') {
                blueWins += 1;
            }
        }
    });

    return {
        maps: games.length,
        goldSamples,
        averageGold: goldSamples > 0 ? goldSum / goldSamples : null,
        colorMaps,
        redWins,
        blueWins,
        redWinRate: colorMaps > 0 ? (redWins / colorMaps) * 100 : null,
        blueWinRate: colorMaps > 0 ? (blueWins / colorMaps) * 100 : null
    };
};

export const buildHubRestartStats = (tournament) => {
    const games = collectHubMapGames(tournament);
    const cup = emptyRestartBucket();
    const byName = new Map();

    const ensurePlayer = (name) => {
        if (isPlaceholderName(name)) {
            return null;
        }
        const key = nickKey(name);
        if (!byName.has(key)) {
            byName.set(key, { name, key, ...emptyRestartBucket() });
        }
        return byName.get(key);
    };

    games.forEach((game) => {
        const sides = [
            { name: game.team1, restart111: game.restart1_111, restart112: game.restart1_112 },
            { name: game.team2, restart111: game.restart2_111, restart112: game.restart2_112 }
        ];

        sides.forEach((side) => {
            if (!hasRestartData(side.restart111, side.restart112)) {
                return;
            }
            addRestartSample(cup, side.restart111, side.restart112);
            const player = ensurePlayer(side.name);
            if (player) {
                addRestartSample(player, side.restart111, side.restart112);
            }
        });
    });

    const playersByNick = new Map(collectHubParticipants(tournament).map((player) => [nickKey(player.name), player]));

    const players = [...byName.values()]
        .map((row) => {
            const roster = playersByNick.get(row.key);
            return {
                ...finalizeRestartBucket(row),
                siteUserId: roster?.siteUserId || null
            };
        })
        .sort(
            (a, b) =>
                Number(b.averageCoefficient) - Number(a.averageCoefficient) ||
                b.maps - a.maps ||
                a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );

    return {
        cup: finalizeRestartBucket(cup),
        players
    };
};
