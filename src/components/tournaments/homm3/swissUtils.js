export const MIN_SWISS_PLAYERS = 4;

export const calculateSwissTotalRounds = (playerCount) => {
    const count = Math.max(2, Number(playerCount) || 2);
    return Math.ceil(Math.log2(count));
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
    const playerNames = swissPlayers.map((player) => player.name.trim());
    const standings = computeScheduleStandings(existingPairs, playerNames);

    const scoreGroups = [];
    standings.forEach((entry) => {
        const lastGroup = scoreGroups[scoreGroups.length - 1];
        if (lastGroup && lastGroup.score === entry.points) {
            lastGroup.players.push(entry.name);
        } else {
            scoreGroups.push({ score: entry.points, players: [entry.name] });
        }
    });

    playerNames.forEach((name) => {
        if (!standings.some((entry) => entry.name === name)) {
            const lastGroup = scoreGroups[scoreGroups.length - 1];
            if (lastGroup && lastGroup.score === 0) {
                lastGroup.players.push(name);
            } else {
                scoreGroups.push({ score: 0, players: [name] });
            }
        }
    });

    const newPairs = [];
    const playerByName = new Map(swissPlayers.map((player) => [player.name.trim(), player]));
    const hasReceivedBye = (name) =>
        existingPairs.some((pair) => pair.isBye && (pair.team1 === name || pair.team2 === name));
    let floatedPlayers = [];

    scoreGroups.forEach(({ players }, groupIndex) => {
        const remaining = [...floatedPlayers, ...players];
        floatedPlayers = [];
        const isLastGroup = groupIndex === scoreGroups.length - 1;

        if (remaining.length % 2 !== 0) {
            if (isLastGroup) {
                let byeIndex = -1;
                for (let i = remaining.length - 1; i >= 0; i--) {
                    if (!hasReceivedBye(remaining[i])) {
                        byeIndex = i;
                        break;
                    }
                }
                const [byeName] = remaining.splice(byeIndex >= 0 ? byeIndex : remaining.length - 1, 1);
                const byePlayer = playerByName.get(byeName);
                if (byePlayer) {
                    newPairs.push(createByePair(byePlayer, nextRound, gameType, 'Swiss'));
                }
            } else {
                floatedPlayers = [remaining.pop()];
            }
        }

        while (remaining.length >= 2) {
            const playerName = remaining.shift();
            let opponentIndex = remaining.findIndex(
                (candidate) => !hasPlayedBefore(existingPairs, playerName, candidate)
            );
            if (opponentIndex === -1) {
                opponentIndex = 0;
            }
            const opponentName = remaining.splice(opponentIndex, 1)[0];
            const player = playerByName.get(playerName);
            const opponent = playerByName.get(opponentName);
            if (player && opponent) {
                newPairs.push(createScheduleMatchPair(player, opponent, nextRound, gameType, 'Swiss'));
            }
        }
    });

    return newPairs;
};
