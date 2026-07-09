export const MIN_SWISS_PLAYERS = 4;
export const CS_SWISS_SIZES = [8, 16];
export const MIN_CS_SWISS_PLAYERS = CS_SWISS_SIZES[0];
export const CS_SWISS_WIN_TARGET = 3;
export const CS_SWISS_LOSS_LIMIT = 3;
export const SWISS_ROUND_DEADLINE_DAYS = 3;

export const compareCsSwissStandings = (a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name);

export const isCsSwissSize = (playerCount) => CS_SWISS_SIZES.includes(Number(playerCount));

export const calculateSwissTotalRounds = (playerCount) => {
    const count = Math.max(2, Number(playerCount) || 2);
    return Math.ceil(Math.log2(count));
};

export const createSwissRoundDeadline = (baseDate = new Date()) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + SWISS_ROUND_DEADLINE_DAYS);
    return date.toISOString();
};

export const normalizeGameType = (rawType) => {
    const normalized = String(rawType ?? '')
        .toLowerCase()
        .trim();
    if (normalized === 'bo-5' || normalized === '5' || normalized === 'bo5') {
        return 'bo-5';
    }
    if (normalized === 'bo-3' || normalized === '3' || normalized === 'bo3') {
        return 'bo-3';
    }
    if (normalized === 'bo-2' || normalized === '2' || normalized === 'bo2') {
        return 'bo-2';
    }
    return 'bo-1';
};

