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

    const shuffleArray = () => {
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
        let playoffPairsDetermined = createPlayoffPairs();

        return playoffPairsDetermined;
    };

    // useEffect(() => {

    // }, []);

    const createPlayoffPairs = () => {
        const updatedPairs = [];
        stageLabels.forEach((stage, index) => {
            const numGames = gamesPerStage[stage];
            const pairs = [];

            for (let i = 0; i < numGames; i++) {
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

                pairs.push({ team1, team2, score1, score2, type: 'bo-1', gameStatus: 'Not Started' });
            }

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
                        pair.games[index].gameWinner = game.castle1;
                    });
                }
            } else if (+score1 < +score2) {
                if (+score1 === 0 && pair.games) {
                    console.log('pair.games', pair.games);

                    pair.games.forEach((game, index) => {
                        pair.games[index].gameWinner = game.castle2;
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
        setStartTournament(true);
        // Prepare the tournament data
        let readyBracket = shuffleArray(uniquePlayerNames);

        const tournamentData = {
            stageLabels: stageLabels,
            playoffPairs: readyBracket
            // status: 'Registration finished!'
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
    };

    const updateTournament = async () => {
        const tournamentData = {
            playoffPairs: playoffPairs
        };

        // console.log('tournamentData', tournamentData);

        const tournamentResponse = await lookForTournamentName(tournamentId);
        tournamentName = tournamentResponse.name;

        try {
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
                const retrievedWinners = await retrieveWinnersFromDatabase();

                //TOOD: check if the quantity of winners are the same => doing nothing
                const tournamentDataWithWinners = {
                    playoffPairs: retrievedWinners
                };

                //TODO: if the tournamentDate is the same as the tournamentDataWithWinners
                const isSame = JSON.stringify(tournamentData) === JSON.stringify(tournamentDataWithWinners);

                const winnerBracket = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify(tournamentDataWithWinners),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

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

                    if (firstPlace) {
                        let prizes = await pullTournamentPrizes(tournamentId);
                        // console.log('prizes', prizes);
                        const winnersData = await fetch(
                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/.json`
                        );

                        if (winnersData.ok) {
                            const existingData = await winnersData.json();

                            // Modify the '1st place' and '2nd place' fields
                            existingData['1st place'] = firstPlace;
                            existingData['2nd place'] = secondPlace;

                            let firstPlaceId = await lookForUserId(firstPlace);
                            let secondPlaceId = await lookForUserId(secondPlace);

                            let firstPlaceRecord = await loadUserById(firstPlaceId);
                            let secondPlaceRecord = await loadUserById(secondPlaceId);

                            const winnersResponse = await fetch(
                                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/.json`,
                                {
                                    method: 'PUT',
                                    body: JSON.stringify(existingData),
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                }
                            );
                            if (winnersResponse.ok) {
                                const tournamentStatusResponse = await fetch(
                                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/status.json`,
                                    {
                                        method: 'PUT',
                                        body: JSON.stringify('Tournament Finished'),
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    }
                                );
                                if (tournamentStatusResponse.ok) {
                                    setUpdateButtonVisible(false);

                                    if (tournamentStatusResponse.ok) {
                                        if (!firstPlaceRecord || typeof firstPlaceRecord.prizes !== 'object') {
                                            console.log('prizeAmount-1st', prizeAmount);
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
                                        const firstPlaceResponse = await fetch(
                                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${firstPlaceId}.json`,
                                            {
                                                method: 'PUT',
                                                headers: {
                                                    'Content-Type': 'application/json'
                                                },
                                                body: JSON.stringify(firstPlaceRecord)
                                            }
                                        );
                                        if (firstPlaceResponse.ok) {
                                            // console.log('secondPlaceRecord', JSON.stringify(secondPlaceRecord));
                                            if (!secondPlaceRecord || typeof secondPlaceRecord.prizes !== 'object') {
                                                // If not, initialize "prizes" as an object
                                                console.log('prizeAmount-2nd', prizeAmount);
                                                secondPlaceRecord.prizes = [];
                                            }
                                            place = '2nd Place';
                                            prizeAmount = prizes[place];
                                            let secondPriceTotal = await getPlayerPrizeTotal(secondPlaceId);
                                            // console.log('secondPriceTotal', secondPriceTotal);
                                            secondPlaceRecord.totalPrize = +secondPriceTotal + +prizeAmount;

                                            secondPlaceRecord.prizes.push({
                                                tournamentName: tournamentResponse.name,
                                                place: place,
                                                prizeAmount: prizeAmount
                                            });

                                            const secondPlaceResponse = await fetch(
                                                `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${secondPlaceId}.json`,
                                                {
                                                    method: 'PUT',
                                                    headers: {
                                                        'Content-Type': 'application/json'
                                                    },
                                                    body: JSON.stringify(secondPlaceRecord)
                                                }
                                            );
                                            if (secondPlaceResponse.ok) {
                                                console.log('updated finished');
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
                window.location.reload();
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

                //TODO: if the winner is not in the next stage => set it!
                //TODO: if all the brackets have winners => do nothing!

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

                    //TODO: if no score for both pplayers set get to not started

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
                                console.log('hasUndefinedTeam', hasUndefinedTeam);
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

                //TODO: check if the two winners in the stage === 2
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
                console.log('pairDetails', pairDetails);
                if (pairDetails.gameType === 'bo-3') {
                    let results = ['2-0', '2-1', '1-2', '0-2'];

                    let fullResult = pairDetails.score1 + pairDetails.score2;
                    if (results.includes(fullResult)) {
                        pairDetails.gameStatus = 'Finished';
                    }
                }
                console.log('pairDetails-after', pairDetails);
                if (pairDetails.gameStatus === 'Finished') {
                    //TODO: pairDetails.gameType (bo-1 or bo-3)
                    // if (pairDetails.gameType === 'bo-3') {

                    // }
                    finishedPairs.push(pairDetails);
                }
            });
        });

        let { castle1, castle2, gameWinner, score1, score2, team1, team2, winner, gameType } = finishedPairs[0];

        const opponent1Id = await lookForUserId(team1);
        console.log('opponent1Id', opponent1Id);
        const opponent2Id = await lookForUserId(team2);
        console.log('opponent2Id', opponent2Id);

        let games;
        if (finishedPairs[0].type === 'bo-3') {
            games = {
                opponent1: team1,
                opponent2: team2,
                date: new Date(),
                games: finishedPairs[0].games,
                // gameName: gameName,
                tournamentName: tournamentName,
                gameType: 'bo-3', //TODO: pairDetails.gameType
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
                gameType: 'bo-1', //TODO: pairDetails.gameType
                opponent1Castle: castle1,
                opponent2Castle: castle2,
                score: `${score1}-${score2}`,
                winner: winner
            };
        }

        const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3.json', {
            method: 'POST',
            body: JSON.stringify(games),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        await response.json();
        let winnerId;
        let winnerCastle;
        let lostCastle;

        if (finishedPairs[0].type === 'bo-3') {
            finishedPairs[0].games.forEach((game) => {
                if (team1 === game.gameWinner) {
                    winnerId = opponent1Id;
                    winnerCastle = game.castle1;
                    lostCastle = game.castle2;
                } else if (team2 === game.gameWinner) {
                    winnerId = opponent2Id;
                    winnerCastle = game.castle2;
                    lostCastle = game.castle1;
                }
                lookForCastleStats(winnerCastle, 'win');
                lookForCastleStats(lostCastle, 'lost');
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
            lookForCastleStats(winnerCastle, 'win');
            lookForCastleStats(lostCastle, 'lost');
        }

        const opponent1PrevData = await lookForUserPrevScore(opponent1Id);
        const opponent2PrevData = await lookForUserPrevScore(opponent2Id);

        const didWinOpponent1 = winnerId === opponent1Id;
        const didWinOpponent2 = winnerId === opponent2Id;

        let opponent1Score = await getNewRating(opponent1PrevData.ratings, opponent2PrevData.ratings, didWinOpponent1);
        let opponent2Score = await getNewRating(opponent2PrevData.ratings, opponent1PrevData.ratings, didWinOpponent2);

        await addScoreToUser(opponent1Id, opponent1PrevData, opponent1Score, winnerId);
        await addScoreToUser(opponent2Id, opponent2PrevData, opponent2Score, winnerId);

        finishedPairs[0].gameStatus = 'Processed';

        setPlayoffPairs(finishedPairs);

        //TODO:post the setPlayoffPairs(finishedPairs);

        // const responseFinishedPair = await fetch(
        //     `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`,
        //     {
        //         method: 'PUT',
        //         body: JSON.stringify(finishedPairs),
        //         headers: {
        //             'Content-Type': 'application/json'
        //         }
        //     }
        // );

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

                // Check if "prizes" property exists and is an object
                if (!userRecord || typeof userRecord.prizes !== 'object') {
                    // If not, initialize "prizes" as an object
                    userRecord.prizes = [];
                }

                userRecord.prizes.push({
                    tournamentName: tournamentName,
                    place: place,
                    prizeAmount: prizeAmount
                });

                console.log('tournamentId', tournamentId);

                //TODO thirdplace
                const response = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/3rd place.json`,
                    {
                        method: 'GET'
                    }
                );
                const data = await response.json();
                console.log('thirdplace', data);
                if (response.ok && data === 'TBD') {
                    const response = await fetch(
                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/3rd place.json`,
                        {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(winner)
                        }
                    );
                    console.log('User data updated successfully with prizes.');
                    if (response.ok) {
                        const response = await fetch(
                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`,
                            {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(userRecord)
                            }
                        );
                        if (response.ok) {
                            console.log('userId', userId);
                            console.log('userRecord', userRecord);
                        }
                    }
                }
            } else {
                console.log('Failed to update user data with prizes.');
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
                                                    gameWinner: null
                                                },
                                                {
                                                    gameId: 2,
                                                    castle1: pair.games[1].castle1 ? pair.games[1].castle1 : null,
                                                    castle2: pair.games[1].castle2 ? pair.games[1].castle2 : null,
                                                    gameWinner: null
                                                }
                                            ];
                                            if (score1 && score2) {
                                                if (
                                                    +score1 + +score2 !== 3 &&
                                                    `${score1}-${score2}` !== '2-0' &&
                                                    `${score1}-${score2}` !== '0-2'
                                                ) {
                                                    alert('is not bo-3 result');
                                                } else if (+score1 + +score2 === 3) {
                                                    BO3_DEFAULT = [
                                                        {
                                                            gameId: 1,
                                                            castle1: pair.games[0].castle1
                                                                ? pair.games[0].castle1
                                                                : null,
                                                            castle2: pair.games[0].castle2
                                                                ? pair.games[0].castle2
                                                                : null,
                                                            gameWinner: null
                                                        },
                                                        {
                                                            gameId: 2,
                                                            castle1: pair.games[1].castle1
                                                                ? pair.games[1].castle1
                                                                : null,
                                                            castle2: pair.games[1].castle2
                                                                ? pair.games[1].castle2
                                                                : null,
                                                            gameWinner: null
                                                        },
                                                        {
                                                            gameId: 3,
                                                            castle1: pair.games[2].castle1
                                                                ? pair.games[2].castle1
                                                                : null,
                                                            castle2: pair.games[2].castle2
                                                                ? pair.games[2].castle2
                                                                : null,
                                                            gameWinner: null
                                                        }
                                                    ];
                                                }
                                            }
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
                                                    games={BO3_DEFAULT}
                                                    totalGames={pair.totalGames}
                                                    teamIndex={1}
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
                                                    games={BO3_DEFAULT}
                                                    totalGames={pair.totalGames}
                                                    teamIndex={2}
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
                alert('is not bo-3 result');
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
        } else {
            if (teamIndex === 1) {
                pair.castle1 = castleName;
            } else if (teamIndex === 2) {
                pair.castle2 = castleName;
            }
        }

        console.log('updatedPairs', updatedPairs);
        return updatedPairs;
    });
}

function handleRadioChange(gameId, teamIndex, value, setPlayoffPairs, stageIndex, pairIndex) {
    setPlayoffPairs((prevPairs) => {
        const updatedPairs = [...prevPairs];
        const pair = updatedPairs[stageIndex][pairIndex];
        const game = pair.games[gameId - 1];
        if (teamIndex === 1 && value === 'on' && game.castle1) {
            game.castleWinner = game.castle1;
            game.gameWinner = pair.team1;
        } else {
            if (teamIndex === 2 && value === 'on' && game.castle2) {
                game.castleWinner = game.castle2;
                game.gameWinner = pair.team2;
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
