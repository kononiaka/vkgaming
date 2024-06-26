import { useEffect, useState } from 'react';
import {
    addScoreToUser,
    getNewRating,
    getPlayerPrizeTotal,
    loadUserById,
    lookForCastleStats,
    lookForTournamentName,
    lookForUserId,
    lookForUserPrevScore,
    pullTournamentPrizes
} from '../../../api/api';
import { PlayerBracket } from './PlayerBracket/PlayerBracket';
import classes from './tournamentsBracket.module.css';
const formatPlayerName = (player) => player.name;

const uniquePlayerNames = [];
const currentStageIndex = 0;
let SHOULD_POSTING = true;
let isManualScore = false;

export const TournamentBracket = ({ maxPlayers, tournamentId, tournamentStatus, tournamentWinner }) => {
    // console.log('tournamentId', tournamentId);
    // console.log('maxPlayers', maxPlayers);
    // maxPlayers.length = 8;
    // maxPlayers.length = Object.keys(maxPlayers).length;
    // console.log('tournamentWinner', tournamentWinner);

    const [stageLabels, setStageLabels] = useState([]);
    const [gamesPerStage, setGamesPerStage] = useState({});
    const [shuffledNames, setShuffledNames] = useState([]);
    const [playoffPairs, setPlayoffPairs] = useState([]);
    const [startTournament, setStartTournament] = useState(false);
    const [startButton, setStartButton] = useState(false);
    const [isUpdateButtonVisible, setUpdateButtonVisible] = useState(true);
    let BO3_DEFAULT;
    let tournamentName;

    // Determine the stage label based on the number of max players

    //TODO when there is a winner move him to the prior stage
    useEffect(() => {
        let labels = [];
        // let gamesPerStageData = {};

        if (maxPlayers && Object.keys(maxPlayers).length === 4) {
            labels = ['Semi-final', 'Third Place', 'Final', 'Winner'];
        } else if (maxPlayers && Object.keys(maxPlayers).length === 8) {
            labels = ['Quater-final', 'Semi-final', 'Third Place', 'Final', 'Winner'];
        } else if (maxPlayers && Object.keys(maxPlayers).length === 16) {
            labels = ['1/8 Final', 'Quater-final', 'Semi-final', 'Third Place', 'Final', 'Winner'];
        } else if (maxPlayers && Object.keys(maxPlayers).length === 32) {
            labels = ['1/16 Final', '1/8 Final', 'Quater-final', 'Semi-final', 'Third Place', 'Final', 'Winner'];
        }

        setStageLabels(labels);

        if (tournamentStatus === 'Tournament Finished') {
            setUpdateButtonVisible(false);
        }

        setGamesPerStage({
            '1/32 Final': 32,
            '1/16 Final': 16,
            '1/8 Final': 8,
            'Quater-final': 4,
            'Semi-final': 2,
            'Third Place': 1,
            Final: 1
        });

        const fetchPlayoffPairs = async () => {
            try {
                // console.log('tournamentId', tournamentId);
                const tournamentResponse = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/.json`
                );

                if (tournamentResponse.ok) {
                    const data = await tournamentResponse.json();
                    const registeredPlayer = Object.values(data.players).length.toString();
                    const tournamentPlayers = data.maxPlayers;

                    if (registeredPlayer === tournamentPlayers && data.status !== 'Registration finished!') {
                        setStartButton(true);
                    }
                }
                const bracketResponse = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`
                );

                if (bracketResponse.ok) {
                    const data = await bracketResponse.json();
                    if (data) {
                        // Parse the object
                        const valuesArray = Object.values(data);
                        let playoffPairsDetermined = data?.playoffPairs;
                        if (!playoffPairsDetermined) {
                            playoffPairsDetermined = valuesArray[0].playoffPairs;
                        }
                        setPlayoffPairs(playoffPairsDetermined);
                    }
                } else {
                    console.log('Failed to fetch playoff pairs');
                }
            } catch (error) {
                console.error('Error fetching playoff pairs:', error);
            }
        };

        fetchPlayoffPairs();

        let shuffled = shufflePlayers([...uniquePlayerNames]);
        setShuffledNames(shuffled);
    }, [maxPlayers, uniquePlayerNames]);

    // Shuffle the array using Fisher-Yates algorithm
    // useEffect(() => {

    // }, []);

    const shufflePlayers = (array) => {
        const shuffledArray = [...array];

        for (let i = shuffledArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
        }

        return shuffledArray;
    };

    const shuffleArray = (_, playoffsGames, tournamentPlayoffGamesFinal) => {
        // setShuffledNames([...uniquePlayerNames]);

        const shuffledArray = [...shuffledNames];
        const remainingPlayers = maxPlayers.length - shuffledNames.length;

        // Check if there are remaining spots and add players as TBD
        if (remainingPlayers > 0) {
            for (let i = 0; i < remainingPlayers; i++) {
                shuffledArray.push('TBD');
            }
        }

        for (let i = shuffledArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
        }
        setShuffledNames([...shuffledArray]); // Update the state with the shuffled array
        setPlayoffPairs([...shuffledArray]);
        let playoffPairsDetermined = createPlayoffPairs(playoffsGames, tournamentPlayoffGamesFinal);

        return playoffPairsDetermined;
    };

    // useEffect(() => {

    // }, []);

    const createPlayoffPairs = (playoffsGames, tournamentPlayoffGamesFinal) => {
        const updatedPairs = [];
        stageLabels.forEach((stage, index) => {
            const numGames = gamesPerStage[stage];
            const pairs = [];
            for (let i = 0; i < numGames; i++) {
                let games = [];
                let team1 = 'TBD';
                let score1 = 0;
                let team2 = 'TBD';
                let score2 = 0;

                if (index === 0) {
                    team1 = shuffledNames[i * 2] || 'TBD';
                    team2 = shuffledNames[i * 2 + 1] || 'TBD';
                } else {
                    const prevStagePairs = updatedPairs[index - 1];
                    team1 = prevStagePairs[i * 2]?.winner || 'TBD';
                    team2 = prevStagePairs[i * 2 + 1]?.winner || 'TBD';
                }
                if (playoffsGames > 1) {
                    //final
                    if (index === stageLabels.length - 2) {
                        for (let j = 0; j < tournamentPlayoffGamesFinal - 1; j++) {
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
                        for (let j = 0; j < playoffsGames - 1; j++) {
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
                    score1,
                    score2,
                    type: `bo-${playoffsGames}`,
                    gameStatus: 'Not Started',
                    games: playoffsGames > 1 ? games : null
                });
            }

            console.log('pairs', pairs);

            updatedPairs.push(pairs);
        });

        setPlayoffPairs(updatedPairs);
        return updatedPairs;
    };
    // [stageLabels, gamesPerStage, shuffledNames]);

    // useEffect(() => {
    //     shuffleArray(uniquePlayerNames);
    // }, []);

    const getWinner = (pair) => {
        const score1 = pair.type === 'bo-3' ? parseInt(pair.score1) : parseInt(pair.score1) || 0;
        const score2 = pair.type === 'bo-3' ? parseInt(pair.score2) : parseInt(pair.score2) || 0;

        if (pair.type === 'bo-3') {
            if (+score1 > +score2) {
                pair.winner = pair.team1;
                if (score2 === 0 && pair.games) {
                    pair.games.forEach((game, index) => {
                        pair.games[index].gameWinner = game.team1;
                        pair.games[index].castleWinner = game.castle1;
                    });
                }
            } else if (+score1 < +score2) {
                if (+score1 === 0 && pair.games) {
                    console.log('pair.games', pair.games);

                    pair.games.forEach((game, index) => {
                        pair.games[index].gameWinner = game.team2;
                        pair.games[index].castleWinner = game.castle2;
                    });
                }
                pair.winner = pair.team2;
            } else {
                pair.winner = 'Tie';
            }
        } else if (pair.type === 'bo-1') {
            if (+score1 > +score2) {
                pair.winner = pair.team1;
                pair.gameWinner = pair.castle1;
            } else if (+score1 < +score2) {
                pair.winner = pair.team2;
                pair.gameWinner = pair.castle1;
            } else {
                return 'Tie';
            }
        }
        // pair.gameStatus = pair.gameStatus !== 'Finished' ? 'Finished' : 'Not Started';

        if (pair.winner && pair.gameStatus !== 'Processed') {
            if (pair.type === 'bo-3') {
                let results = ['2-0', '2-1', '1-2', '0-2'];
                let combinedScore = `${score1}-${score2}`;

                if (results.includes(combinedScore)) {
                    pair.gameStatus = 'Finished';
                }
            } else {
                pair.gameStatus = 'Finished';
            }
        }
    };

    const handleStartTournament = async () => {
        const tournamentResponse = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/.json`,
            {
                method: 'GET'
            }
        );
        if (tournamentResponse.ok) {
            const data = await tournamentResponse.json();
            const playoffsGames = data.tournamentPlayoffGames;
            const tournamentPlayoffGamesFinal = data.tournamentPlayoffGamesFinal;

            setStartTournament(true);
            // Prepare the tournament data
            let readyBracket = shuffleArray(uniquePlayerNames, playoffsGames, tournamentPlayoffGamesFinal);

            const tournamentData = {
                stageLabels: stageLabels,
                playoffPairs: readyBracket,
                status: 'Registration finished!'
            };

            try {
                const response = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/.json`,
                    {
                        method: 'PATCH',
                        body: JSON.stringify({
                            bracket: tournamentData,
                            status: 'Registration finished!'
                        }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (response.ok) {
                    console.log('Pairs posted to Firebase successfully');
                } else {
                    console.log('Failed to post pairs to Firebase');
                }
            } catch (error) {
                console.error('Error posting pairs to Firebase:', error);
            }
        }
        window.location.reload();
    };

    const updateTournament = async () => {
        const tournamentData = {
            playoffPairs: playoffPairs
        };

        // console.log('tournamentData', tournamentData);

        const tournamentResponse = await lookForTournamentName(tournamentId);
        tournamentName = tournamentResponse.name;

        try {
            //TODO: check if the playoffPairs is equal to the DB object => do nothing
            const response = await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`,
                {
                    method: 'PUT',
                    body: JSON.stringify(tournamentData),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.ok) {
                //TODO: Could this be ommit?
                const retrievedWinners = await retrieveWinnersFromDatabase();

                //TODO: check if the quantity of winners are the same => doing nothing
                const tournamentDataWithWinners = {
                    playoffPairs: retrievedWinners
                };

                //TODO: if the tournamentDate is the same as the tournamentDataWithWinners
                const isSame = JSON.stringify(tournamentData) === JSON.stringify(tournamentDataWithWinners);

                //TODO: why do we need to PUT it the second time
                let winnerBracket = {};
                if (SHOULD_POSTING) {
                    winnerBracket = await fetch(
                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`,
                        {
                            method: 'PUT',
                            body: JSON.stringify(tournamentDataWithWinners),
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                } else {
                    winnerBracket.ok = true;
                }

                if (winnerBracket.ok) {
                    let place;
                    let prizeAmount;
                    const lastStage = retrievedWinners[retrievedWinners.length - 1];
                    const firstPlace = lastStage[lastStage.length - 1] ? lastStage[lastStage.length - 1].winner : null;

                    const secondPlace = firstPlace
                        ? firstPlace === lastStage[lastStage.length - 1].team1
                            ? lastStage[lastStage.length - 1].team2
                            : lastStage[lastStage.length - 1].team1
                        : undefined;

                    // TODO: why we can't put the third place here as well?

                    if (firstPlace) {
                        let prizes = await pullTournamentPrizes(tournamentId);
                        const winnersData = await fetch(
                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/.json`
                        );

                        if (winnersData.ok) {
                            const existingData = await winnersData.json();

                            existingData['1st place'] = firstPlace;
                            existingData['2nd place'] = secondPlace;

                            let firstPlaceId = await lookForUserId(firstPlace);
                            let secondPlaceId = await lookForUserId(secondPlace);

                            let firstPlaceRecord = await loadUserById(firstPlaceId);
                            let secondPlaceRecord = await loadUserById(secondPlaceId);
                            let winnersResponse = {};

                            if (SHOULD_POSTING) {
                                winnersResponse = await fetch(
                                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/.json`,
                                    {
                                        method: 'PUT',
                                        body: JSON.stringify(existingData),
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    }
                                );
                            } else {
                                winnersResponse.ok = true;
                            }
                            if (winnersResponse.ok) {
                                let tournamentStatusResponse = {};
                                if (SHOULD_POSTING) {
                                    tournamentStatusResponse = await fetch(
                                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/status.json`,
                                        {
                                            method: 'PUT',
                                            body: JSON.stringify('Tournament Finished'),
                                            headers: {
                                                'Content-Type': 'application/json'
                                            }
                                        }
                                    );
                                } else {
                                    tournamentStatusResponse.ok = true;
                                }
                                if (tournamentStatusResponse.ok) {
                                    setUpdateButtonVisible(false);

                                    if (tournamentStatusResponse.ok) {
                                        if (!firstPlaceRecord || typeof firstPlaceRecord.prizes !== 'object') {
                                            console.log('1ST PLACE PRIZE WAS DETERMINED', prizeAmount);
                                            // If not, initialize "prizes" as an object
                                            firstPlaceRecord.prizes = [];
                                        }
                                        place = '1st Place';
                                        prizeAmount = prizes[place];
                                        let firstPriceTotal = await getPlayerPrizeTotal(firstPlaceId);
                                        firstPlaceRecord.totalPrize = +firstPriceTotal + +prizeAmount;

                                        firstPlaceRecord.prizes.push({
                                            tournamentName: tournamentResponse.name,
                                            place: place,
                                            prizeAmount: prizeAmount
                                        });

                                        // console.log('place', place);
                                        let firstPlaceResponse = {};
                                        if (SHOULD_POSTING) {
                                            firstPlaceResponse = await fetch(
                                                `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${firstPlaceId}.json`,
                                                {
                                                    method: 'PUT',
                                                    headers: {
                                                        'Content-Type': 'application/json'
                                                    },
                                                    body: JSON.stringify(firstPlaceRecord)
                                                }
                                            );
                                        } else {
                                            firstPlaceResponse.ok = true;
                                        }
                                        if (firstPlaceResponse.ok) {
                                            if (!secondPlaceRecord || typeof secondPlaceRecord.prizes !== 'object') {
                                                secondPlaceRecord.prizes = [];
                                            }
                                            place = '2nd Place';
                                            prizeAmount = prizes[place];
                                            let secondPriceTotal = await getPlayerPrizeTotal(secondPlaceId);
                                            secondPlaceRecord.totalPrize = +secondPriceTotal + +prizeAmount;

                                            secondPlaceRecord.prizes.push({
                                                tournamentName: tournamentResponse.name,
                                                place: place,
                                                prizeAmount: prizeAmount
                                            });
                                            let secondPlaceResponse = {};

                                            if (SHOULD_POSTING) {
                                                secondPlaceResponse = await fetch(
                                                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${secondPlaceId}.json`,
                                                    {
                                                        method: 'PUT',
                                                        headers: {
                                                            'Content-Type': 'application/json'
                                                        },
                                                        body: JSON.stringify(secondPlaceRecord)
                                                    }
                                                );
                                            } else {
                                                secondPlaceResponse.ok = true;
                                            }
                                            if (secondPlaceResponse.ok) {
                                                console.log('PRIZES FOR THE USERS WERE UPDATED SUCCESSFULLY');
                                            }
                                        }
                                    }
                                }
                            } else {
                                const errorMessage = await winnersResponse.text();
                                console.error('Error:', winnersResponse.status, errorMessage);
                            }
                        }
                    }
                }

                await processFinishedGames(playoffPairs);

                console.log('Pairs posted to Firebase successfully');
                // window.location.reload();
            } else {
                console.log('Failed to post pairs to Firebase');
            }
        } catch (error) {
            console.log('Error posting pairs to Firebase:', error);
        }
    };

    const retrieveWinnersFromDatabase = async () => {
        try {
            const response = await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`
            );

            if (response.ok) {
                const data = await response.json();

                let collectedPlayoffPairs = data?.playoffPairs || [];

                let nextStagePairings;
                let nextStageIndex = 0;

                for (let currentStage = 0; currentStage < collectedPlayoffPairs.length - 1; currentStage++) {
                    let currentStagePlayoffPairs = collectedPlayoffPairs[currentStage];
                    let currentStagePlayoffWinners = currentStagePlayoffPairs
                        .map((pair) => pair.winner)
                        .filter((pair) => pair !== undefined || pair === 'TBD');

                    nextStageIndex = currentStage + 1;
                    let nextStagePlayoffPairs = collectedPlayoffPairs[nextStageIndex];

                    let thirdPlaceWinner;
                    if (currentStage === 2) {
                        thirdPlaceWinner = collectedPlayoffPairs[currentStage][0].winner;
                    }
                    const nextStagePlayoffWinners = nextStagePlayoffPairs.map((pair) => pair.winner);
                    const hasUndefinedTeam = nextStagePlayoffPairs.some(
                        (pair) => pair.team1 === 'TBD' || pair.team2 === 'TBD'
                    );

                    if (nextStagePlayoffWinners.includes(undefined) && !thirdPlaceWinner) {
                        if (nextStageIndex === 2) {
                            const losers = currentStagePlayoffPairs.map((match) =>
                                match.winner === match.team1
                                    ? match.team2
                                    : match.winner === match.team2
                                    ? match.team1
                                    : 'TBD'
                            );
                            let thirdPlacePairing = determineNextStagePairings(losers);
                            if (currentStagePlayoffWinners.length > 0) {
                                nextStagePairings = determineNextStagePairings(
                                    currentStagePlayoffWinners,
                                    currentStage
                                );
                                collectedPlayoffPairs[nextStageIndex + 1] = nextStagePairings;
                                collectedPlayoffPairs[nextStageIndex] = thirdPlacePairing;
                            }
                        } else {
                            if (hasUndefinedTeam) {
                                if (currentStagePlayoffWinners.length > 0) {
                                    nextStagePairings = determineNextStagePairings(
                                        currentStagePlayoffWinners,
                                        currentStage,
                                        thirdPlaceWinner
                                    );
                                    collectedPlayoffPairs[nextStageIndex] = nextStagePairings;
                                }
                            }
                        }
                    }
                }

                //TODO: This should be in a mutual function determinePrizeWinner
                determineThirdPlaceWinner(collectedPlayoffPairs, stageLabels);
                setPlayoffPairs(collectedPlayoffPairs);
                return collectedPlayoffPairs;
            } else {
                console.log('Failed to retrieve winners from the database');
            }
        } catch (error) {
            console.error('Error retrieving winners from the database:', error);
        }
    };

    const processFinishedGames = async (collectedPlayoffPairs) => {
        let finishedPairs = [];

        collectedPlayoffPairs.forEach((pair) => {
            pair.forEach((pairDetails) => {
                if (pairDetails.gameStatus !== 'Processed') {
                    let fullResult = `${pairDetails.score1}-${pairDetails.score2}`;
                    if (pairDetails.type === 'bo-3') {
                        let results = ['2-0', '2-1', '1-2', '0-2'];

                        if (results.includes(fullResult)) {
                            pairDetails.gameStatus = 'Finished';
                            finishedPairs.push(pairDetails);
                        } else {
                            results = ['1-0', '1-1', '0-1'];
                            if (results.includes(fullResult)) {
                                pairDetails.gameStatus = 'In Progress';
                                finishedPairs.push(pairDetails);
                            }
                        }
                    }
                }
            });
        });

        //TODO: implement the gameStatus. If the gameWinner exists determine game as finished
        let { castle1, castle2, gameWinner, score1, score2, team1, team2, winner, type } = finishedPairs[0];
        const opponent1Id = await lookForUserId(team1);
        const opponent2Id = await lookForUserId(team2);

        let games;
        //TODO: could this be ommit?
        if (finishedPairs[0].type === 'bo-3') {
            games = {
                opponent1: team1,
                opponent2: team2,
                date: new Date(),
                games: finishedPairs[0].games,
                // gameName: gameName,
                tournamentName: tournamentName,
                gameType: type,
                opponent1Castle: castle1,
                opponent2Castle: castle2,
                score: `${score1}-${score2}`,
                winner: winner
            };
        } else {
            games = {
                opponent1: team1,
                opponent2: team2,
                date: new Date(),
                // gameName: gameName,
                tournamentName: tournamentName, //TODO: tournamentName is null here
                gameType: type,
                opponent1Castle: castle1,
                opponent2Castle: castle2,
                score: `${score1}-${score2}`,
                winner: winner
            };
        }
        let gameResponse = {};
        if (SHOULD_POSTING) {
            gameResponse = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3.json', {
                method: 'POST',
                body: JSON.stringify(games),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            await gameResponse.json();
        }
        let winnerId;
        let winnerCastle;
        let lostCastle;
        let needUpdate = false;
        if (finishedPairs[0].type === 'bo-3') {
            finishedPairs[0].games.forEach((game) => {
                console.log('game', game);
                if (game.gameWinner) {
                    if (team1 === game.gameWinner) {
                        winnerId = opponent1Id;
                        winnerCastle = game.castle1;
                        lostCastle = game.castle2;
                    } else if (team2 === game.gameWinner) {
                        winnerId = opponent2Id;
                        winnerCastle = game.castle2;
                        lostCastle = game.castle1;
                    }
                    game.gameStatus = 'Queued';
                    needUpdate = true;
                }

                if (
                    // SHOULD_POSTING &&
                    game.gameStatus === 'Queued'
                ) {
                    let firstCastleResponse = lookForCastleStats(winnerCastle, 'win');
                    let secondCastleResponse = lookForCastleStats(lostCastle, 'lost');

                    if (firstCastleResponse && secondCastleResponse) {
                        game.gameStatus = 'Finished';
                    }
                }
            });
        } else {
            if (team1 === winner) {
                winnerId = opponent1Id;
                winnerCastle = castle1;
                lostCastle = castle2;
            } else if (team2 === winner) {
                winnerId = opponent2Id;
                winnerCastle = castle2;
                lostCastle = castle1;
            }
            //TODO: check if gamesStatus is finished.
            // if (SHOULD_POSTING) {
            lookForCastleStats(winnerCastle, 'win');
            lookForCastleStats(lostCastle, 'lost');
            // }
        }

        //TODO: finishedPairs need to be injected into collectedPlayoffPairs and then PUT

        // if (SHOULD_POSTING && needUpdate) {
        //     let response = await fetch(
        //         `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`,
        //         {
        //             method: 'PUT',
        //             body: JSON.stringify(finishedPairs),
        //             headers: {
        //                 'Content-Type': 'application/json'
        //             }
        //         }
        //     );
        //     await response.json();
        // }

        //TODO: check if all of the games has gameStatus of finished => then process player's rate
        const opponent1PrevData = await lookForUserPrevScore(opponent1Id);
        const opponent2PrevData = await lookForUserPrevScore(opponent2Id);

        const didWinOpponent1 = winnerId === opponent1Id;
        const didWinOpponent2 = winnerId === opponent2Id;

        let opponent1Score = await getNewRating(opponent1PrevData.ratings, opponent2PrevData.ratings, didWinOpponent1);
        let opponent2Score = await getNewRating(opponent2PrevData.ratings, opponent1PrevData.ratings, didWinOpponent2);
        if (SHOULD_POSTING) {
            await addScoreToUser(opponent1Id, opponent1PrevData, opponent1Score, winnerId);
            await addScoreToUser(opponent2Id, opponent2PrevData, opponent2Score, winnerId);
        }
        //TODO: if player's score was updated => set gameStatus to processed
        finishedPairs[0].gameStatus = 'Processed';

        setPlayoffPairs(finishedPairs);

        //TODO:post the setPlayoffPairs(finishedPairs);
        let responseFinishedPair = {};
        // if (SHOULD_POSTING) {
        //     responseFinishedPair = await fetch(
        //         `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`,
        //         {
        //             method: 'PUT',
        //             body: JSON.stringify(finishedPairs),
        //             headers: {
        //                 'Content-Type': 'application/json'
        //             }
        //         }
        //     );
        // } else {
        //     responseFinishedPair.ok = true;
        // }
        // if (responseFinishedPair.ok) {
        //     console.log('Finished pairs successfully');
        // }

        // setPlayoffPairs(finishedPairs);

        return finishedPairs;
    };

    const determineThirdPlaceWinner = async (playOffPairs, stages) => {
        //TODO tournamentName to add
        let place = '3rd Place';
        let prizes = await pullTournamentPrizes(tournamentId);
        const prizeAmount = prizes[place];

        const thirdPlaceIndex = stages.indexOf('Third Place');
        const thirdPlace = playOffPairs[thirdPlaceIndex];
        if (thirdPlace[0].winner) {
            let winner = thirdPlace[0].winner;
            if (winner) {
                let userId = await lookForUserId(winner);
                let userRecord = await loadUserById(userId);

                let thirdPriceTotal = await getPlayerPrizeTotal(userId);

                userRecord.totalPrize = +thirdPriceTotal + +prizeAmount;

                if (!userRecord || typeof userRecord.prizes !== 'object') {
                    // If not, initialize "prizes" as an object
                    userRecord.prizes = [];
                }

                userRecord.prizes.push({
                    tournamentName: tournamentName,
                    place: place,
                    prizeAmount: prizeAmount
                });

                const response = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/3rd place.json`,
                    {
                        method: 'GET'
                    }
                );
                const data = await response.json();

                if (response.ok && data === 'TBD') {
                    let response = {};
                    if (SHOULD_POSTING) {
                        response = await fetch(
                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/3rd place.json`,
                            {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(winner)
                            }
                        );
                    } else {
                        response.ok = true;
                    }

                    let responseUser = {};
                    if (response.ok) {
                        if (SHOULD_POSTING) {
                            responseUser = await fetch(
                                `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`,
                                {
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify(userRecord)
                                }
                            );
                        } else {
                            responseUser.ok = true;
                        }

                        if (responseUser.ok) {
                            console.log('USER RECORD THIRD PLACE WAS UPDATED:', userId);
                        }
                    }
                }
            } else {
                console.error('FAILED TO UPDATE USER FOR THE THIRD PLACE:');
            }
        }
    };

    // Example functions for processing winners and updating the next stage pairings in the database
    const determineNextStagePairings = (winners, currentStage, thirdPlaceWinner) => {
        const nextPairings = [];

        // Iterate through the winners array and create pairings for the next stage
        for (let i = 0; i < winners.length; i += 2) {
            const pair = {
                team1: winners[i] || 'TBD',
                team2: winners[i + 1] || 'TBD',
                score1: undefined,
                score2: undefined
            };

            nextPairings.push(pair);
        }

        return nextPairings;
    };

    const handleScoreChange = (stageName, pairIndex, teamIndex, newScore) => {
        const stageMappings = {
            'Quater-final': 0,
            'Semi-final': 1,
            'Third Place': 2,
            Final: 3
            // Add more stages and their numerical values as needed
        };

        // Map the stage name to a numerical stage value
        const stage = stageMappings[stageName]; // Convert to lowercase for case-insensitive matching

        if (stage === undefined) {
            // Handle the case where an invalid stage name is provided
            console.error(`Invalid stage name: ${stageName}`);
            return;
        }

        setPlayoffPairs((prevPairs) => {
            const updatedPairs = [...prevPairs];
            const pair = updatedPairs[stage][pairIndex];

            if (teamIndex === 1) {
                pair.score1 = newScore;
            } else if (teamIndex === 2) {
                pair.score2 = newScore;
            }

            if (pair.score1 && pair.score2) {
                getWinner(pair);
            }
            return updatedPairs;
        });
    };

    return (
        <div className={`scrollable-list-class brackets-class`}>
            {startButton && !startTournament && tournamentStatus !== 'Tournament Finished' && (
                <button onClick={handleStartTournament}>Start Tournament</button>
            )}
            {startTournament && <button onClick={() => shuffleArray(uniquePlayerNames)}>Shuffle</button>}
            {!startTournament && isUpdateButtonVisible && (
                <button id="update-tournament" onClick={() => updateTournament()}>
                    Update Tournament
                </button>
            )}
            {stageLabels.length === 0 ? (
                <h6>Tournament registration hasn't started</h6>
            ) : (
                <>
                    {!startTournament &&
                        stageLabels.map(function (stage, stageIndex) {
                            return (
                                <div
                                    key={stage}
                                    className={`${classes.brackets} ${
                                        stageIndex === currentStageIndex ? classes.active : ''
                                    }`}
                                >
                                    <h3 style={{ color: 'red' }}>Stage: {stage}</h3>
                                    {stage === 'Winner' && tournamentWinner && (
                                        <p style={{ color: 'yellow' }}>{tournamentWinner}</p>
                                    )}
                                    {playoffPairs[stageIndex]?.map((pair, pairIndex) => {
                                        // console.log('pair-map', pair);
                                        const { team1, team2, score1, score2, winner, castle1, castle2, type } = pair;
                                        const hasTruthyPlayers = (team1 && team2 && team1 !== 'TBD') || team2 !== 'TBD';

                                        if (type === 'bo-3' && pair.games) {
                                            BO3_DEFAULT = [
                                                {
                                                    gameId: 1,
                                                    castle1: pair.games[0].castle1 ? pair.games[0].castle1 : null,
                                                    castle2: pair.games[0].castle2 ? pair.games[0].castle2 : null,
                                                    gameWinner: pair.games[0].gameWinner
                                                        ? pair.games[0].gameWinner
                                                        : null,
                                                    castleWinner: pair.games[0].castleWinner
                                                        ? pair.games[0].castleWinner
                                                        : null
                                                },
                                                {
                                                    gameId: 2,
                                                    castle1: pair.games[1].castle1 ? pair.games[1].castle1 : null,
                                                    castle2: pair.games[1].castle2 ? pair.games[1].castle2 : null,
                                                    gameWinner: pair.games[1].gameWinner
                                                        ? pair.games[1].gameWinner
                                                        : null,
                                                    castleWinner: pair.games[1].castleWinner
                                                        ? pair.games[1].castleWinner
                                                        : null
                                                }
                                            ];
                                        } else {
                                            BO3_DEFAULT = {
                                                gameId: 1,
                                                castle1: castle1,
                                                castle2: castle2,
                                                gameWinner: null
                                            };
                                        }
                                        return (
                                            <div
                                                key={pairIndex}
                                                // style={{ position: 'relative' }}
                                            >
                                                {stage !== 'Third Place' && stage !== 'Final' && (
                                                    <p>{`Match ${pairIndex + 1}`}</p>
                                                )}
                                                <p>{`Best of ${stage === 'Final' ? 3 : 1}`}</p>
                                                <div>Date:</div>
                                                <PlayerBracket
                                                    pair={pair}
                                                    team={'team1'}
                                                    pairIndex={pairIndex}
                                                    hasTruthyPlayers={hasTruthyPlayers}
                                                    stageIndex={stageIndex}
                                                    setPlayoffPairs={setPlayoffPairs}
                                                    handleCastleChange={handleCastleChange}
                                                    handleScoreChange={handleScoreChange}
                                                    handleBlur={handleBlur}
                                                    handleRadioChange={handleRadioChange}
                                                    stage={stage}
                                                    teamIndex={1}
                                                    getWinner={getWinner}
                                                    isManualScore={isManualScore}
                                                />
                                                <PlayerBracket
                                                    pair={pair}
                                                    team={'team2'}
                                                    pairIndex={pairIndex}
                                                    hasTruthyPlayers={hasTruthyPlayers}
                                                    stageIndex={stageIndex}
                                                    setPlayoffPairs={setPlayoffPairs}
                                                    handleCastleChange={handleCastleChange}
                                                    handleScoreChange={handleScoreChange}
                                                    handleBlur={handleBlur}
                                                    handleRadioChange={handleRadioChange}
                                                    stage={stage}
                                                    teamIndex={2}
                                                    getWinner={getWinner}
                                                    isManualScore={isManualScore}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                </>
            )}
        </div>
    );
};

const handleBlur = (stageName, pairIndex, setPlayoffPairs) => {
    const stageMappings = {
        'Quater-final': 0,
        'Semi-final': 1,
        'Third Place': 2,
        Final: 3
        // Add more stages and their numerical values as needed
    };

    // Map the stage name to a numerical stage value
    const stage = stageMappings[stageName]; // Convert to lowercase for case-insensitive matching

    if (stage === undefined) {
        // Handle the case where an invalid stage name is provided
        console.error(`Invalid stage name: ${stageName}`);
        return;
    }

    setPlayoffPairs((prevPairs) => {
        const updatedPairs = [...prevPairs];
        const pair = updatedPairs[stage][pairIndex];

        console.log('pair', pair);

        if (
            (pair.score1 && pair.score2 && `${pair.score1}-${pair.score2}` === '2-0') ||
            `${pair.score1}-${pair.score2}` === '0-2' ||
            +pair.score1 + +pair.score2 === 3
        ) {
            // if (+pair.score1 + +pair.score2 === 3) {
            pair.totalGames = +pair.score1 + +pair.score2;
            // }
        } else {
            if (pair.score1 && pair.score2) {
                console.log('score', `${pair.score1}-${pair.score2}` === '0-2');
            }
        }

        console.log('updatedPairs', updatedPairs);
        return updatedPairs;
    });
};

function handleCastleChange(stageIndex, pairIndex, teamIndex, castleName, setPlayoffPairs, totalGames, index) {
    setPlayoffPairs((prevPairs) => {
        const updatedPairs = [...prevPairs];
        const pair = updatedPairs[stageIndex][pairIndex];

        if (totalGames.length > 1) {
            pair.games = pair.games ? pair.games : totalGames;

            if (teamIndex === 1) {
                pair.games[index].castle1 = castleName;
                // pair.castle1 = castleName;
            } else if (teamIndex === 2) {
                pair.games[index].castle2 = castleName;
                // pair.castle2 = castleName;
            }

            if (pair.games[index].castle2 && pair.games[index].castle1 && !pair.games[index].castleWinner) {
                console.log('CHANGED', pair.games[index].gameStatus);
                pair.games[index].gameStatus = 'In Progress';
            }
        } else {
            if (teamIndex === 1) {
                pair.castle1 = castleName;
            } else if (teamIndex === 2) {
                pair.castle2 = castleName;
            }

            if (pair.castle2 && pair.castle1 && !pair.castleWinner) {
                pair.gameStatus = 'In Progress';
            }
        }

        return updatedPairs;
    });
}

function handleRadioChange(gameId, teamIndex, value, setPlayoffPairs, stageIndex, pairIndex, getWinner) {
    setPlayoffPairs((prevPairs) => {
        const updatedPairs = [...prevPairs];
        const pair = updatedPairs[stageIndex][pairIndex];
        const game = pair.games[gameId];

        const radioButton1 = document.getElementById(`radio-${gameId}-${1}`);
        const radioButton2 = document.getElementById(`radio-${gameId}-${2}`);
        const radioButtonValue1 = radioButton1.checked;
        const radioButtonValue2 = radioButton2.checked;
        //TODO: check if game.gameWinner set correclty
        if (game.gameStatus !== 'Processed') {
            if (teamIndex === 1 && value === 'on' && game.castle1) {
                game.castleWinner = game.castle1;
                game.gameWinner = pair.team1;
                pair.score1 = pair.score1 + 1;

                if (pair.score2 > 0 && (radioButtonValue1 || radioButtonValue2) && !game.gameWinner) {
                    pair.score2 = pair.score2 - 1;
                }
                game.gameStatus = 'Finished';
                isManualScore = true;
            } else {
                if (teamIndex === 2 && value === 'on' && game.castle2) {
                    game.castleWinner = game.castle2;
                    game.gameWinner = pair.team2;
                    pair.score2 = pair.score2 + 1;
                    if (pair.score1 > 0 && (radioButtonValue1 || radioButtonValue2) && !game.gameWinner) {
                        pair.score1 = pair.score1 - 1;
                    }
                    game.gameStatus = 'Finished';
                }
                isManualScore = true;
            }
            if (pair.score1 + pair.score2 >= 2) {
                getWinner(pair);
            }
        }
        return updatedPairs;
    });
}

export const renderPlayerList = (players) => {
    const playerNames = Object.values(players)
        .filter((player) => player !== null && player.name !== undefined && player.name.trim() !== '')
        .map((player) => player.name);

    playerNames.forEach((name) => {
        if (!uniquePlayerNames.includes(name) && name) {
            uniquePlayerNames.push(name);
        }
    });

    return (
        <>
            <h4>Players:</h4>
            <ul>
                {playerNames.map(function (name, index) {
                    return <li key={index}>{formatPlayerName({ name })}</li>;
                })}
            </ul>
        </>
    );
};