export const getGamesPerMatch = (gameType) => {
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

export const getPlayerRating = (player) => {
    if (!player?.ratings) {
        return '0';
    }
    if (typeof player.ratings === 'string' && player.ratings.includes(',')) {
        return player.ratings.split(',').pop().trim();
    }
    return String(player.ratings);
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

export const isPlaceholderPlayer = (name) => !name || name === 'TBD' || name === 'BYE';

const normalizeSwissPlayers = (playerList = []) =>
    playerList
        .map((player) => (typeof player === 'string' ? { name: player } : player))
        .filter((player) => player && !isPlaceholderPlayer(String(player.name || '').trim()));

export const computeScheduleStandings = (pairs, registeredPlayers = []) => {
    const map = {};
    registeredPlayers.forEach((name) => {
        if (!isPlaceholderPlayer(name)) {
            map[name] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        }
    });

    pairs.forEach((pair) => {
        if (!isPlaceholderPlayer(pair.team1) && !map[pair.team1]) {
            map[pair.team1] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        }
        if (!isPlaceholderPlayer(pair.team2) && !map[pair.team2]) {
            map[pair.team2] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        }

        if (!pair.winner || pair.winner === 'TBD') {
            return;
        }

        if (pair.isBye || pair.team2 === 'BYE') {
            map[pair.team1].played++;
            map[pair.team1].wins++;
            map[pair.team1].points += 3;
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

        const pts = pair.type === 'bo-2' ? 2 : calcWinPoints(pair, pair.winner);
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
        .filter(([name]) => !isPlaceholderPlayer(name))
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
};

export const hasPlayedBefore = (pairs, playerA, playerB) =>
    pairs.some(
        (pair) =>
            !pair.isBye &&
            ((pair.team1 === playerA && pair.team2 === playerB) || (pair.team1 === playerB && pair.team2 === playerA))
    );

export const isSwissRoundComplete = (pairs, round) => {
    const roundPairs = pairs.filter((pair) => Number(pair.round) === Number(round));
    return roundPairs.length > 0 && roundPairs.every((pair) => pair.winner);
};

export const createScheduleMatchPair = (player1, player2, round, gameType, stage) => {
    const numGames = getGamesPerMatch(gameType);
    const games = Array.from({ length: numGames }, (_, idx) => ({
        castle1: '',
        castle2: '',
        castleWinner: '',
        gameId: idx,
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

    return {
        gameStatus: 'Not Started',
        games,
        ratings1: getPlayerRating(player1),
        ratings2: getPlayerRating(player2),
        round,
        score1: 0,
        score2: 0,
        stage,
        stars1: player1?.stars || 0,
        stars2: player2?.stars || 0,
        team1: player1.name,
        team2: player2.name,
        type: gameType,
        winner: null,
        color1: 'red',
        color2: 'blue'
    };
};

export const createByePair = (player, round, gameType, stage) => ({
    ...createScheduleMatchPair(player, { name: 'BYE', ratings: '0', stars: 0 }, round, gameType, stage),
    team2: 'BYE',
    winner: player.name,
    gameStatus: 'Processed',
    isBye: true,
    score1: 1,
    score2: 0
});

export const repairSwissByePairs = (pairs = [], playerList = [], gameType = 'bo-1') => {
    const swissPlayers = normalizeSwissPlayers(playerList);
    const realPlayerCount = swissPlayers.length;
    if (realPlayerCount === 0) {
        return { pairs, repaired: false };
    }

    const playerByName = new Map(swissPlayers.map((player) => [String(player.name).trim(), player]));
    const allowedByesPerRound = realPlayerCount % 2 === 0 ? 0 : 1;
    const byesByRound = new Map();

    pairs.forEach((pair, index) => {
        if (!pair || (!pair.isBye && pair.team2 !== 'BYE')) {
            return;
        }
        const round = Number(pair.round) || 1;
        const roundByes = byesByRound.get(round) || [];
        roundByes.push({ pair, index });
        byesByRound.set(round, roundByes);
    });

    const repairIndexes = new Set();
    const replacementsByFirstIndex = new Map();

    byesByRound.forEach((roundByes, round) => {
        if (roundByes.length <= allowedByesPerRound) {
            return;
        }

        const byesToRepair = roundByes.slice(0, roundByes.length - allowedByesPerRound);
        const replacements = [];

        for (let i = 0; i + 1 < byesToRepair.length; i += 2) {
            const firstBye = byesToRepair[i].pair;
            const secondBye = byesToRepair[i + 1].pair;
            const firstPlayer = playerByName.get(firstBye.team1) || {
                name: firstBye.team1,
                ratings: firstBye.ratings1,
                stars: firstBye.stars1
            };
            const secondPlayer = playerByName.get(secondBye.team1) || {
                name: secondBye.team1,
                ratings: secondBye.ratings1,
                stars: secondBye.stars1
            };

            replacements.push(
                createScheduleMatchPair(
                    firstPlayer,
                    secondPlayer,
                    round,
                    normalizeGameType(firstBye.type || secondBye.type || gameType),
                    firstBye.stage || secondBye.stage || 'Swiss'
                )
            );
        }

        if (replacements.length === 0) {
            return;
        }

        byesToRepair.slice(0, replacements.length * 2).forEach(({ index }) => repairIndexes.add(index));
        replacementsByFirstIndex.set(byesToRepair[0].index, replacements);
    });

    if (repairIndexes.size === 0) {
        return { pairs, repaired: false };
    }

    const repairedPairs = [];
    pairs.forEach((pair, index) => {
        const replacements = replacementsByFirstIndex.get(index);
        if (replacements) {
            repairedPairs.push(...replacements);
        }
        if (!repairIndexes.has(index)) {
            repairedPairs.push(pair);
        }
    });

    return { pairs: repairedPairs, repaired: true };
};

const createEmptyGames = (gameType) =>
    Array.from({ length: getGamesPerMatch(gameType) }, (_, idx) => ({
        castle1: '',
        castle2: '',
        castleWinner: '',
        gameId: idx,
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

const createEmptyKnockoutPair = (stage, gameType) => ({
    gameStatus: 'Not Started',
    games: createEmptyGames(gameType),
    ratings1: null,
    ratings2: null,
    score1: 0,
    score2: 0,
    stage,
    stars1: null,
    stars2: null,
    team1: 'TBD',
    team2: 'TBD',
    type: gameType,
    winner: null,
    color1: 'red',
    color2: 'blue'
});

export const computeCsSwissStandings = (
    pairs,
    playerList = [],
    winTarget = CS_SWISS_WIN_TARGET,
    lossLimit = CS_SWISS_LOSS_LIMIT
) => {
    const players = normalizeSwissPlayers(playerList);
    const map = {};
    players.forEach((player) => {
        const name = String(player.name).trim();
        map[name] = { name, played: 0, wins: 0, losses: 0, draws: 0, record: '0-0', swissStatus: 'active' };
    });

    pairs.forEach((pair) => {
        if (!pair?.winner || pair.winner === 'TBD') {
            return;
        }

        const team1 = pair.team1;
        const team2 = pair.team2;
        if (!isPlaceholderPlayer(team1) && !map[team1]) {
            map[team1] = { name: team1, played: 0, wins: 0, losses: 0, draws: 0 };
        }
        if (!isPlaceholderPlayer(team2) && !map[team2]) {
            map[team2] = { name: team2, played: 0, wins: 0, losses: 0, draws: 0 };
        }

        if (pair.isBye || team2 === 'BYE') {
            map[team1].played++;
            map[team1].wins++;
            return;
        }

        if (pair.winner === 'draw') {
            map[team1].played++;
            map[team2].played++;
            map[team1].draws++;
            map[team2].draws++;
            return;
        }

        const loser = pair.winner === team1 ? team2 : team1;
        map[pair.winner].played++;
        map[pair.winner].wins++;
        map[loser].played++;
        map[loser].losses++;
    });

    return Object.values(map)
        .filter((entry) => !isPlaceholderPlayer(entry.name))
        .map((entry) => {
            const record = `${entry.wins || 0}-${entry.losses || 0}`;
            const swissStatus =
                (entry.wins || 0) >= winTarget
                    ? 'qualified'
                    : (entry.losses || 0) >= lossLimit
                      ? 'eliminated'
                      : 'active';
            return {
                ...entry,
                record,
                swissStatus,
                qualificationRecord: swissStatus === 'qualified' ? record : null
            };
        })
        .sort(compareCsSwissStandings);
};

export const isCsSwissComplete = (
    pairs,
    playerList,
    winTarget = CS_SWISS_WIN_TARGET,
    lossLimit = CS_SWISS_LOSS_LIMIT
) => computeCsSwissStandings(pairs, playerList, winTarget, lossLimit).every((entry) => entry.swissStatus !== 'active');

export const generateNextCsSwissRoundPairings = (
    playerList,
    existingPairs,
    nextRound,
    gameType,
    winTarget = CS_SWISS_WIN_TARGET,
    lossLimit = CS_SWISS_LOSS_LIMIT
) => {
    const players = normalizeSwissPlayers(playerList);
    const playerByName = new Map(players.map((player) => [String(player.name).trim(), player]));
    const active = computeCsSwissStandings(existingPairs, players, winTarget, lossLimit).filter(
        (entry) => entry.swissStatus === 'active'
    );
    const buckets = new Map();
    active.forEach((entry) => {
        const bucket = buckets.get(entry.record) || [];
        bucket.push(entry.name);
        buckets.set(entry.record, bucket);
    });

    const ordered = [...buckets.entries()]
        .sort(([recordA], [recordB]) => {
            const [winsA, lossesA] = recordA.split('-').map(Number);
            const [winsB, lossesB] = recordB.split('-').map(Number);
            return winsB - winsA || lossesA - lossesB;
        })
        .flatMap(([, names]) => names);

    const pairs = [];
    const paired = new Set();
    const findOpponent = (playerName, startIndex, allowRematch = false) => {
        for (let index = startIndex; index < ordered.length; index++) {
            const candidate = ordered[index];
            if (paired.has(candidate) || candidate === playerName) {
                continue;
            }
            if (!allowRematch && hasPlayedBefore(existingPairs, playerName, candidate)) {
                continue;
            }
            return candidate;
        }
        return null;
    };

    ordered.forEach((playerName, index) => {
        if (paired.has(playerName)) {
            return;
        }

        const player = playerByName.get(playerName);
        if (!player) {
            return;
        }

        const opponentName = findOpponent(playerName, index + 1, false) || findOpponent(playerName, index + 1, true);
        if (!opponentName) {
            pairs.push(createByePair(player, nextRound, gameType, 'CS Swiss'));
            paired.add(playerName);
            return;
        }

        const opponent = playerByName.get(opponentName);
        pairs.push(createScheduleMatchPair(player, opponent, nextRound, gameType, 'CS Swiss'));
        paired.add(playerName);
        paired.add(opponentName);
    });

    return pairs;
};

export const generateCsSwissPlayoffStages = (
    swissPairs,
    playerList,
    gameType = 'bo-1',
    winTarget = CS_SWISS_WIN_TARGET,
    lossLimit = CS_SWISS_LOSS_LIMIT
) => {
    const players = normalizeSwissPlayers(playerList);
    const playerByName = new Map(players.map((player) => [String(player.name).trim(), player]));
    const qualified = computeCsSwissStandings(swissPairs, players, winTarget, lossLimit).filter(
        (entry) => entry.swissStatus === 'qualified'
    );
    const directSemi = qualified.filter((entry) => entry.record === `${winTarget}-0`);

    const qualifiers = [
        ...directSemi,
        ...qualified
            .filter((entry) => entry.record !== `${winTarget}-0`)
            .sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name))
    ];

    if (!isCsSwissSize(players.length) || qualifiers.length !== players.length / 2) {
        return {
            valid: false,
            message: `CS Swiss playoffs support ${CS_SWISS_SIZES.join(' or ')} players with half the field qualified.`
        };
    }

    const getPlayer = (entry) => playerByName.get(entry.name) || { name: entry.name, ratings: '0', stars: 0 };
    const seeds = qualifiers;

    if (players.length === 8) {
        return {
            valid: true,
            stages: [
                [
                    createScheduleMatchPair(getPlayer(seeds[0]), getPlayer(seeds[3]), 1, gameType, 'Semi-final'),
                    createScheduleMatchPair(getPlayer(seeds[1]), getPlayer(seeds[2]), 1, gameType, 'Semi-final')
                ],
                [createEmptyKnockoutPair('Third Place', gameType)],
                [createEmptyKnockoutPair('Final', gameType)]
            ],
            stageLabels: ['Semi-final', 'Third Place', 'Final']
        };
    }

    const quarterFinals = [
        createScheduleMatchPair(getPlayer(seeds[0]), getPlayer(seeds[7]), 1, gameType, 'Quarter-final'),
        createScheduleMatchPair(getPlayer(seeds[3]), getPlayer(seeds[4]), 1, gameType, 'Quarter-final'),
        createScheduleMatchPair(getPlayer(seeds[1]), getPlayer(seeds[6]), 1, gameType, 'Quarter-final'),
        createScheduleMatchPair(getPlayer(seeds[2]), getPlayer(seeds[5]), 1, gameType, 'Quarter-final')
    ];
    const semiFinals = [
        createEmptyKnockoutPair('Semi-final', gameType),
        createEmptyKnockoutPair('Semi-final', gameType)
    ];

    return {
        valid: true,
        stages: [
            quarterFinals,
            semiFinals,
            [createEmptyKnockoutPair('Third Place', gameType)],
            [createEmptyKnockoutPair('Final', gameType)]
        ],
        stageLabels: ['Quarter-final', 'Semi-final', 'Third Place', 'Final']
    };
};

const shuffleList = (items) => {
    const list = [...items];
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
};

export const generateSwissRound1Pairings = (playerList, gameType) => {
    const shuffled = shuffleList(normalizeSwissPlayers(playerList));
    const pairs = [];

    for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
            pairs.push(createScheduleMatchPair(shuffled[i], shuffled[i + 1], 1, gameType, 'Swiss'));
        } else {
            pairs.push(createByePair(shuffled[i], 1, gameType, 'Swiss'));
        }
    }

    return pairs;
};

export const generateNextSwissRoundPairings = (playerList, existingPairs, nextRound, gameType) => {
    const swissPlayers = normalizeSwissPlayers(playerList);
    const playerNames = swissPlayers.map((player) => String(player.name).trim());
    const standings = computeScheduleStandings(existingPairs, playerNames);
    const ordered = standings.map((entry) => entry.name);
    playerNames.forEach((name) => {
        if (!ordered.includes(name)) {
            ordered.push(name);
        }
    });

    const paired = new Set();
    const newPairs = [];

    const findOpponent = (player, startIndex, allowRematch = false) => {
        for (let j = startIndex; j < ordered.length; j++) {
            const candidate = ordered[j];
            if (paired.has(candidate) || candidate === player) {
                continue;
            }
            if (!allowRematch && hasPlayedBefore(existingPairs, player, candidate)) {
                continue;
            }
            return candidate;
        }
        return null;
    };

    for (let i = 0; i < ordered.length; i++) {
        const playerName = ordered[i];
        if (paired.has(playerName)) {
            continue;
        }

        let opponentName = findOpponent(playerName, i + 1, false);
        if (!opponentName) {
            opponentName = findOpponent(playerName, i + 1, true);
        }

        const player = swissPlayers.find((entry) => entry.name === playerName);
        if (!player) {
            continue;
        }

        if (opponentName) {
            const opponent = swissPlayers.find((entry) => entry.name === opponentName);
            newPairs.push(createScheduleMatchPair(player, opponent, nextRound, gameType, 'Swiss'));
            paired.add(playerName);
            paired.add(opponentName);
            continue;
        }

        newPairs.push(createByePair(player, nextRound, gameType, 'Swiss'));
        paired.add(playerName);
    }

    return newPairs;
};
