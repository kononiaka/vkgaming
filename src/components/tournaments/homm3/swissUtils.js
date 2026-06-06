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

export const computeScheduleStandings = (pairs, registeredPlayers = []) => {
    const map = {};
    registeredPlayers.forEach((name) => {
        if (name) {
            map[name] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        }
    });

    pairs.forEach((pair) => {
        if (pair.team1 && pair.team1 !== 'TBD' && pair.team1 !== 'BYE' && !map[pair.team1]) {
            map[pair.team1] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        }
        if (pair.team2 && pair.team2 !== 'TBD' && pair.team2 !== 'BYE' && !map[pair.team2]) {
            map[pair.team2] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        }

        if (!pair.winner || pair.winner === 'TBD') {
            return;
        }

        if (pair.isBye) {
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
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
};

export const hasPlayedBefore = (pairs, playerA, playerB) =>
    pairs.some(
        (pair) =>
            !pair.isBye &&
            ((pair.team1 === playerA && pair.team2 === playerB) ||
                (pair.team1 === playerB && pair.team2 === playerA))
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

const shuffleList = (items) => {
    const list = [...items];
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
};

export const generateSwissRound1Pairings = (playerList, gameType) => {
    const shuffled = shuffleList(playerList);
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
    const playerNames = playerList.map((player) => player.name);
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

        const player = playerList.find((entry) => entry.name === playerName);
        if (!player) {
            continue;
        }

        if (opponentName) {
            const opponent = playerList.find((entry) => entry.name === opponentName);
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
