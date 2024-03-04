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
    const [tournamentName, setTournamentName] = useState('');

    // Determine the stage label based on the number of max players
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

        // Check if there are remaining spots and add players as TBA
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
        console.log('shuffleArray', playoffPairs);
        createPlayoffPairs();

        return playoffPairs;
    };

    // useEffect(() => {

    // }, []);

    const createPlayoffPairs = () => {
        const updatedPairs = [];
        stageLabels.forEach((stage, index) => {
            const numGames = gamesPerStage[stage];
            const pairs = [];

            for (let i = 0; i < numGames; i++) {
                let team1 = 'TBA';
                let score1 = 0;
                let team2 = 'TBA';
                let score2 = 0;

                if (index === 0) {
                    team1 = shuffledNames[i * 2] || 'TBA';
                    team2 = shuffledNames[i * 2 + 1] || 'TBA';
                } else {
                    const prevStagePairs = updatedPairs[index - 1];
                    team1 = prevStagePairs[i * 2]?.winner || 'TBA';
                    team2 = prevStagePairs[i * 2 + 1]?.winner || 'TBA';
                }

                pairs.push({ team1, team2, score1, score2, gameStatus: 'Not Started' });
            }

            updatedPairs.push(pairs);
        });

        setPlayoffPairs(updatedPairs);
    };
    // [stageLabels, gamesPerStage, shuffledNames]);

    // useEffect(() => {
    //     shuffleArray(uniquePlayerNames);
    // }, []);

    const getWinner = (pair) => {
        const score1 = parseInt(pair.score1) || 0;
        const score2 = parseInt(pair.score2) || 0;

        if (score1 > score2) {
            pair.winner = pair.team1;
            pair.castleWinner = pair.castle1;
        } else if (score1 < score2) {
            pair.winner = pair.team2;
            pair.castleWinner = pair.castle2;
        } else {
            return 'Tie';
        }
        // pair.gameStatus = pair.gameStatus !== 'Finished' ? 'Finished' : 'Not Started';

        if (pair.winner && pair.gameStatus !== 'Processed') {
            pair.gameStatus = 'Finished';
        }
    };

    const handleStartTournament = async () => {
        setStartTournament(true);
        // Prepare the tournament data

        shuffleArray();

        const tournamentData = {
            stageLabels: stageLabels,
            playoffPairs: playoffPairs
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

        const tournamentResponse = await lookForTournamentName(tournamentId);
        setTournamentName(tournamentResponse.name);

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
                        .filter((pair) => pair !== undefined || pair === 'TBA');

                    nextStageIndex = currentStage + 1;
                    let nextStagePlayoffPairs = collectedPlayoffPairs[nextStageIndex];

                    let thirdPlaceWinner;
                    if (currentStage === 2) {
                        thirdPlaceWinner = collectedPlayoffPairs[currentStage][0].winner;
                    }
                    const nextStagePlayoffWinners = nextStagePlayoffPairs.map((pair) => pair.winner);
                    const hasUndefinedTeam = nextStagePlayoffPairs.some(
                        (pair) => pair.team1 === 'TBA' || pair.team2 === 'TBA'
                    );

                    //TODO: if no score for both pplayers set get to not started

                    if (nextStagePlayoffWinners.includes(undefined) && !thirdPlaceWinner) {
                        if (nextStageIndex === 2) {
                            const losers = currentStagePlayoffPairs.map((match) =>
                                match.winner === match.team1
                                    ? match.team2
                                    : match.winner === match.team2
                                    ? match.team1
                                    : 'TBA'
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
                if (pairDetails.gameStatus === 'Finished') {
                    finishedPairs.push(pairDetails);
                }
            });
        });
        let { castle1, castle2, castleWinner, score1, score2, team1, team2, winner } = finishedPairs[0];

        const opponent1Id = await lookForUserId(team1);
        console.log('opponent1Id', opponent1Id);
        const opponent2Id = await lookForUserId(team2);
        console.log('opponent2Id', opponent2Id);

        let game = {
            opponent1: team1,
            opponent2: team2,
            date: new Date(),
            // gameName: gameName,
            tournamentName: tournamentName,
            gameType: 'bo-1', //TODO: change dynamically
            opponent1Castle: castle1,
            opponent2Castle: castle2,
            score: `${score1}-${score2}`,
            winner: winner
        };

        const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3.json', {
            method: 'POST',
            body: JSON.stringify(game),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        await response.json();
        let winnerId;
        let winnerCastle;
        let lostCastle;

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
                team1: winners[i] || 'TBA',
                team2: winners[i + 1] || 'TBA',
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

            // console.log('pair', pair);

            if (teamIndex === 1) {
                pair.score1 = newScore;
            } else if (teamIndex === 2) {
                pair.score2 = newScore;
            }

            if (pair.score1 !== null && pair.score2 !== null) {
                getWinner(pair);
            }
            return updatedPairs;
        });
        console.log('playoffPairs', playoffPairs);
    };

    return (
        <div className={`scrollable-list-class brackets-class`}>
            {startButton && !startTournament && <button onClick={handleStartTournament}>Start Tournament</button>}
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
                                        // console.log('pair', pair);
                                        const { team1, team2, score1, score2, winner, castle1, castle2 } = pair;

                                        const hasTruthyPlayers = (team1 && team2 && team1 !== 'TBA') || team2 !== 'TBA';

                                        return (
                                            <div
                                                key={pairIndex}
                                                // style={{ position: 'relative' }}
                                            >
                                                {stage !== 'Third Place' && stage !== 'Final' && (
                                                    <p>{`Match ${pairIndex + 1}`}</p>
                                                )}
                                                <p>{`Best of ${1}`}</p>
                                                <div>Date:</div>
                                                <div className={classes.player_bracket}>
                                                    {/* Indicator for the winner or grey-indicator for 'Tie' or undefined */}
                                                    {pair.team1 === winner ? (
                                                        <div className={classes['green-indicator']}></div>
                                                    ) : winner === 'Tie' || winner === undefined ? (
                                                        <div className={classes['grey-indicator']}></div>
                                                    ) : (
                                                        <div className={classes['red-indicator']}></div>
                                                    )}
                                                    <label htmlFor={`score-team1-${pairIndex}`}>{team1}</label>
                                                    {/* TODO: add the stars image when the tournament just started */}
                                                    <div>Stars img</div>
                                                    {hasTruthyPlayers && (
                                                        <div className="castle-dropdown-class">
                                                            {/* <label htmlFor={`castle-team1-${pairIndex}`}>{team1}</label> */}
                                                            <select
                                                                id={`castle-team1-${pairIndex}`}
                                                                value={castle1 ? castle1 : ''}
                                                                onChange={(event) =>
                                                                    handleCastleChange(
                                                                        stageIndex,
                                                                        pairIndex,
                                                                        1,
                                                                        event.target.value,
                                                                        setPlayoffPairs
                                                                    )
                                                                }
                                                            >
                                                                <option value="">Select a castle</option>
                                                                <option value="Castle-Замок">Castle</option>
                                                                <option value="Rampart-Оплот">Rampart</option>
                                                                <option value="Tower-Башня">Tower</option>
                                                                <option value="Inferno-Инферно">Inferno</option>
                                                                <option value="Necropolis-Некрополис">
                                                                    Necropolis
                                                                </option>
                                                                <option value="Dungeon-Подземелье">Dungeon</option>
                                                                <option value="Stronghold-Цитадель">Stronghold</option>
                                                                <option value="Fortress-Болото">Fortress</option>
                                                                <option value="Conflux-Сопряжение">Conflux</option>
                                                                <option value="Cove-Пиратская бухта">Cove</option>
                                                            </select>
                                                        </div>
                                                    )}
                                                    <input
                                                        type="text"
                                                        id={`score-team1-${pairIndex}`}
                                                        value={score1 || ''}
                                                        onChange={(event) =>
                                                            handleScoreChange(stage, pairIndex, 1, event.target.value)
                                                        }
                                                    />
                                                </div>
                                                <div className={classes.player_bracket}>
                                                    {/* Indicator for the winner or grey-indicator for 'Tie' or undefined */}
                                                    {pair.team2 === winner ? (
                                                        <div className={classes['green-indicator']}></div>
                                                    ) : winner === 'Tie' || winner === undefined ? (
                                                        <div className={classes['grey-indicator']}></div>
                                                    ) : (
                                                        <div className={classes['red-indicator']}></div>
                                                    )}

                                                    <label htmlFor={`score-team2-${pairIndex}`}>{team2}</label>
                                                    <div>Rate:</div>
                                                    {hasTruthyPlayers && (
                                                        <div className="castle-dropdown-class">
                                                            {/* <label htmlFor={`castle-team2-${pairIndex}`}>{team2}</label> */}
                                                            <select
                                                                id={`castle-team2-${pairIndex}`}
                                                                value={castle2 ? castle2 : ''}
                                                                onChange={(event) =>
                                                                    handleCastleChange(
                                                                        stageIndex,
                                                                        pairIndex,
                                                                        2,
                                                                        event.target.value,
                                                                        setPlayoffPairs
                                                                    )
                                                                }
                                                            >
                                                                <option value="">Select a castle</option>
                                                                <option value="Castle-Замок">Castle</option>
                                                                <option value="Rampart-Оплот">Rampart</option>
                                                                <option value="Tower-Башня">Tower</option>
                                                                <option value="Inferno-Инферно">Inferno</option>
                                                                <option value="Necropolis-Некрополис">
                                                                    Necropolis
                                                                </option>
                                                                <option value="Dungeon-Подземелье">Dungeon</option>
                                                                <option value="Stronghold-Цитадель">Stronghold</option>
                                                                <option value="Fortress-Болото">Fortress</option>
                                                                <option value="Conflux-Сопряжение">Conflux</option>
                                                                <option value="Cove-Пиратская бухта">Cove</option>
                                                            </select>
                                                        </div>
                                                    )}
                                                    <input
                                                        type="text"
                                                        id={`score-team2-${pairIndex}`}
                                                        value={score2 || ''}
                                                        onChange={(event) =>
                                                            handleScoreChange(stage, pairIndex, 2, event.target.value)
                                                        }
                                                    />
                                                </div>
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

function handleCastleChange(stageIndex, pairIndex, teamIndex, castleName, setPlayoffPairs) {
    setPlayoffPairs((prevPairs) => {
        const updatedPairs = [...prevPairs];
        const pair = updatedPairs[stageIndex][pairIndex];

        if (teamIndex === 1) {
            pair.castle1 = castleName;
        } else if (teamIndex === 2) {
            pair.castle2 = castleName;
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
