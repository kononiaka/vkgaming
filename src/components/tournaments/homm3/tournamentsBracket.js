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
    pullTournamentPrizes,
    fetchCastlesList
} from '../../../api/api';
import { shuffleArray } from '../../tournaments/tournament_api';
import { PlayerBracket } from './PlayerBracket/PlayerBracket';
import StatsPopup from '../../StatsPopup/StatsPopup';
import { findByName } from '../../../api/api.js';
import SpinningWheel from '../../SpinningWheel/SpinningWheel';
import Modal from '../../Modal/Modal.js';
import classes from './tournamentsBracket.module.css';
const formatPlayerName = (player) => player.name;

const uniquePlayerNames = [];
const currentStageIndex = 0;
let SHOULD_POSTING = true;
let isManualScore = false;
let clickedRadioButton;
let playersObj = {};
let tournamentName = null;
let allPairsHaveTeams = null;

export const TournamentBracket = ({
    maxPlayers,
    tournamentId,
    tournamentStatus,
    tournamentWinners
    // tournamentNameParam
}) => {
    // console.log('tournamentNameParam', tournamentNameParam);
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
    const [showCastlesModal, setShowCastlesModal] = useState(false);
    const [availableCastles, setAvailableCastles] = useState([]);
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState(null);
    const [isSpinningWheelOpen, setIsSpinningWheelOpen] = useState(false);
    const [isTournamentBracketOpen, setIsTournamentBracketOpen] = useState(true); // State for tournament bracket visibility

    let BO3_DEFAULT;
    // let tournamentName;

    // Determine the stage label based on the number of max players

    //TODO when there is a winner move him to the prior stage
    useEffect(() => {
        let labels = [];
        // let gamesPerStageData = {};
        // console.log('maximum' + tournamentId, maxPlayers);
        const fetchData = async () => {
            const tournamentResponseName = await lookForTournamentName(tournamentId);
            // console.log('tournamentResponseName', JSON.stringify(tournamentResponseName));

            tournamentName = tournamentResponseName.name;
            // console.log('tournamentName: ' + tournamentName);
        };

        fetchData();

        // console.log('tournamentId', tournamentId);
        // console.log('Object.keys(maxPlayers)' + tournamentName, Object.keys(maxPlayers));
        // console.log('Object.keys(maxPlayers).length' + tournamentName, Object.keys(maxPlayers).length);

        if (+maxPlayers === 4) {
            labels = ['Semi-final', 'Third Place', 'Final'];
        } else if (+maxPlayers === 8) {
            labels = ['Quarter-final', 'Semi-final', 'Third Place', 'Final'];
        } else if (+maxPlayers === 16) {
            labels = ['1/8 Final', 'Quarter-final', 'Semi-final', 'Third Place', 'Final'];
        } else if (+maxPlayers === 32) {
            labels = ['1/16 Final', '1/8 Final', 'Quarter-final', 'Semi-final', 'Third Place', 'Final'];
        }

        setStageLabels(labels);

        if (tournamentStatus === 'Tournament Finished') {
            setUpdateButtonVisible(false);
        }

        setGamesPerStage({
            '1/32 Final': 32,
            '1/16 Final': 16,
            '1/8 Final': 8,
            'Quarter-final': 4,
            'Semi-final': 2,
            'Third Place': 1,
            Final: 1
        });

        const fetchPlayoffPairs = async () => {
            try {
                const tournamentResponse = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/.json`
                );

                if (tournamentResponse.ok) {
                    const data = await tournamentResponse.json();
                    const registeredPlayer = Object.values(data.players).length.toString();
                    const tournamentPlayers = data.maxPlayers;

                    if (registeredPlayer === tournamentPlayers && data.status === 'Registration finished!') {
                        setStartButton(true);
                    }
                }
                const bracketResponse = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`
                );

                // console.log('bracketResponse', bracketResponse);

                if (bracketResponse.ok) {
                    const data = await bracketResponse.json();
                    if (data) {
                        // Parse the object
                        const valuesArray = Object.values(data);
                        // console.log('valuesArray', valuesArray);

                        let playoffPairsDetermined = data?.playoffPairs;
                        if (!playoffPairsDetermined) {
                            playoffPairsDetermined = valuesArray[0].playoffPairs;
                        }
                        setPlayoffPairs(playoffPairsDetermined);
                        // console.log('playoffPairsDetermined', playoffPairsDetermined);
                    }
                } else {
                    console.log('Failed to fetch playoff pairs');
                }
            } catch (error) {
                console.error('Error fetching playoff pairs:', error);
            }
        };

        fetchPlayoffPairs();
    }, [maxPlayers, uniquePlayerNames]);

    const handleShowStats = async (team1, team2) => {
        // Fetch all games from your DB (adjust the URL as needed)
        const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/games.json');
        const data = await response.json();

        // Filter games where both players played
        const games = Object.values(data.heroes3 || {}).filter(
            (game) =>
                (game.opponent1 === team1 && game.opponent2 === team2) ||
                (game.opponent1 === team2 && game.opponent2 === team1)
        );

        const total = games.length;
        const wins = games.filter((g) => g.winner === team1).length;
        const losses = games.filter((g) => g.winner === team2).length;
        const winPercent = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';

        // Sort by date descending and take the last 5 games
        const last5Games = games.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

        setStats({
            total,
            wins,
            losses,
            winPercent,
            playerA: team1,
            playerB: team2,
            last5Games
        });
        setShowStats(true);
    };

    const handleCloseStats = () => setShowStats(false);

    const getWinner = (pair) => {
        const score1 = pair.type === 'bo-3' ? parseInt(pair.score1) : parseInt(pair.score1) || 0;
        const score2 = pair.type === 'bo-3' ? parseInt(pair.score2) : parseInt(pair.score2) || 0;

        if (pair.type === 'bo-3') {
            if (+score1 > +score2) {
                if (+score2 === 0 && pair.games) {
                    pair.games.forEach((game, index) => {
                        pair.games[index].gameWinner = pair.team1;
                        pair.games[index].castleWinner = game.castle1;
                    });
                }
                pair.winner = pair.team1;
            } else if (+score1 < +score2) {
                if (+score1 === 0 && pair.games) {
                    pair.games.forEach((game, index) => {
                        pair.games[index].gameWinner = pair.team2;
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
        const tournamentResponseGET = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/.json`,
            {
                method: 'GET'
            }
        );
        let tournamentResponse = null;
        if (tournamentResponseGET.ok) {
            const data = await tournamentResponseGET.json();
            // const playoffsGames = data.tournamentPlayoffGames;
            // const tournamentPlayoffGamesFinal = data.tournamentPlayoffGamesFinal;
            const randomBrackets = data.randomBracket;
            playersObj = data.players;
            // let tournamentData = {};

            setStartTournament(true);
            // Prepare the tournament data
            console.log('Random Brackets setting:', randomBrackets);
            if (!randomBrackets) {
                setIsSpinningWheelOpen(true);
            } else {
                tournamentResponse = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/.json`,
                    {
                        method: 'PATCH',
                        body: JSON.stringify({
                            status: 'Started!'
                        }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );
                try {
                    if (tournamentResponse.ok) {
                        console.log('Pairs posted to Firebase successfully');
                    } else {
                        console.log('Failed to post pairs to Firebase');
                    }
                } catch (error) {
                    console.error('Error posting pairs to Firebase:', error);
                }

                window.location.reload();
            }
        }
    };

    const updateTournament = async () => {
        const tournamentData = {
            playoffPairs: playoffPairs
        };

        const tournamentResponse = await lookForTournamentName(tournamentId);
        tournamentName = tournamentResponse.name;

        allPairsHaveTeams = allPairsHaveTeamsFunc(playoffPairs);

        // let updateDataResponseModal = confirmWindow(
        //     `Are you sure you want to update winners with this JSON ${JSON.stringify(tournamentData)}?`
        // );

        try {
            //TODO: check if the playoffPairs is equal to the DB object => do nothing
            // if (SHOULD_POSTING && updateDataResponseModal) {
            //     const response = await fetch(
            //         `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`,
            //         {
            //             method: 'PUT',
            //             body: JSON.stringify(tournamentData),
            //             headers: {
            //                 'Content-Type': 'application/json'
            //             }
            //         }
            //     );

            //     if (response.ok) {

            // console.log('playoffPairs before', JSON.stringify(playoffPairs, null, 2));

            await processFinishedGames(playoffPairs);

            //TODO: Could this be ommit?
            // console.log('playoffPairs', JSON.stringify(playoffPairs, null, 2));

            const retrievedWinners = await retrieveWinnersFromDatabase();

            //TODO: check if the quantity of winners are the same => doing nothing
            const tournamentDataWithWinners = {
                playoffPairs: retrievedWinners
            };

            //TODO: if the tournamentDate is the same as the tournamentDataWithWinners
            const isSame = JSON.stringify(tournamentData) === JSON.stringify(tournamentDataWithWinners);

            //TODO: why do we need to PUT it the second time - to determine the next stage pairings?
            let winnerBracket = {};

            //IMPORTANT: Which means that all pairs have teams and no need to determine the next stage pairings
            if (!allPairsHaveTeams) {
                console.log(`tournamentDataWithWinners-HERE!`, JSON.stringify(tournamentDataWithWinners, null, 2));

                let winnersDataPutResponseModal = confirmWindow(
                    `Are you sure you want to update tournamentDataWithWinners with this JSON ${JSON.stringify(tournamentDataWithWinners, null, 2)}?`
                );

                if (SHOULD_POSTING && winnersDataPutResponseModal) {
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
            }

            // if (winnerBracket.ok) {
            let place;
            let prizeAmount;
            const lastStage = retrievedWinners[retrievedWinners.length - 1];

            const firstPlace = lastStage[lastStage.length - 1] ? lastStage[lastStage.length - 1].winner : null;

            const secondPlace = firstPlace
                ? firstPlace === lastStage[lastStage.length - 1].team1
                    ? lastStage[lastStage.length - 1].team2
                    : lastStage[lastStage.length - 1].team1
                : undefined;

            // TODO URGENT: why we can't put the third place here as well?

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

                    let winnersResponseModal = confirmWindow(
                        `Are you sure you want to update winners with this JSON ${JSON.stringify(existingData)}?`
                    );

                    if (SHOULD_POSTING && winnersResponseModal) {
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
                        let tournamentStatusResponseModal = confirmWindow(
                            `Are you sure you want to update tournament's status to 'FINISHED'?`
                        );
                        if (SHOULD_POSTING && tournamentStatusResponseModal) {
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

                                let firstPlaceResponse = {};

                                let firstPlaceResponseModal = confirmWindow(
                                    `Are you sure you want to update first place winner?`
                                );
                                if (SHOULD_POSTING && firstPlaceResponseModal) {
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
                                    let secondPlaceResponseModal = confirmWindow(
                                        `Are you sure you want to update second place winner?`
                                    );
                                    console.log('Final firstPlaceResponseModal:', secondPlaceResponseModal);
                                    if (SHOULD_POSTING && secondPlaceResponseModal) {
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
            // }

            console.log('Pairs posted to Firebase successfully');
            let reloadResponse = confirmWindow(`Are you sure you want to reload the page?`);
            if (reloadResponse) {
                window.location.reload();
            }
        } catch (error) {
            console.log('Error posting pairs to Firebase:', error);
        }
    };

    // Utility function to check if all pairs have valid teams
    function allPairsHaveTeamsFunc(tournamentPlayoffPairs) {
        if (!Array.isArray(tournamentPlayoffPairs)) return false;
        return tournamentPlayoffPairs.every(
            (stage) =>
                Array.isArray(stage) &&
                stage.every((pair) => pair.team1 && pair.team1 !== 'TBD' && pair.team2 && pair.team2 !== 'TBD')
        );
    }

    function confirmWindowNew(message) {
        return new Promise((resolve) => {
            const confirmButton = document.createElement('button');
            confirmButton.textContent = 'Yes';
            confirmButton.addEventListener('click', () => {
                resolve(true);
            });

            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'No';
            cancelButton.addEventListener('click', () => {
                resolve(false);
            });

            const div = document.createElement('div');
            div.appendChild(confirmButton);
            div.appendChild(cancelButton);
            div.style.position = 'absolute';
            div.style.top = '0';
            div.style.left = '0';
            div.style.width = '100%';
            div.style.height = '100%';
            div.style.backgroundColor = 'rgba(0,0,0,0,0.5)';
            div.style.padding = '10px';
            div.style.display = 'flex';
            div.style.justifyContent = 'center';
            div.style.alignItems = 'center';
            div.style.gap = '10px';

            const messageDiv = document.createElement('div');
            messageDiv.textContent = message;
            messageDiv.style.position = 'absolute';
            messageDiv.style.top = '50%';
            messageDiv.style.left = '50%';
            messageDiv.style.width = '100%';
            messageDiv.style.height = '50%';
            messageDiv.style.backgroundColor = 'rgba(0,0,0,0,0.5)';
            messageDiv.style.padding = '10px';
            messageDiv.style.display = 'flex';
            messageDiv.style.justifyContent = 'center';
            messageDiv.style.alignItems = 'center';
            messageDiv.style.gap = '10px';

            document.body.appendChild(messageDiv);
            document.body.appendChild(div);

            const result = new Promise((resolve) => {
                const buttonClicked = document.createElement('button');
                buttonClicked.textContent = 'Got it!';
                buttonClicked.addEventListener('click', () => {
                    resolve(true);
                });

                const cancelButtonNew = document.createElement('button');
                cancelButtonNew.textContent = 'Cancel';
                cancelButtonNew.addEventListener('click', () => {
                    resolve(false);
                });

                div.appendChild(buttonClicked);
                div.appendChild(cancelButtonNew);

                div.style.display = 'flex';
                div.style.justifyContent = 'center';
                div.style.alignItems = 'center';
                div.style.gap = '10px';

                div.style.position = 'absolute';
                div.style.top = '50%';
                div.style.left = '50%';
                div.style.width = '100%';
                div.style.height = '50%';
            });
        });
    }

    const retrieveWinnersFromDatabase = async () => {
        try {
            let mustFetch = confirmWindow('Please wait...');
            if (mustFetch) {
                const tournamentResponseGET = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/.json`,
                    {
                        method: 'GET'
                    }
                );
                if (tournamentResponseGET.ok) {
                    const data = await tournamentResponseGET.json();
                    const playoffsGames = data.tournamentPlayoffGames;
                    const tournamentPlayoffGamesFinal = data.tournamentPlayoffGamesFinal;

                    const bracketResponse = await fetch(
                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`
                    );
                    const playerResponse = await fetch(
                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/players/.json`
                    );

                    if (bracketResponse.ok && playerResponse.ok) {
                        const bracketData = await bracketResponse.json();

                        const playersData = await playerResponse.json();

                        // if (playersData.hasOwnProperty(result.id)) {
                        //     let existingStars = playersData[result.id].stars;
                        //     let existingRatings = playersData[result.id].ratings;

                        let collectedPlayoffPairs = bracketData?.playoffPairs || [];
                        let nextStagePairings;
                        let nextStageIndex = 0;

                        for (let currentStage = 0; currentStage < collectedPlayoffPairs.length - 1; currentStage++) {
                            let currentStagePlayoffPairs = collectedPlayoffPairs[currentStage];

                            let currentStagePlayoffWinners = currentStagePlayoffPairs
                                .map((pair) => {
                                    const result = findByName(playersData, pair.winner);

                                    let playerRecentStar = result ? result.stars : null;
                                    let playerRecentRatings = result ? result.ratings : null;

                                    if (pair.winner === pair.team1) {
                                        return {
                                            winner: pair.winner,
                                            ratings: result ? playerRecentRatings : pair.ratings1,
                                            stars: result ? playerRecentStar : pair.stars1
                                        };
                                    } else {
                                        return {
                                            winner: pair.winner,
                                            ratings: result ? playerRecentRatings : pair.ratings2,
                                            stars: result ? playerRecentStar : pair.stars2
                                        };
                                    }
                                })
                                .filter((pair) => pair.winner !== undefined || pair.winner === 'TBD');

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

                            if (
                                nextStagePlayoffWinners.includes(undefined) &&
                                !thirdPlaceWinner &&
                                !allPairsHaveTeams
                            ) {
                                if (nextStageIndex === 2) {
                                    // console.log('IN THIRD PLACE');
                                    //THIRD PLACE
                                    const losers = currentStagePlayoffPairs.map((match) => {
                                        let loserName;
                                        if (match.winner === match.team1) {
                                            loserName = match.team2;
                                        } else if (match.winner === match.team2) {
                                            loserName = match.team1;
                                        } else {
                                            loserName = 'TBD';
                                        }

                                        // Find the player data for the loser
                                        const loserData = Object.values(playersData).find(
                                            (player) => player.name === loserName
                                        );

                                        return {
                                            winner: loserName,
                                            stars: loserData ? loserData.stars : null,
                                            ratings: loserData ? loserData.ratings : null
                                        };
                                    });

                                    let thirdPlacePairing = determineNextStagePairings(losers);
                                    if (currentStagePlayoffWinners.length > 0) {
                                        nextStagePairings = determineNextStagePairings(
                                            currentStagePlayoffWinners,
                                            currentStage,
                                            tournamentPlayoffGamesFinal
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
                                                tournamentPlayoffGamesFinal
                                            );
                                            collectedPlayoffPairs[nextStageIndex] = nextStagePairings;
                                        }
                                    }
                                }
                            }
                        }

                        //TODO: This should be in a mutual function determinePrizeWinner
                        determineThirdPlaceWinner(collectedPlayoffPairs, stageLabels);
                        // setPlayoffPairs(collectedPlayoffPairs);
                        return collectedPlayoffPairs;
                    } else {
                        console.log('Failed to retrieve winners from the database');
                    }
                } else {
                    console.log('Fetch canceled by user');
                }
            }
        } catch (error) {
            console.error('Error retrieving winners from the database:', error);
        }
    };

    const processFinishedGames = async (collectedPlayoffPairs) => {
        let finishedPairs = [];

        console.log('collectedPlayoffPairs', JSON.stringify(collectedPlayoffPairs, null, 2));

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
                    } else {
                        if (+pairDetails.score1 + +pairDetails.score2 === 1) {
                            pairDetails.gameStatus = 'Finished';
                            finishedPairs.push(pairDetails);
                        } else {
                            console.log('pairDetails.', pairDetails);
                            console.log('pairDetails.games', pairDetails.games);

                            if (
                                pairDetails.games[0].castle1 &&
                                pairDetails.games[0].castle2 &&
                                !pairDetails.games[0].gameWinner
                            ) {
                                finishedPairs.push(pairDetails);
                            }
                        }
                    }
                }
            });
        });

        //TODO: implement the gameStatus. If the gameWinner exists determine game as finished

        if (finishedPairs.length === 0) {
            console.log('No finished pairs found');
            return;
        }

        let { castle1, castle2, score1, score2, team1, team2, winner, type } = finishedPairs[0];
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
                opponent1Castle: finishedPairs[0].games.castle1,
                opponent2Castle: finishedPairs[0].games.castle2,
                score: `${score1}-${score2}`,
                winner: winner
            };
        }
        let gameResponse = {};

        let winnerId;
        let winnerCastle;
        let lostCastle;
        let needUpdate = false;
        if (finishedPairs[0].type === 'bo-3') {
            // console.log('finishedPairs[0].games', finishedPairs[0].games);
            finishedPairs[0].games.forEach((game) => {
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

                    needUpdate = true;
                }

                if (game.gameStatus && game.gameStatus === 'Finished') {
                    let firstCastleResponse;
                    let secondCastleResponse;
                    let firstCastleResponseModal = confirmWindow(
                        `Process Games: Are you sure you want to process winner castle of ${winnerCastle}`
                    );
                    console.log('Process Games firstCastleResponseModal:', firstCastleResponseModal);
                    if (firstCastleResponseModal) {
                        firstCastleResponse = lookForCastleStats(winnerCastle, 'win');
                    }

                    let secondCastleResponseModal = confirmWindow(
                        `Process Games: Are you sure you want to process lost castle of ${lostCastle}`
                    );
                    console.log('Process Games firstPlaceResponseModal:', secondCastleResponseModal);
                    if (secondCastleResponseModal) {
                        secondCastleResponse = lookForCastleStats(lostCastle, 'lost');
                    }
                    if (firstCastleResponse && secondCastleResponse) {
                        game.gameStatus = 'Processed';
                    }
                }
            });
        } else {
            if (team1 === winner) {
                winnerId = opponent1Id;
                winnerCastle = finishedPairs[0].games[0].castle1;
                lostCastle = finishedPairs[0].games[0].castle2;
            } else if (team2 === winner) {
                winnerId = opponent2Id;
                winnerCastle = finishedPairs[0].games[0].castle2;
                lostCastle = finishedPairs[0].games[0].castle1;
            }
            //TODO: check if gamesStatus is finished.
            let castleWinResponseModal =
                winner &&
                confirmWindow(
                    `Process Castles: Are you sure you want to process WIN castle? ${JSON.stringify(winnerCastle)}`
                );

            if (castleWinResponseModal) {
                lookForCastleStats(winnerCastle, 'win');
            }
            let castleLoseResponseModal =
                winner &&
                confirmWindow(
                    `Process Castles: Are you sure you want to process LOSE castle? ${JSON.stringify(lostCastle)}`
                );

            if (castleLoseResponseModal) {
                lookForCastleStats(lostCastle, 'lost');
            }
        }

        if (winner) {
            let gameResponseModal = confirmWindow(
                `Process Games: Are you sure you want to POST those games? ${JSON.stringify(games)}`
            );
            console.log('Process Games firstPlaceResponseModal:', gameResponseModal);
            if (SHOULD_POSTING && gameResponseModal && winner) {
                gameResponse = await fetch(
                    'https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3.json',
                    {
                        method: 'POST',
                        body: JSON.stringify(games),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );
                await gameResponse.json();
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

            let opponent1Score = await getNewRating(
                parseFloat(opponent1PrevData.ratings.split(',').pop().trim()),
                parseFloat(opponent2PrevData.ratings.split(',').pop().trim()),
                didWinOpponent1
            );
            let opponent2Score = await getNewRating(
                parseFloat(opponent2PrevData.ratings.split(',').pop().trim()),
                parseFloat(opponent1PrevData.ratings.split(',').pop().trim()),
                didWinOpponent2
            );
            if (SHOULD_POSTING) {
                let opponent1IdScoreModal = confirmWindow(
                    `Process Games: Are you sure you want to process the first player ${opponent1Id}`
                );
                console.log(
                    'Process Games opponent1IdScoreModal:',
                    opponent1IdScoreModal + ' opponent1Score:' + opponent1Score
                );
                if (opponent1IdScoreModal) {
                    await addScoreToUser(opponent1Id, opponent1PrevData, opponent1Score, winnerId, tournamentId, team1);
                }
                let opponent2IdScoreModal = confirmWindow(
                    `Process Games: Are you sure you want to process the second player ${opponent2Id}`
                );
                console.log('Process Games opponent2IdScoreModal:', opponent2IdScoreModal);
                if (opponent2IdScoreModal) {
                    await addScoreToUser(opponent2Id, opponent2PrevData, opponent2Score, winnerId, tournamentId, team2);
                }
            }
            //TODO: if player's score was updated => set gameStatus to processed
            //TODO: check if all games in 'Processed' status => update whole gameStatus to 'Processed' status
            finishedPairs[0].gameStatus = 'Processed';
            finishedPairs[0].games.forEach((game) => {
                game.gameStatus = 'Processed';
            });
        }
        setPlayoffPairs(finishedPairs);

        console.log('finishedPairs', JSON.stringify(finishedPairs, null, 2));

        let pushProcessedGame = confirmWindow(
            `Process Games: Are you sure you want to push finished game ${JSON.stringify(finishedPairs)}`
        );
        let responseFinishedPair;
        if (pushProcessedGame) {
            responseFinishedPair = await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/playoffPairs/.json`,
                {
                    method: 'PUT',
                    body: JSON.stringify(playoffPairs),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (responseFinishedPair.ok) {
                console.log('Finished pairs PUT successfully');
            }
        }

        // console.log('finishedPairs LENGTH', finishedPairs.length);
        // console.log('finishedPairs', finishedPairs);
        // setPlayoffPairs(finishedPairs);

        return finishedPairs;
    };

    const confirmWindow = (message) => {
        const response = window.confirm(message);
        if (response) {
            console.log('YES');
        } else {
            console.log('NO');
        }
        return response;
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
                    let thirdPlaceModal = confirmWindow(
                        `Process Games: Are you sure you want to update the third place with a player: ${winner}?`
                    );
                    console.log('Process Games thirdPlaceModal:', thirdPlaceModal);

                    if (SHOULD_POSTING && thirdPlaceModal) {
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
                        if (SHOULD_POSTING && thirdPlaceModal) {
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
    const determineNextStagePairings = (winners, currentStage, playoffsGames) => {
        const nextPairings = [];

        // Iterate through the winners array and create pairings for the next stage
        for (let i = 0; i < winners.length; i += 2) {
            const pair = {
                gameStatus: 'Not Started',
                team1: winners[i].winner || 'TBD',
                score1: 0,
                stars1: winners[i].stars,
                ratings1: winners[i].ratings,
                team2: (winners[i + 1] && winners[i + 1].winner) || 'TBD',
                score2: 0,
                stars2: (winners[i + 1] && winners[i + 1].stars) || null,
                ratings2: (winners[i + 1] && winners[i + 1].ratings) || null,
                //TODO: check bo-3
                games: [
                    {
                        castle1: '',
                        castle2: '',
                        castleWinner: '',
                        gameId: 0,
                        gameStatus: 'Not Started',
                        gameWinner: ''
                    }
                ],
                type: 'bo-1'
            };

            nextPairings.push(pair);
        }
        if (currentStage === 0 && nextPairings.length === 1) {
            const pair = {
                gameStatus: 'Not Started',
                team1: 'TBD',
                score1: 0,
                stars1: null,
                ratings1: null,
                team2: 'TBD',
                score2: 0,
                stars2: null,
                ratings2: null,
                games: [
                    {
                        castle1: '',
                        castle2: '',
                        castleWinner: '',
                        gameId: 0,
                        gameStatus: 'Not Started',
                        gameWinner: ''
                    }
                ],
                type: 'bo-1'
            };

            nextPairings.push(pair);
        }
        return nextPairings;
    };

    const handleScoreChange = (stageName, pairIndex, teamIndex, newScore) => {
        const stageMappings = {
            'Quarter-final': 0,
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
                console.log('FINALLY', pair);
            }
            return updatedPairs;
        });
    };

    function renderShowStatsButton(team1, team2, onShowStats) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div
                    onClick={() => onShowStats(team1, team2)}
                    style={{
                        width: '24px',
                        height: '24px',
                        background: 'rgb(62, 32, 192)', // same as main background
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'gold',
                        fontWeight: 'bold',
                        fontSize: '1em',
                        cursor: 'pointer',
                        border: '2px solid gold',
                        marginTop: '2.5rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
                    }}
                    title="Show Stats"
                >
                    ?
                </div>
            </div>
        );
    }

    const handleGetAvailableCastles = async () => {
        let castles = await fetchCastlesList();
        console.log('castles', castles);

        const result = getAvailableCastles(castles);
        setAvailableCastles(result);
        setShowCastlesModal(true);
    };

    //TODO: implement the getAvailableCastles function to filter castles based on the number of games played
    function getAvailableCastles(castles) {
        const maxGames = Math.max(
            ...castles.map((c) => {
                console.log('c', c.total);
                // console.log('c', c.name);
                return c.total;
            })
        );
        // console.log('maxGames', maxGames);
        // return castles.filter((c) => c.total < maxGames);
        return [...castles].sort((a, b) => a.total - b.total);
    }

    const onStartTournament = async (bracket) => {
        console.log('Tournament ID:', tournamentId);
        console.log('Tournament Bracket:', bracket);

        const isBracketComplete = bracket.every((pair) => pair[0] !== 'TBD' && pair[1] !== 'TBD');

        if (!isBracketComplete) {
            console.error('Bracket is not complete. Please fill all slots.');
            return;
        }

        let tournamentData = {
            stageLabels: stageLabels,
            playoffPairs: isBracketComplete,
            status: 'Started!'
        };
        console.log('tournamentData to be sent:', tournamentData);
        // tournamentResponse = await fetch(
        //     `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/.json`,
        //     {
        //         method: 'PATCH',
        //         body: JSON.stringify({
        //             bracket: tournamentData,
        //             status: 'Started!'
        //         }),
        //         headers: {
        //             'Content-Type': 'application/json'
        //         }
        //     }
        // );

        console.log('Updating Tournament Bracket...');

        console.log('Tournament Bracket Updated:', bracket);
        console.log('Tournament successfully started!');
    };

    return (
        <div className={`scrollable-list-class brackets-class`} style={{ overflowY: 'auto', maxHeight: '80vh' }}>
            <div
                className={classes.brackets}
                style={{
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'rgb(62, 32, 192)', // Match the modal background
                    color: 'yellow',
                    padding: '1rem',
                    zIndex: 101,
                    textAlign: 'center',
                    borderBottom: '1px solid white'
                }}
            >
                {tournamentName}
                {tournamentWinners && (
                    <p style={{ color: 'gold', margin: 0 }}>Gold: {tournamentWinners['1st place']}</p>
                )}
                {tournamentWinners && (
                    <p style={{ color: 'grey', margin: 0 }}>Silver: {tournamentWinners['2nd place']}</p>
                )}
                {tournamentWinners && (
                    <p style={{ color: 'brown', margin: 0 }}>Bronze: {tournamentWinners['3rd place']}</p>
                )}
            </div>

            {/* Render the spinning wheel modal */}
            {isSpinningWheelOpen && (
                <Modal onClose={() => setIsSpinningWheelOpen(false)}>
                    <SpinningWheel players={playersObj} onStartTournament={onStartTournament} />
                </Modal>
            )}

            {showCastlesModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999
                    }}
                    onClick={() => setShowCastlesModal(false)}
                >
                    <div
                        style={{
                            background: '#fff',
                            padding: '2rem',
                            borderRadius: '8px',
                            minWidth: '300px',
                            maxHeight: '80vh',
                            overflowY: 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3>Available Castles</h3>
                        <ul>
                            {(() => {
                                // Find min and max total values
                                const totals = availableCastles.map((castle) => castle.total);
                                const minTotal = Math.min(...totals);
                                const maxTotal = Math.max(...totals);

                                return availableCastles.map((castle, idx) => (
                                    <li
                                        key={idx}
                                        style={{
                                            color:
                                                castle.total === minTotal
                                                    ? 'green'
                                                    : castle.total === maxTotal
                                                      ? 'red'
                                                      : 'inherit',
                                            fontWeight:
                                                castle.total === minTotal || castle.total === maxTotal
                                                    ? 'bold'
                                                    : 'normal'
                                        }}
                                    >
                                        {castle.name} — {castle.total}
                                    </li>
                                ));
                            })()}
                        </ul>
                        <button onClick={() => setShowCastlesModal(false)}>Close</button>
                    </div>
                </div>
            )}

            {startButton && !startTournament && tournamentStatus === 'Registration finished!' && (
                <button onClick={handleStartTournament}>Start Tournament</button>
            )}
            {startTournament && <button onClick={() => shuffleArray(uniquePlayerNames)}>Shuffle</button>}
            {!startTournament && isUpdateButtonVisible && (
                <>
                    <button id="update-tournament" onClick={() => updateTournament()}>
                        Update Tournament
                    </button>
                    <button onClick={() => handleGetAvailableCastles()}>Get Available Castles</button>
                </>
            )}

            {stageLabels.length === 0 ? (
                <h6>Tournament registration hasn't started</h6>
            ) : (
                <div className={classes['bracket-stages-container']}>
                    {stageLabels.map(function (stage, stageIndex) {
                        // Combine Final and Third Place in one column
                        if (stage === 'Final') {
                            const thirdPlaceIndex = stageLabels.findIndex((label) => label === 'Third Place');
                            const finalPairs = playoffPairs[stageIndex] || [];
                            const thirdPlacePairs = thirdPlaceIndex !== -1 ? playoffPairs[thirdPlaceIndex] || [] : [];

                            return (
                                <div
                                    key="final-and-third"
                                    className={`${classes['bracket-stages-column']} 
                        ${stageIndex === currentStageIndex ? classes.active : ''}`}
                                >
                                    <h3 style={{ color: 'red' }}>Final</h3>
                                    {finalPairs.map((pair, pairIndex) => {
                                        const { team1, team2, score1, score2, winner, castle1, castle2, type } = pair;
                                        const hasTruthyPlayers = (team1 && team2 && team1 !== 'TBD') || team2 !== 'TBD';

                                        // ...BO3_DEFAULT logic if needed...

                                        return (
                                            <div key={`final-${pairIndex}`} className={classes['game-block']}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '0.5rem'
                                                        }}
                                                    >
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
                                                            clickedRadioButton={clickedRadioButton}
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
                                                            clickedRadioButton={clickedRadioButton}
                                                        />
                                                    </div>
                                                    {renderShowStatsButton(pair.team1, pair.team2, handleShowStats)}
                                                </div>
                                                {showStats && stats && (
                                                    <StatsPopup stats={stats} onClose={handleCloseStats} />
                                                )}
                                            </div>
                                        );
                                    })}
                                    <h3 style={{ color: 'orange', marginTop: '20rem' }}>Third Place</h3>
                                    {thirdPlacePairs.map((pair, pairIndex) => {
                                        const { team1, team2, score1, score2, winner, castle1, castle2, type } = pair;
                                        const hasTruthyPlayers = (team1 && team2 && team1 !== 'TBD') || team2 !== 'TBD';
                                        return (
                                            <div key={`thirdplace-${pairIndex}`} className={classes['game-block']}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '0.5rem'
                                                        }}
                                                    >
                                                        <PlayerBracket
                                                            pair={pair}
                                                            team={'team1'}
                                                            pairIndex={pairIndex}
                                                            hasTruthyPlayers={hasTruthyPlayers}
                                                            stageIndex={stageIndex - 1}
                                                            setPlayoffPairs={setPlayoffPairs}
                                                            handleCastleChange={handleCastleChange}
                                                            handleScoreChange={handleScoreChange}
                                                            handleBlur={handleBlur}
                                                            handleRadioChange={handleRadioChange}
                                                            stage={stage}
                                                            teamIndex={1}
                                                            getWinner={getWinner}
                                                            clickedRadioButton={clickedRadioButton}
                                                        />
                                                        <PlayerBracket
                                                            pair={pair}
                                                            team={'team2'}
                                                            pairIndex={pairIndex}
                                                            hasTruthyPlayers={hasTruthyPlayers}
                                                            stageIndex={stageIndex - 1}
                                                            setPlayoffPairs={setPlayoffPairs}
                                                            handleCastleChange={handleCastleChange}
                                                            handleScoreChange={handleScoreChange}
                                                            handleBlur={handleBlur}
                                                            handleRadioChange={handleRadioChange}
                                                            stage={stage}
                                                            teamIndex={2}
                                                            getWinner={getWinner}
                                                            isManualScore={isManualScore}
                                                            clickedRadioButton={clickedRadioButton}
                                                        />
                                                    </div>
                                                    {renderShowStatsButton(pair.team1, pair.team2, handleShowStats)}
                                                </div>
                                                {showStats && stats && (
                                                    <StatsPopup stats={stats} onClose={handleCloseStats} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        }

                        // Skip rendering the Third Place column separately
                        if (stage === 'Third Place') {
                            return null;
                        }

                        // Default rendering for other stages
                        return (
                            <div
                                key={stage}
                                className={`${classes['bracket-stages-column']} ${stageIndex === currentStageIndex ? classes.active : ''}`}
                            >
                                <h3 style={{ color: 'red' }}>{stage}</h3>
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
                                                gameWinner: pair.games[0].gameWinner ? pair.games[0].gameWinner : null,
                                                castleWinner: pair.games[0].castleWinner
                                                    ? pair.games[0].castleWinner
                                                    : null
                                            },
                                            {
                                                gameId: 2,
                                                castle1: pair.games[1].castle1 ? pair.games[1].castle1 : null,
                                                castle2: pair.games[1].castle2 ? pair.games[1].castle2 : null,
                                                gameWinner: pair.games[1].gameWinner ? pair.games[1].gameWinner : null,
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
                                            className={classes['game-block']}
                                            // style={{ position: 'relative' }}
                                        >
                                            {stage !== 'Third Place' && stage !== 'Final' && (
                                                <p>
                                                    {`Match ${pairIndex + 1}`} {`Best of ${stage === 'Final' ? 3 : 1}`}
                                                </p>
                                            )}
                                            {/* TODO: implement the game date */}
                                            {/* <div>Date:</div> */}

                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '0.5rem'
                                                    }}
                                                >
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
                                                        clickedRadioButton={clickedRadioButton}
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
                                                        clickedRadioButton={clickedRadioButton}
                                                    />
                                                </div>
                                                {renderShowStatsButton(pair.team1, pair.team2, handleShowStats)}
                                            </div>
                                            {showStats && stats && (
                                                <StatsPopup stats={stats} onClose={handleCloseStats} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const handleBlur = (stageName, pairIndex, setPlayoffPairs) => {
    const stageMappings = {
        'Quarter-final': 0,
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
        console.log('totalGames', totalGames.length);

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
                // pair.castle1 = castleName;
                pair.games[index].castle1 = castleName;
            } else if (teamIndex === 2) {
                pair.games[index].castle2 = castleName;
                // pair.castle2 = castleName;
            }

            if (pair.games[index].castle2 && pair.games[index].castle1 && !pair.games[index].castleWinner) {
                pair.gameStatus = 'In Progress';
            }
        }
        console.log('pair-after', pair);

        return updatedPairs;
    });
}

function handleRadioChange(gameId, teamIndex, value, setPlayoffPairs, stageIndex, pairIndex, getWinner, checked, type) {
    setPlayoffPairs((prevPairs) => {
        const updatedPairs = [...prevPairs];
        const pair = updatedPairs[stageIndex][pairIndex];
        const game = pair.games[gameId];
        const radioButton1 = document.getElementById(`radio-${stageIndex}-${pairIndex}-${game.gameId}-${1}`);
        const radioButton2 = document.getElementById(`radio-${stageIndex}-${pairIndex}-${game.gameId}-${2}`);
        const radioButtonValue1 = radioButton1.checked;
        const radioButtonValue2 = radioButton2.checked;

        //TODO: check if game.gameWinner set correclty

        // Update the checked attribute for the clicked radio button only
        const radioButtons = document.querySelectorAll(`input[name="radio-${stageIndex}-${pairIndex}-${gameId}"]`);

        radioButtons.forEach((radioButton) => {
            if (radioButton.id === `radio-${stageIndex}-${pairIndex}-${gameId}-${teamIndex}`) {
                clickedRadioButton = radioButton ? radioButton.id : undefined;
            }
            if (radioButton.id === `radio-${stageIndex}-${pairIndex}-${gameId}-${teamIndex}`) {
                radioButton.checked = true;
            } else {
                radioButton.checked = false;
            }
        });

        if (game.gameStatus !== 'Processed') {
            if (teamIndex === 1 && value === 'on' && game.castle1) {
                game.castleWinner = game.castle1;
                game.gameWinner = pair.team1;
                pair.score1 = pair.score1 + 1;

                console.log('pair.score2', pair.score2);

                if (
                    pair.score2 > 0 &&
                    (radioButtonValue1 || radioButtonValue2) &&
                    (pair.games.length === 1 || !game.gameWinner)
                ) {
                    pair.score2 = pair.score2 - 1;
                }
                game.gameStatus = 'Finished';
            } else {
                if (teamIndex === 2 && value === 'on' && game.castle2) {
                    game.castleWinner = game.castle2;
                    game.gameWinner = pair.team2;
                    pair.score2 = pair.score2 + 1;
                    console.log('pair.score1', pair.score1);

                    if (
                        pair.score1 > 0 &&
                        (radioButtonValue1 || radioButtonValue2) &&
                        (pair.games.length === 1 || !game.gameWinner)
                    ) {
                        pair.score1 = pair.score1 - 1;
                    }
                    game.gameStatus = 'Finished';
                }
            }
            // console.log('game.gameWinner', game.gameWinner);
            if (
                (pair.score1 + pair.score2 >= 2 && `${pair.score1}-${pair.score2}` !== '1-1') ||
                pair.games.length === 1
            ) {
                getWinner(pair);
            }
        }

        // console.log('updatedPairs', updatedPairs);
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
