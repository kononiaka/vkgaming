import { setStageLabels } from '../tournament_api';

export const DOUBLE_ELIM_SIZES = [4, 8, 16, 32];

export const isDoubleElimSize = (maxPlayers) => DOUBLE_ELIM_SIZES.includes(Number(maxPlayers));

const winnerStageLabels = (maxPlayers) =>
    setStageLabels(maxPlayers)
        .filter((label) => label !== 'Third Place')
        .map((label) => (label === 'Final' ? 'WB Final' : label));

const loserStageLabels = (maxPlayers) => {
    const size = Number(maxPlayers);
    const loserStageCount = Math.max(1, 2 * Math.log2(size) - 2);

    if (loserStageCount <= 1) {
        return ['LB Final'];
    }

    return [
        ...Array.from({ length: loserStageCount - 1 }, (_, index) => `LB R${index + 1}`),
        'LB Final'
    ];
};

export const getDoubleElimStageLabels = (maxPlayers) => [
    ...winnerStageLabels(maxPlayers),
    ...loserStageLabels(maxPlayers),
    'Grand Final'
];

const winnerPairsPerStage = (maxPlayers) => {
    const map = {
        '1/32 Final': 32,
        '1/16 Final': 16,
        '1/8 Final': 8,
        'Quarter-final': 4,
        'Semi-final': 2,
        'WB Final': 1
    };

    return winnerStageLabels(maxPlayers).map((label) => map[label] || 1);
};

const loserPairsPerStage = (maxPlayers) => {
    const size = Number(maxPlayers);
    const labels = loserStageLabels(size);
    const counts = [];
    let matches = size / 4;

    for (let index = 0; index < labels.length - 1; index++) {
        counts.push(matches);
        if (index % 2 === 1) {
            matches = Math.max(1, matches / 2);
        }
    }

    counts.push(1);
    return counts;
};

const createEmptyGames = (count) =>
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

const resolveGameCount = (stageName, playoffsGames, tournamentPlayoffGamesFinal) => {
    if (stageName === 'WB Final' || stageName === 'Grand Final') {
        return Number(tournamentPlayoffGamesFinal) || Number(playoffsGames) || 1;
    }
    return Number(playoffsGames) || 1;
};

const createEmptyPair = (stageName, playoffsGames, tournamentPlayoffGamesFinal, typeOfGame) => {
    const gameCount = resolveGameCount(stageName, playoffsGames, tournamentPlayoffGamesFinal);
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
        type: `bo-${typeOfGame}`,
        gameStatus: 'Not Started',
        games: createEmptyGames(gameCount),
        winner: null,
        color1: 'red',
        color2: 'blue',
        bracketSide: stageName.startsWith('LB') || stageName === 'Grand Final' ? 'losers' : 'winners'
    };
};

const normalizePlayers = (shuffledNames) =>
    shuffledNames.map((player) => ({
        name: typeof player === 'string' ? player : player?.name || 'TBD',
        ratings: typeof player === 'string' ? '0' : player?.ratings || '0',
        stars: typeof player === 'string' ? 0 : player?.stars || 0
    }));

export const createDoubleElimPlayoffPairs = (
    playoffsGames,
    tournamentPlayoffGamesFinal,
    shuffledNames,
    maxPlayers
) => {
    const labels = getDoubleElimStageLabels(maxPlayers);
    const winnerCounts = winnerPairsPerStage(maxPlayers);
    const loserCounts = loserPairsPerStage(maxPlayers);
    let players = shuffledNames ? normalizePlayers(shuffledNames) : [];
    if (players.length === 0) {
        players = Array.from({ length: Number(maxPlayers) || 0 }, () => ({
            name: 'TBD',
            ratings: '0',
            stars: 0
        }));
    }
    const stages = [];

    labels.forEach((stageName, stageIndex) => {
        const isWinnerStage = stageIndex < winnerCounts.length;
        const pairCount = isWinnerStage ? winnerCounts[stageIndex] : loserCounts[stageIndex - winnerCounts.length];
        const pairs = [];

        for (let pairIndex = 0; pairIndex < pairCount; pairIndex++) {
            const pair = createEmptyPair(stageName, playoffsGames, tournamentPlayoffGamesFinal, playoffsGames);

            if (stageIndex === 0) {
                const player1 = players[pairIndex * 2];
                const player2 = players[pairIndex * 2 + 1];
                pair.team1 = player1?.name || 'TBD';
                pair.team2 = player2?.name || 'TBD';
                pair.ratings1 = player1?.ratings || '0';
                pair.ratings2 = player2?.ratings || '0';
                pair.stars1 = player1?.stars || 0;
                pair.stars2 = player2?.stars || 0;
            }

            pairs.push(pair);
        }

        stages.push(pairs);
    });

    return stages;
};

