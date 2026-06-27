import { setStageLabels } from '../tournament_api';

export const CHAMPIONS_LEAGUE_GROUP_SIZE = 4;
export const CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP = 2;
export const CHAMPIONS_LEAGUE_SIZES = [8, 16, 32];

export const isChampionsLeagueSize = (maxPlayers) => CHAMPIONS_LEAGUE_SIZES.includes(Number(maxPlayers));

export const getChampionsLeagueGroupCount = (maxPlayers) => Number(maxPlayers) / CHAMPIONS_LEAGUE_GROUP_SIZE;

export const getKnockoutPlayerCount = (maxPlayers) =>
    getChampionsLeagueGroupCount(maxPlayers) * CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP;

export const getGroupLabels = (groupCount) =>
    Array.from({ length: groupCount }, (_, index) => String.fromCharCode(65 + index));

export const mapSnakeDrawIndexToSlot = (drawIndex, groupCount) => ({
    groupIndex: drawIndex % groupCount,
    seatIndex: Math.floor(drawIndex / groupCount)
});

export const createEmptyGroupDrawGrid = (playerCount) => {
    const groupCount = playerCount / CHAMPIONS_LEAGUE_GROUP_SIZE;
    return Array.from({ length: groupCount }, () => Array.from({ length: CHAMPIONS_LEAGUE_GROUP_SIZE }, () => 'TBD'));
};

export const isGroupDrawGrid = (value) =>
    Array.isArray(value) &&
    value.length > 0 &&
    Array.isArray(value[0]) &&
    value[0].length === CHAMPIONS_LEAGUE_GROUP_SIZE;

export const countFilledDrawGridSlots = (grid) =>
    grid.reduce((count, group) => count + group.filter((name) => name !== 'TBD').length, 0);

export const isGroupDrawGridComplete = (grid) =>
    isGroupDrawGrid(grid) && grid.every((group) => group.every((name) => name !== 'TBD'));

export const getSnakeDrawSlotLabel = (drawIndex, groupCount) => {
    const labels = getGroupLabels(groupCount);
    const { groupIndex, seatIndex } = mapSnakeDrawIndexToSlot(drawIndex, groupCount);
    return `Table ${labels[groupIndex]}, seat ${seatIndex + 1}`;
};

export const buildGroupTablesFromDrawGrid = (grid) => {
    if (!isGroupDrawGrid(grid)) {
        return [];
    }

    const labels = getGroupLabels(grid.length);
    return labels.map((label, groupIndex) => ({
        label,
        slots: grid[groupIndex].map((name, seatIndex) => ({
            name,
            drawOrder: seatIndex + 1,
            filled: name !== 'TBD'
        })),
        isComplete: grid[groupIndex].every((entry) => entry !== 'TBD')
    }));
};

export const buildGroupsFromDrawGrid = (grid, playerList) => {
    const byName = new Map(playerList.map((player) => [player.name, player]));
    const labels = getGroupLabels(grid.length);
    const groups = {};

    labels.forEach((label, groupIndex) => {
        groups[label] = grid[groupIndex].map((name) => byName.get(name)).filter((player) => player && player.name);
    });

    return groups;
};

const shuffleList = (items) => {
    const list = [...items];
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
};

const buildGroupRoundMap = (playerNames) => {
    const list = playerNames.length % 2 !== 0 ? [...playerNames, null] : [...playerNames];
    const size = list.length;
    const map = {};

    for (let round = 0; round < size - 1; round++) {
        const rotation = [list[0]];
        for (let i = 0; i < size - 1; i++) {
            rotation.push(list[1 + ((i + round) % (size - 1))]);
        }
        for (let i = 0; i < size / 2; i++) {
            const player1 = rotation[i];
            const player2 = rotation[size - 1 - i];
            if (player1 !== null && player2 !== null) {
                map[`${player1}|${player2}`] = round + 1;
                map[`${player2}|${player1}`] = round + 1;
            }
        }
    }

    return map;
};

const getPlayerRating = (player) => {
    if (!player?.ratings) {
        return '0';
    }
    if (typeof player.ratings === 'string' && player.ratings.includes(',')) {
        return player.ratings.split(',').pop().trim();
    }
    return String(player.ratings);
};

