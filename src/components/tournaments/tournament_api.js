export const shuffleArray = (_, playoffsGames, tournamentPlayoffGamesFinal, playersRatings, tournamentPlayers) => {
    // setShuffledNames([...uniquePlayerNames]);

    const shuffledArray = !tournamentPlayers ? [...shuffledNames] : [];
    const remainingPlayers = !tournamentPlayers ? maxPlayers.length - shuffledNames.length : +tournamentPlayers;

    // Check if there are remaining spots and add players as TBD
    if (remainingPlayers > 0 && !tournamentPlayers) {
        for (let i = 0; i < remainingPlayers; i++) {
            shuffledArray.push('TBD');
        }
    } else {
        for (let i = 0; i < tournamentPlayers; i++) {
            shuffledArray.push('TBD');
        }
    }

    console.log('shuffledArray: ', shuffledArray);

    for (let i = shuffledArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
    }
    let shuffledNames = [...shuffledArray]; // Update the state with the shuffled array

    // setPlayoffPairs([...shuffledArray]);
    let playoffPairsDetermined = createPlayoffPairs(playoffsGames, tournamentPlayoffGamesFinal, shuffledNames, false);

    return playoffPairsDetermined;
};

const createPlayoffPairs = (playoffsGames, tournamentPlayoffGamesFinal, shuffledNames, playersRatings) => {
    const updatedPairs = [];

    // Get the player's rating using the nickname
    function getRating(name) {
        const player = Object.values(playersRatings).find((p) => p.name === name);
        return player ? player.ratings : null;
    }

    const updatedArray = shuffledNames.map((name) => ({
        name,
        stars: getRating(name)
    }));

    let stageLabels = setStageLabels(shuffledNames.length);
    let gamesPerStage = {
        '1/32 Final': 32,
        '1/16 Final': 16,
        '1/8 Final': 8,
        'Quarter-final': 4,
        'Semi-final': 2,
        'Third Place': 1,
        Final: 1
    };

    stageLabels.forEach((stage, index) => {
        const numGames = gamesPerStage[stage];
        const pairs = [];
        let typeOfGame = playoffsGames;
        for (let i = 0; i < numGames; i++) {
            let games = [];
            let team1 = 'TBD';
            let score1 = 0;
            let team2 = 'TBD';
            let score2 = 0;
            let stars1 = null;
            let stars2 = null;

            if (index === 0) {
                team1 = updatedArray[i * 2].name || 'TBD';
                stars1 = updatedArray[i * 2].stars || 'TBD';
                team2 = updatedArray[i * 2 + 1].name || 'TBD';
                stars2 = updatedArray[i * 2 + 1].stars || 'TBD';
            } else {
                const prevStagePairs = updatedPairs[index - 1];
                team1 = prevStagePairs[i * 2]?.winner || 'TBD';
                team2 = prevStagePairs[i * 2 + 1]?.winner || 'TBD';
            }
            if (playoffsGames >= 1) {
                //final
                if (index === stageLabels.length - 2) {
                    for (let j = 0; j < tournamentPlayoffGamesFinal - 1; j++) {
                        typeOfGame = tournamentPlayoffGamesFinal;

                        // Add your game properties here
                        games.push({
                            castle1: '',
                            castle2: '',
                            castleWinner: '',
                            gameId: j,
                            gameWinner: '',
                            gameStatus: 'Not Started'
                        });
                    }
                } else {
                    for (let j = 0; j < playoffsGames; j++) {
                        // Add your game properties here
                        games.push({
                            castle1: '',
                            castle2: '',
                            castleWinner: '',
                            gameId: j,
                            gameWinner: '',
                            gameStatus: 'Not Started'
                        });
                    }
                }
            }
            pairs.push({
                team1,
                team2,
                stars1,
                stars2,
                score1,
                score2,
                type: `bo-${typeOfGame}`,
                gameStatus: 'Not Started',
                games: games
            });
        }

        console.log('pairs', pairs);

        updatedPairs.push(pairs);
    });

    return updatedPairs;
};

export function setStageLabels(maxPlayers) {
    let labels = [];
    // let gamesPerStageData = {};

    if (+maxPlayers === 4) {
        labels = ['Semi-final', 'Third Place', 'Final'];
    } else if (+maxPlayers === 8) {
        labels = ['Quarter-final', 'Semi-final', 'Third Place', 'Final'];
    } else if (+maxPlayers === 16) {
        labels = ['1/8 Final', 'Quarter-final', 'Semi-final', 'Third Place', 'Final'];
    } else if (+maxPlayers === 32) {
        labels = ['1/16 Final', '1/8 Final', 'Quarter-final', 'Semi-final', 'Third Place', 'Final'];
    }

    return labels;
}