const fillSlot = (pair, slot, playerName, rating, stars) => {
    if (!pair || !playerName || playerName === 'TBD') {
        return false;
    }

    if (pair[slot] === 'TBD' || !pair[slot]) {
        pair[slot] = playerName;
        pair[slot === 'team1' ? 'ratings1' : 'ratings2'] = rating ?? pair[slot === 'team1' ? 'ratings1' : 'ratings2'];
        pair[slot === 'team1' ? 'stars1' : 'stars2'] = stars ?? pair[slot === 'team1' ? 'stars1' : 'stars2'];
        return true;
    }

    return false;
};

export const dropLoserToBracket = ({
    updatedPairs,
    stageLabels,
    currentStage,
    pairIndex,
    loser,
    loserRating,
    loserStars,
    maxPlayers
}) => {
    if (!loser || loser === 'TBD' || !isDoubleElimSize(maxPlayers)) {
        return false;
    }

    const size = Number(maxPlayers);
    const lbR1Index = stageLabels.indexOf('LB R1');
    const lbR2Index = stageLabels.indexOf('LB R2');
    const lbFinalIndex = stageLabels.indexOf('LB Final');
    const wbFinalIndex = stageLabels.indexOf('WB Final');

    if (currentStage === 'Quarter-final' && lbR1Index !== -1) {
        const targetPairIndex = Math.floor(pairIndex / 2);
        const slot = pairIndex % 2 === 0 ? 'team1' : 'team2';
        return fillSlot(
            updatedPairs[lbR1Index]?.[targetPairIndex],
            slot,
            loser,
            loserRating,
            loserStars
        );
    }

    if (currentStage === 'Semi-final' && size === 4 && lbR1Index !== -1) {
        const slot = pairIndex === 0 ? 'team1' : 'team2';
        return fillSlot(updatedPairs[lbR1Index]?.[0], slot, loser, loserRating, loserStars);
    }

    if (currentStage === 'Semi-final' && lbR2Index !== -1) {
        const slot = 'team2';
        return fillSlot(updatedPairs[lbR2Index]?.[pairIndex], slot, loser, loserRating, loserStars);
    }

    if (currentStage === 'WB Final' && lbFinalIndex !== -1) {
        return fillSlot(updatedPairs[lbFinalIndex]?.[0], 'team2', loser, loserRating, loserStars);
    }

    if (currentStage === '1/8 Final' && lbR1Index !== -1) {
        const targetPairIndex = Math.floor(pairIndex / 2);
        const slot = pairIndex % 2 === 0 ? 'team1' : 'team2';
        return fillSlot(
            updatedPairs[lbR1Index]?.[targetPairIndex],
            slot,
            loser,
            loserRating,
            loserStars
        );
    }

    return false;
};

export const promoteLoserBracketWinner = ({
    updatedPairs,
    stageLabels,
    currentStage,
    pairIndex,
    winner,
    winnerRating,
    winnerStars,
    maxPlayers
}) => {
    if (!winner || winner === 'TBD' || !currentStage.startsWith('LB')) {
        return false;
    }

    const lbFinalIndex = stageLabels.indexOf('LB Final');
    const grandFinalIndex = stageLabels.indexOf('Grand Final');

    if (currentStage.startsWith('LB R')) {
        const roundNumber = Number(currentStage.replace('LB R', ''));
        const nextLabel = stageLabels.includes(`LB R${roundNumber + 1}`) ? `LB R${roundNumber + 1}` : 'LB Final';
        const nextIndex = stageLabels.indexOf(nextLabel);
        if (nextIndex === -1) {
            return false;
        }

        const targetPairIndex = nextLabel === 'LB Final' ? 0 : Math.floor(pairIndex / 2);
        const slot = nextLabel === 'LB Final' ? 'team1' : pairIndex % 2 === 0 ? 'team1' : 'team2';
        return fillSlot(
            updatedPairs[nextIndex]?.[targetPairIndex],
            slot,
            winner,
            winnerRating,
            winnerStars
        );
    }

    if (currentStage === 'LB Final' && grandFinalIndex !== -1) {
        return fillSlot(updatedPairs[grandFinalIndex]?.[0], 'team2', winner, winnerRating, winnerStars);
    }

    return false;
};