const getGamesPerMatch = (gameType) => {
    if (gameType === 'bo-5') {
        return 5;
    }
    if (gameType === 'bo-3') {
        return 3;
    }
    if (gameType === 'bo-2') {
        return 2;
    }
    return 1;
};

const createMatchGames = (count) =>
    Array.from({ length: count }, (_, gameId) => ({
        castle1: '',
        castle2: '',
        castleWinner: '',
        gameId,
        gameStatus: 'Not Started',
        gameWinner: '',
        color1: 'red',
        color2: 'blue',
        gold1: 0,
        gold2: 0,
        restart1_111: 0,
        restart1_112: 0,
        restart2_111: 0,
        restart2_112: 0
    }));

export const orderPlayersFromWheelPairs = (pairs, playerList) => {
    const byName = new Map(playerList.map((player) => [player.name, player]));
    const ordered = [];

    pairs.forEach((pair) => {
        pair.forEach((name) => {
            const player = byName.get(name);
            if (player && !ordered.some((entry) => entry.name === player.name)) {
                ordered.push(player);
            }
        });
    });

    playerList.forEach((player) => {
        if (!ordered.some((entry) => entry.name === player.name)) {
            ordered.push(player);
        }
    });

    return ordered;
};

export const assignPlayersToGroups = (playerList, options = {}) => {
    const { shuffle = true } = options;
    const ordered = shuffle ? shuffleList(playerList) : [...playerList];
    const groupCount = ordered.length / CHAMPIONS_LEAGUE_GROUP_SIZE;
    const labels = getGroupLabels(groupCount);
    const groups = {};

    labels.forEach((label, index) => {
        const start = index * CHAMPIONS_LEAGUE_GROUP_SIZE;
        groups[label] = ordered.slice(start, start + CHAMPIONS_LEAGUE_GROUP_SIZE);
    });

    return groups;
};

export const generateChampionsLeagueGroupPairs = (groups, gameType) => {
    const numGames = getGamesPerMatch(gameType);
    const allPairs = [];

    Object.entries(groups).forEach(([groupLabel, groupPlayers]) => {
        const playerNames = groupPlayers.map((player) => player.name);
        const roundMap = buildGroupRoundMap(playerNames);

        for (let i = 0; i < groupPlayers.length; i++) {
            for (let j = i + 1; j < groupPlayers.length; j++) {
                const player1 = groupPlayers[i];
                const player2 = groupPlayers[j];

                allPairs.push({
                    gameStatus: 'Not Started',
                    games: createMatchGames(numGames),
                    ratings1: getPlayerRating(player1),
                    ratings2: getPlayerRating(player2),
                    round: roundMap[`${player1.name}|${player2.name}`] || 1,
                    score1: 0,
                    score2: 0,
                    stage: `Group ${groupLabel}`,
                    group: groupLabel,
                    stars1: player1.stars || 0,
                    stars2: player2.stars || 0,
                    team1: player1.name,
                    team2: player2.name,
                    type: gameType,
                    winner: null,
                    color1: 'red',
                    color2: 'blue'
                });
            }
        }
    });

    return allPairs;
};

const calcWinPoints = (pair, winnerTeam) => {
    const games = Array.isArray(pair.games) ? pair.games : [];
    const isTeam1 = winnerTeam === pair.team1;
    let total111 = 0;
    let total112 = 0;

    games.forEach((game) => {
        if (!game) {
            return;
        }
        total111 += Number(isTeam1 ? game.restart1_111 : game.restart2_111) || 0;
        total112 += Number(isTeam1 ? game.restart1_112 : game.restart2_112) || 0;
    });

    const totalRestarts = total111 + total112;
    if (totalRestarts === 0) {
        return 3;
    }
    if (totalRestarts === 1) {
        return 2.5;
    }
    return 2;
};

