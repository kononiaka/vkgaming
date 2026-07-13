import { setStageLabels } from '../tournament_api';

export const CHAMPIONS_LEAGUE_GROUP_SIZE = 4;
export const CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP = 2;
export const CHAMPIONS_LEAGUE_SIZES = [8, 16, 32];
export const CHAMPIONS_LEAGUE_TWO_GROUP_TYPE = 'champions-league-2gs';
export const CHAMPIONS_LEAGUE_TWO_GROUP_SIZES = [16, 32];

export const isChampionsLeagueType = (type) => type === 'champions-league' || type === CHAMPIONS_LEAGUE_TWO_GROUP_TYPE;

export const isChampionsLeagueTwoGroupType = (type) => type === CHAMPIONS_LEAGUE_TWO_GROUP_TYPE;

export const isChampionsLeagueSize = (maxPlayers) => CHAMPIONS_LEAGUE_SIZES.includes(Number(maxPlayers));

export const isChampionsLeagueTwoGroupSize = (maxPlayers) =>
    CHAMPIONS_LEAGUE_TWO_GROUP_SIZES.includes(Number(maxPlayers));

export const isChampionsLeagueSizeForType = (type, maxPlayers) =>
    isChampionsLeagueTwoGroupType(type) ? isChampionsLeagueTwoGroupSize(maxPlayers) : isChampionsLeagueSize(maxPlayers);

export const getChampionsLeagueGroupCount = (maxPlayers) => Number(maxPlayers) / CHAMPIONS_LEAGUE_GROUP_SIZE;

export const getSecondGroupCount = (maxPlayers) => getChampionsLeagueGroupCount(maxPlayers) / 2;

export const getKnockoutPlayerCount = (maxPlayers) =>
    getChampionsLeagueGroupCount(maxPlayers) * CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP;

export const getKnockoutPlayerCountForType = (type, maxPlayers) =>
    isChampionsLeagueTwoGroupType(type)
        ? getKnockoutPlayerCountTwoGroup(maxPlayers)
        : getKnockoutPlayerCount(maxPlayers);

export const getKnockoutPlayerCountTwoGroup = (maxPlayers) =>
    getSecondGroupCount(maxPlayers) * CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP;

export const normalizeChampionsLeaguePhase = (phase, isTwoGroup = false) => {
    if (!isTwoGroup) {
        if (phase === 'group1') {
            return 'group';
        }
        return phase || 'group';
    }

    if (phase === 'group') {
        return 'group1';
    }

    return phase || 'group1';
};

export const getChampionsLeagueScheduleStageIndex = (phase, isTwoGroup = false) => {
    if (!isTwoGroup) {
        return 0;
    }

    return phase === 'group2' ? 1 : 0;
};

export const getChampionsLeagueScheduleStageOffset = (phase, isTwoGroup = false) => {
    if (phase !== 'knockout') {
        return 0;
    }

    return isTwoGroup ? 2 : 1;
};

export const getPairGroupPhase = (pair) => pair?.groupPhase ?? 1;

export const filterPairsByGroupPhase = (pairs, groupPhase) =>
    (pairs || []).filter((pair) => getPairGroupPhase(pair) === groupPhase);

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