export const computeGroupStandings = (pairs, groupLabel, groupPlayers = []) => {
    const groupPairs = pairs.filter((pair) => pair.group === groupLabel);
    const map = {};

    groupPlayers.forEach((player) => {
        const name = typeof player === 'string' ? player : player?.name;
        if (name) {
            map[name] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        }
    });

    groupPairs.forEach((pair) => {
        if (pair.team1 && !map[pair.team1]) {
            map[pair.team1] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        }
        if (pair.team2 && !map[pair.team2]) {
            map[pair.team2] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        }

        if (!pair.winner || pair.winner === 'TBD') {
            return;
        }

        map[pair.team1].played++;
        map[pair.team2].played++;

        if (pair.winner === 'draw') {
            map[pair.team1].draws++;
            map[pair.team1].points += 1;
            map[pair.team2].draws++;
            map[pair.team2].points += 1;
            return;
        }

        const pts = scoringMode === 'classic' || pair.type === 'bo-2' ? 2 : calcWinPoints(pair, pair.winner);
        if (pair.winner === pair.team1) {
            map[pair.team1].wins++;
            map[pair.team1].points += pts;
            map[pair.team2].losses++;
        } else {
            map[pair.team2].wins++;
            map[pair.team2].points += pts;
            map[pair.team1].losses++;
        }
    });

    return Object.entries(map)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort(compareStandingsWithHeadToHead(groupPairs));
};

export const isChampionsLeagueGroupStageComplete = (pairs) => pairs.length > 0 && pairs.every((pair) => pair.winner);

export const getQualifiedPlayers = (groups, pairs, scoringMode = 'restart') => {
    const qualifiers = [];

    Object.entries(groups).forEach(([groupLabel, groupPlayers]) => {
        const standings = computeGroupStandings(pairs, groupLabel, groupPlayers, scoringMode);
        standings.slice(0, CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP).forEach((entry, index) => {
            const player = groupPlayers.find((item) => item.name === entry.name);
            qualifiers.push({
                name: entry.name,
                group: groupLabel,
                place: index + 1,
                ratings: getPlayerRating(player),
                stars: player?.stars || 0,
                points: entry.points
            });
        });
    });

    return qualifiers.sort((a, b) => a.group.localeCompare(b.group) || a.place - b.place);
};

/** Pair group winners vs runners-up from different groups (classic CL draw). */
export const pairKnockoutQualifiers = (qualifiers) => {
    const winners = qualifiers.filter((player) => player.place === 1).sort((a, b) => a.group.localeCompare(b.group));
    const runners = qualifiers.filter((player) => player.place === 2).sort((a, b) => a.group.localeCompare(b.group));

    const usedRunners = new Set();
    const ordered = [];

    winners.forEach((winner, index) => {
        let runner =
            runners.find((candidate) => candidate.group !== winner.group && !usedRunners.has(candidate.name)) ||
            runners.find(
                (candidate, runnerIndex) => !usedRunners.has(candidate.name) && runnerIndex !== index % runners.length
            ) ||
            runners.find((candidate) => !usedRunners.has(candidate.name));

        if (runner) {
            usedRunners.add(runner.name);
            ordered.push(winner, runner);
        } else {
            ordered.push(winner);
        }
    });

    return ordered;
};

const getPairsCountForKnockoutStage = (stageName, _knockoutSize) => {
    const map = {
        '1/16 Final': 16,
        '1/8 Final': 8,
        'Quarter-final': 4,
        'Semi-final': 2,
        'Third Place': 1,
        Final: 1
    };
    return map[stageName] || 1;
};

const createEmptyKnockoutPair = (stageName, gameType, finalGameType, thirdPlaceGameType) => {
    let typeOfGame = gameType;
    let gameCount = getGamesPerMatch(gameType);

    if (stageName === 'Final') {
        typeOfGame = finalGameType;
        gameCount = getGamesPerMatch(finalGameType);
    } else if (stageName === 'Third Place') {
        typeOfGame = thirdPlaceGameType;
        gameCount = getGamesPerMatch(thirdPlaceGameType);
    }

    return {
        stage: stageName,
        team1: 'TBD',
        team2: 'TBD',
        ratings1: null,
        ratings2: null,
        stars1: null,
        stars2: null,
        score1: 0,
        score2: 0,
        type: typeOfGame,
        gameStatus: 'Not Started',
        games: createMatchGames(gameCount),
        winner: null,
        color1: 'red',
        color2: 'blue',
        bracketSide: 'knockout'
    };
};