export const generateChampionsLeagueGroupPairs = (groups, gameType, options = {}) => {
    const { groupPhase = 1 } = options;
    const numGames = getGamesPerMatch(gameType);
    const allPairs = [];
    const stageSuffix = groupPhase === 2 ? ' (II)' : '';

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
                    stage: `Group ${groupLabel}${stageSuffix}`,
                    group: groupLabel,
                    groupPhase,
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

export const compareHeadToHead = (pairs, playerA, playerB) => {
    const directPairs = pairs.filter(
        (pair) =>
            pair.winner &&
            pair.winner !== 'TBD' &&
            ((pair.team1 === playerA && pair.team2 === playerB) || (pair.team1 === playerB && pair.team2 === playerA))
    );

    if (directPairs.length === 0) {
        return 0;
    }

    let playerAPoints = 0;
    let playerBPoints = 0;

    directPairs.forEach((pair) => {
        if (pair.winner === 'draw') {
            playerAPoints += 1;
            playerBPoints += 1;
            return;
        }

        if (pair.winner === playerA) {
            playerAPoints += 3;
        } else if (pair.winner === playerB) {
            playerBPoints += 3;
        }
    });

    return playerBPoints - playerAPoints;
};

export const compareStandingsWithHeadToHead = (pairs) => (a, b) =>
    b.points - a.points || compareHeadToHead(pairs, a.name, b.name) || b.wins - a.wins || a.name.localeCompare(b.name);

export const computeGroupStandings = (
    pairs,
    groupLabel,
    groupPlayers = [],
    scoringMode = 'restart',
    groupPhase = null
) => {
    const groupPairs = pairs.filter((pair) => {
        if (pair.group !== groupLabel) {
            return false;
        }

        if (groupPhase == null) {
            return true;
        }

        return getPairGroupPhase(pair) === groupPhase;
    });
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

export const isChampionsLeagueGroupStageComplete = (pairs, groupPhase = null) => {
    const relevantPairs = groupPhase == null ? pairs || [] : filterPairsByGroupPhase(pairs || [], groupPhase);

    return relevantPairs.length > 0 && relevantPairs.every((pair) => pair.winner);
};

export const getQualifiedPlayers = (groups, pairs, scoringMode = 'restart', groupPhase = null) => {
    const qualifiers = [];

    Object.entries(groups).forEach(([groupLabel, groupPlayers]) => {
        const standings = computeGroupStandings(pairs, groupLabel, groupPlayers, scoringMode, groupPhase);
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

export const validateChampionsLeagueRegistration = (
    registeredCount,
    maxPlayers,
    tournamentType = 'champions-league'
) => {
    const max = Number(maxPlayers);
    const count = Number(registeredCount);
    const isTwoGroup = isChampionsLeagueTwoGroupType(tournamentType);
    const allowedSizes = isTwoGroup ? CHAMPIONS_LEAGUE_TWO_GROUP_SIZES : CHAMPIONS_LEAGUE_SIZES;
    const sizeValid = isTwoGroup ? isChampionsLeagueTwoGroupSize(max) : isChampionsLeagueSize(max);

    if (!sizeValid) {
        return {
            valid: false,
            message: isTwoGroup
                ? `Two-group Champions League requires exactly ${CHAMPIONS_LEAGUE_TWO_GROUP_SIZES.join(', ')} players.`
                : `Champions League requires exactly ${CHAMPIONS_LEAGUE_SIZES.join(', ')} players.`
        };
    }

    if (count !== max) {
        const advanceLabel = isTwoGroup
            ? `${getChampionsLeagueGroupCount(max)} groups × ${CHAMPIONS_LEAGUE_GROUP_SIZE}, top ${CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP} to second group stage`
            : `${CHAMPIONS_LEAGUE_GROUP_SIZE} per group, top ${CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP} advance`;

        return {
            valid: false,
            message: `Champions League needs exactly ${max} players (${advanceLabel}). Currently registered: ${count}.`
        };
    }

    if (!allowedSizes.includes(max)) {
        return {
            valid: false,
            message: `Invalid player count ${max} for this Champions League format.`
        };
    }

    return { valid: true, message: '' };
};

const compareQualifiersBySeed = (a, b) =>
    b.points - a.points || a.group.localeCompare(b.group) || a.name.localeCompare(b.name);

export const buildSecondGroupDrawPots = (qualifiers) => {
    const winners = qualifiers.filter((player) => player.place === 1).sort(compareQualifiersBySeed);
    const runners = qualifiers.filter((player) => player.place === 2).sort(compareQualifiersBySeed);
    const halfWinners = Math.max(1, winners.length / 2);
    const halfRunners = Math.max(1, runners.length / 2);

    return [
        winners.slice(0, halfWinners),
        winners.slice(halfWinners),
        runners.slice(0, halfRunners),
        runners.slice(halfRunners)
    ];
};

const assignSecondGroupsWithBacktracking = (pots, groupCount, labels, options = {}) => {
    const { shuffle = true } = options;
    const preparedPots = pots.map((pot) => (shuffle ? shuffleList(pot) : [...pot]));
    const groups2 = {};
    labels.forEach((label) => {
        groups2[label] = [];
    });
    const usedNames = new Set();

    const fillPotsForGroup = (groupIndex, potIndex) => {
        if (potIndex >= preparedPots.length) {
            return groupIndex + 1 >= groupCount ? true : fillPotsForGroup(groupIndex + 1, 0);
        }

        const label = labels[groupIndex];
        for (const candidate of preparedPots[potIndex]) {
            if (usedNames.has(candidate.name)) {
                continue;
            }

            if (groups2[label].some((player) => player.group === candidate.group)) {
                continue;
            }

            groups2[label].push(candidate);
            usedNames.add(candidate.name);

            if (fillPotsForGroup(groupIndex, potIndex + 1)) {
                return true;
            }

            groups2[label].pop();
            usedNames.delete(candidate.name);
        }

        return false;
    };

    const success = fillPotsForGroup(0, 0);
    return { groups2, valid: success };
};

export const assignQualifiersToSecondGroups = (qualifiers, options = {}) => {
    const secondGroupCount = qualifiers.length / 4;
    if (!Number.isInteger(secondGroupCount) || secondGroupCount < 1) {
        return {
            groups2: null,
            valid: false,
            message: 'Invalid qualifier count for second group stage.'
        };
    }

    const labels = getGroupLabels(secondGroupCount);
    const pots = buildSecondGroupDrawPots(qualifiers);
    const assignment = assignSecondGroupsWithBacktracking(pots, secondGroupCount, labels, options);

    if (!assignment.valid) {
        return {
            groups2: null,
            valid: false,
            message: 'Could not draw second group stage without same-group conflicts.'
        };
    }

    return {
        groups2: assignment.groups2,
        valid: true,
        message: ''
    };
};

export const prepareChampionsLeagueSecondGroupStage = (
    firstStageGroups,
    firstStagePairs,
    tournamentData,
    scoringMode = 'restart',
    options = {}
) => {
    const qualifiers = getQualifiedPlayers(firstStageGroups, firstStagePairs, scoringMode, 1);
    const assignment = assignQualifiersToSecondGroups(qualifiers, options);

    if (!assignment.valid) {
        return {
            validation: { valid: false, message: assignment.message },
            groups2: null,
            group2Pairs: null,
            qualifiers: null
        };
    }

    const playerByName = new Map();
    Object.values(firstStageGroups).forEach((groupPlayers) => {
        groupPlayers.forEach((player) => {
            if (player?.name) {
                playerByName.set(player.name, player);
            }
        });
    });

    const groups2 = {};
    Object.entries(assignment.groups2).forEach(([label, groupQualifiers]) => {
        groups2[label] = groupQualifiers
            .map((qualifier) => playerByName.get(qualifier.name))
            .filter((player) => player && player.name);
    });

    const gameType = normalizeGroupGameType(tournamentData.tournamentPlayoffGames);
    const group2Pairs = generateChampionsLeagueGroupPairs(groups2, gameType, { groupPhase: 2 });

    return {
        validation: { valid: true, message: '' },
        groups2,
        group2Pairs,
        qualifiers,
        gameType,
        groupCount: Object.keys(groups2).length
    };
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
    const validation = validateChampionsLeagueRegistration(
        playerList.length,
        tournamentData.maxPlayers,
        tournamentData.type
    );
    if (!validation.valid) {
        return { validation, groups: null, groupPairs: null, gameType: null, groupCount: 0 };
    }

    const gameType = normalizeGroupGameType(tournamentData.tournamentPlayoffGames);
    const groups = assignPlayersToGroups(playerList, { shuffle: options.shuffle !== false });
    const groupPhase = isChampionsLeagueTwoGroupType(tournamentData.type) ? 1 : undefined;
    const groupPairs = generateChampionsLeagueGroupPairs(groups, gameType, groupPhase ? { groupPhase } : {});

    return {
        validation,
        groups,
        groupPairs,
        gameType,
        groupCount: Object.keys(groups).length
    };
};

export const prepareChampionsLeagueFromDrawGrid = (grid, tournamentData, playerList) => {
    const validation = validateChampionsLeagueRegistration(
        playerList.length,
        tournamentData.maxPlayers,
        tournamentData.type
    );
    if (!validation.valid) {
        return { validation, groups: null, groupPairs: null, gameType: null, groupCount: 0 };
    }

    const gameType = normalizeGroupGameType(tournamentData.tournamentPlayoffGames);
    const groups = buildGroupsFromDrawGrid(grid, playerList);
    const groupPhase = isChampionsLeagueTwoGroupType(tournamentData.type) ? 1 : undefined;
    const groupPairs = generateChampionsLeagueGroupPairs(groups, gameType, groupPhase ? { groupPhase } : {});

    return {
        validation,
        groups,
        groupPairs,
        gameType,
        groupCount: Object.keys(groups).length
    };
};