export const generateKnockoutBracketStages = (
    qualifiers,
    knockoutSize,
    gameType,
    finalGameType,
    thirdPlaceGameType
) => {
    const labels = setStageLabels(knockoutSize);
    const stages = [];

    labels.forEach((stageName, stageIndex) => {
        const pairCount = getPairsCountForKnockoutStage(stageName, knockoutSize);
        const pairs = [];

        for (let pairIndex = 0; pairIndex < pairCount; pairIndex++) {
            const pair = createEmptyKnockoutPair(stageName, gameType, finalGameType, thirdPlaceGameType);

            if (stageIndex === 0) {
                const seededQualifiers = pairKnockoutQualifiers(qualifiers);
                const matchupIndex = pairIndex;
                const player1 = seededQualifiers[matchupIndex * 2];
                const player2 = seededQualifiers[matchupIndex * 2 + 1];

                if (player1) {
                    pair.team1 = player1.name;
                    pair.ratings1 = player1.ratings;
                    pair.stars1 = player1.stars;
                }
                if (player2) {
                    pair.team2 = player2.name;
                    pair.ratings2 = player2.ratings;
                    pair.stars2 = player2.stars;
                }
            }

            pairs.push(pair);
        }

        stages.push(pairs);
    });

    return stages;
};

export const validateChampionsLeagueRegistration = (registeredCount, maxPlayers) => {
    const max = Number(maxPlayers);
    const count = Number(registeredCount);

    if (!isChampionsLeagueSize(max)) {
        return {
            valid: false,
            message: `Champions League requires exactly ${CHAMPIONS_LEAGUE_SIZES.join(', ')} players.`
        };
    }

    if (count !== max) {
        return {
            valid: false,
            message: `Champions League needs exactly ${max} players (${CHAMPIONS_LEAGUE_GROUP_SIZE} per group, top ${CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP} advance). Currently registered: ${count}.`
        };
    }

    return { valid: true, message: '' };
};

const normalizeGroupGameType = (rawGameType) => {
    const raw = rawGameType || 'bo-1';
    if (raw === '5' || raw === 'bo-5') {
        return 'bo-5';
    }
    if (raw === '3' || raw === 'bo-3') {
        return 'bo-3';
    }
    if (raw === '2' || raw === 'bo-2') {
        return 'bo-2';
    }
    return 'bo-1';
};

export const normalizeChampionsLeagueKnockoutGameType = (rawGameType, fallback = 'bo-1') => {
    const raw = rawGameType || fallback || 'bo-1';
    if (raw === '3' || raw === 'bo-3') {
        return 'bo-3';
    }
    return 'bo-1';
};

export const prepareChampionsLeagueGroupStage = (playerList, tournamentData, options = {}) => {
    const validation = validateChampionsLeagueRegistration(playerList.length, tournamentData.maxPlayers);
    if (!validation.valid) {
        return { validation, groups: null, groupPairs: null, gameType: null, groupCount: 0 };
    }

    const gameType = normalizeGroupGameType(tournamentData.tournamentPlayoffGames);
    const groups = assignPlayersToGroups(playerList, { shuffle: options.shuffle !== false });
    const groupPairs = generateChampionsLeagueGroupPairs(groups, gameType);

    return {
        validation,
        groups,
        groupPairs,
        gameType,
        groupCount: Object.keys(groups).length
    };
};

export const prepareChampionsLeagueFromDrawGrid = (grid, tournamentData, playerList) => {
    const validation = validateChampionsLeagueRegistration(playerList.length, tournamentData.maxPlayers);
    if (!validation.valid) {
        return { validation, groups: null, groupPairs: null, gameType: null, groupCount: 0 };
    }

    const gameType = normalizeGroupGameType(tournamentData.tournamentPlayoffGames);
    const groups = buildGroupsFromDrawGrid(grid, playerList);
    const groupPairs = generateChampionsLeagueGroupPairs(groups, gameType);

    return {
        validation,
        groups,
        groupPairs,
        gameType,
        groupCount: Object.keys(groups).length
    };
};
