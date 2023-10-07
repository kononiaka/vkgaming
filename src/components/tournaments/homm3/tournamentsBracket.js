import { useEffect, useState } from 'react';
import { loadUserById, lookForUserId } from '../../../api/api';
import classes from './tournamentsBracket.module.css';

const formatPlayerName = (player) => player.name;

const uniquePlayerNames = [];
const currentStageIndex = 0;

export const TournamentBracket = ({ maxPlayers, tournamentId }) => {
    maxPlayers.length = 8;
    // maxPlayers.length = Object.keys(maxPlayers).length;
    // console.log('tournamentId', tournamentId);

    const [stageLabels, setStageLabels] = useState([]);
    const [gamesPerStage, setGamesPerStage] = useState({});
    const [shuffledNames, setShuffledNames] = useState([]);
    const [playoffPairs, setPlayoffPairs] = useState([]);
    const [startTournament, setStartTournament] = useState(false);
    const [isUpdateButtonVisible, setUpdateButtonVisible] = useState(true);

    // Determine the stage label based on the number of max players
    useEffect(() => {
        let labels = [];
        // let gamesPerStageData = {};

        if (maxPlayers && maxPlayers.length === 4) {
            labels = ['Semi-final', 'Third Place', 'Final', 'Winner'];
        } else if (maxPlayers && maxPlayers.length === 8) {
            labels = ['Quater-final', 'Semi-final', 'Third Place', 'Final', 'Winner'];
        } else if (maxPlayers && maxPlayers.length === 16) {
            labels = ['1/8 Final', 'Quater-final', 'Semi-final', 'Third Place', 'Final', 'Winner'];
        } else if (maxPlayers && maxPlayers.length === 32) {
            labels = ['1/16 Final', '1/8 Final', 'Quater-final', 'Semi-final', 'Third Place', 'Final', 'Winner'];
        }

        setStageLabels(labels);

        setGamesPerStage({
            '1/32 Final': 32,
            '1/16 Final': 16,
            '1/8 Final': 8,
            'Quater-final': 4,
            'Semi-final': 2,
            'Third Place': 1,
            Final: 1
        });
    }, [maxPlayers]);

    // Shuffle the array using Fisher-Yates algorithm
    useEffect(() => {
        setShuffledNames([...uniquePlayerNames]);
    }, [uniquePlayerNames]);

    const shuffleArray = () => {
        const shuffledArray = [...shuffledNames];
        const remainingPlayers = maxPlayers.length - shuffledNames.length;

        // Check if there are remaining spots and add players as TBA
        if (remainingPlayers > 0) {
            for (let i = 0; i < remainingPlayers; i++) {
                shuffledArray.push('TBA');
            }
        }

        for (let i = shuffledArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
        }
        setShuffledNames([...shuffledArray]); // Update the state with the shuffled array
        setPlayoffPairs(shuffledNames);
        createPlayoffPairs();
    };

    useEffect(() => {
        const fetchPlayoffPairs = async () => {
            try {
                // console.log('tournamentId', tournamentId);
                const response = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`
                );

                if (response.ok) {
                    const data = await response.json();

                    if (data === null) {
                        return false;
                        // Tournament registration hasn't started
                    }
                    setStartTournament(true);
                    // Parse the object
                    setPlayoffPairs(data?.playoffPairs);
                    console.log('data?.playoffPairs', data?.playoffPairs);
                } else {
                    console.log('Failed to fetch playoff pairs');
                }
            } catch (error) {
                console.error('Error fetching playoff pairs:', error);
            }
        };
        fetchPlayoffPairs();
    }, []);

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

                pairs.push({ team1, team2, score1, score2 });
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
            return `${pair.team1}`;
        } else if (score1 < score2) {
            return `${pair.team2}`;
        } else {
            return 'Tie';
        }
    };

    const handleStartTournament = async () => {
        setStartTournament(true);
        // console.log(stageLabels);
        // Prepare the tournament data

        const tournamentData = {
            stageLabels: stageLabels,
            playoffPairs: playoffPairs
        };

        // console.log('tournamentData', tournamentData);

        try {
            const response = await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`,
                {
                    method: 'POST',
                    body: JSON.stringify(tournamentData),
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

        console.log('tournamentData', tournamentData);

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
                //else
                const tournamentDataWithWinners = {
                    playoffPairs: retrievedWinners
                };
                // console.log('retrievedWinners', JSON.stringify(retrievedWinners));

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
                    console.log('retrievedWinners', retrievedWinners);
                    const lastStage = retrievedWinners[retrievedWinners.length - 1];
                    console.log('lastStage', lastStage);
                    const firstPlace = lastStage[lastStage.length - 1].winner;
                    const secondPlace =
                        firstPlace === lastStage[lastStage.length - 1].team1
                            ? lastStage[lastStage.length - 1].team2
                            : lastStage[lastStage.length - 1].team1;
                    console.log('secondPlace', secondPlace);
                    console.log('firstPlace', firstPlace);
                    if (firstPlace) {
                        const winnersData = await fetch(
                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/.json`
                        );

                        console.log('response', winnersData);

                        if (winnersData.ok) {
                            const existingData = await winnersData.json();

                            console.log('existingData', existingData);

                            // Modify the '1st place' and '2nd place' fields
                            existingData['1st place'] = firstPlace;
                            existingData['2nd place'] = secondPlace;

                            let firstPlaceId = await lookForUserId(firstPlace);
                            let secondPlaceId = await lookForUserId(secondPlace);

                            let firstPlaceRecord = await loadUserById(firstPlaceId);

                            console.log('firstPlaceRecord', firstPlaceRecord);

                            // Check if "prizes" property exists and is an object

                            //herehere
                            const response = await fetch(
                                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/.json`,
                                {
                                    method: 'PUT',
                                    body: JSON.stringify(existingData),
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                }
                            );
                            if (response.ok) {
                                const response = await fetch(
                                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/status.json`,
                                    {
                                        method: 'PUT',
                                        body: JSON.stringify('Tournament Finished'),
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    }
                                );
                                if (response.ok) {
                                    setUpdateButtonVisible(false);

                                    if (response.ok) {
                                        if (!firstPlaceRecord || typeof firstPlaceRecord.prizes !== 'object') {
                                            // If not, initialize "prizes" as an object
                                            firstPlaceRecord.prizes = [];
                                        }

                                        firstPlaceRecord.prizes.push({
                                            tournamentName: 'VKGaming1',
                                            prize: '1st place'
                                        });

                                        const response = await fetch(
                                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${firstPlaceId}.json`,
                                            {
                                                method: 'PUT',
                                                headers: {
                                                    'Content-Type': 'application/json'
                                                },
                                                body: JSON.stringify(firstPlaceRecord)
                                            }
                                        );
                                        if (response.ok) {
                                            console.log('userRecord', firstPlaceRecord);
                                        }
                                    }
                                }
                            } else {
                                const errorMessage = await response.text();
                                console.error('Error:', response.status, errorMessage);
                            }
                        }
                    }
                }

                console.log('playoffPairs', playoffPairs);
                console.log('Pairs posted to Firebase successfully');
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

                // console.log('collectedPlayoffPairs', collectedPlayoffPairs);

                // =========>
                let nextStagePairings;

                for (let currentStage = 0; currentStage < collectedPlayoffPairs.length - 1; currentStage++) {
                    let currentStagePlayoffPairs = collectedPlayoffPairs[currentStage];
                    const currentStagePlayoffWinners = currentStagePlayoffPairs.map((pair) => pair.winner);

                    const nextStageIndex = currentStage + 1;
                    let nextStagePlayoffPairs = collectedPlayoffPairs[nextStageIndex];
                    const nextStagePlayoffWinners = nextStagePlayoffPairs.map((pair) => pair.winner);

                    if (nextStagePlayoffWinners.includes(undefined)) {
                        if (nextStageIndex === 2) {
                            const losers = currentStagePlayoffPairs.map((match) =>
                                nextStagePlayoffWinners.includes(match.team1) ? match.team1 : match.team2
                            );
                            nextStagePairings = determineNextStagePairings(currentStagePlayoffWinners);
                            let thirdPlacePairing = determineNextStagePairings(losers);
                            collectedPlayoffPairs[nextStageIndex + 1] = nextStagePairings;
                            collectedPlayoffPairs[nextStageIndex] = thirdPlacePairing;
                        }
                    }
                }
                // console.log('collectedPlayoffPairs', collectedPlayoffPairs);
                // =========>
                // let firstStagePlayoffPairs = collectedPlayoffPairs[0];

                // // Collect the winners from the playoffPairs data
                // const firstStagePlayoffWinners = firstStagePlayoffPairs.map((pair) => pair.winner);

                // // // Process the winners and determine the next stage pairings

                // let secondStagePlayoffPairs = collectedPlayoffPairs[1];
                // const secondStagePlayoffWinners = secondStagePlayoffPairs.map((pair) => pair.winner);
                // if (secondStagePlayoffWinners.length === 0) {
                //     const nextStagePairings = determineNextStagePairings(firstStagePlayoffWinners);
                //     console.log('nextStagePairings', nextStagePairings);
                //     collectedPlayoffPairs[1] = nextStagePairings;
                // }

                // const test = determineNextStagePairings(secondStagePlayoffWinners);
                // collectedPlayoffPairs[3] = test;

                // let thirdStagePlayoffPairs = collectedPlayoffPairs[2];
                determineThirdPlaceWinner(collectedPlayoffPairs, stageLabels);
                setPlayoffPairs(collectedPlayoffPairs);
                return collectedPlayoffPairs;

                // // Update the pairings for the next stage in the database
                // await updateNextStagePairingsInDatabase(nextStagePairings);

                // // Optionally, update the state in your application to reflect the updated pairings
                // setPlayoffPairs(nextStagePairings);

                // console.log('Next stage pairings:', nextStagePairings);
            } else {
                console.log('Failed to retrieve winners from the database');
            }
        } catch (error) {
            console.error('Error retrieving winners from the database:', error);
        }
    };

    const determineThirdPlaceWinner = async (playOffPairs, stages, tournamentName) => {
        //TODO tournamentName to add
        const thirdPlaceIndex = stages.indexOf('Third Place');
        const thirdPlace = playOffPairs[thirdPlaceIndex];
        // tournamentName = 'VKGaming1';
        if (thirdPlace) {
            let winner = thirdPlace[0].winner;
            let userId = await lookForUserId(winner);
            let userRecord = await loadUserById(userId);

            // Check if "prizes" property exists and is an object
            if (!userRecord || typeof userRecord.prizes !== 'object') {
                // If not, initialize "prizes" as an object
                userRecord.prizes = [];
            }

            userRecord.prizes.push({
                tournamentName: 'VKGaming1',
                prize: '3rd place'
            });

            //TODO thirdplace
            const response = await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/3rd place.json`,
                {
                    method: 'GET'
                }
            );
            const data = await response.json();
            console.log('thirdplace', data);
            if (response.ok && !data) {
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
            } else {
                console.log('Failed to update user data with prizes.');
            }
        }
    };

    // Example functions for processing winners and updating the next stage pairings in the database
    const determineNextStagePairings = (winners) => {
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

            console.log('pair', pair);

            if (teamIndex === 1) {
                pair.score1 = newScore;
            } else if (teamIndex === 2) {
                pair.score2 = newScore;
            }

            if (pair.score1 !== null && pair.score2 !== null) {
                pair.winner = getWinner(pair);
            }
            console.log('updatedPairs', updatedPairs);
            return updatedPairs;
        });
    };

    return (
        <div className={`${classes['scrollable-list']} ${classes['brackets']}`}>
            {!startTournament && <button onClick={handleStartTournament}>Start Tournament</button>}
            {!startTournament && <button onClick={() => shuffleArray(uniquePlayerNames)}>Shuffle</button>}
            {startTournament && isUpdateButtonVisible && (
                <button id="update-tournament" onClick={() => updateTournament()}>
                    Update Tournament
                </button>
            )}
            {stageLabels.length === 0 ? (
                <h6>Tournament registration hasn't started</h6>
            ) : (
                stageLabels.map(function (stage, index) {
                    return (
                        <div
                            key={stage}
                            className={`${classes.brackets} ${index === currentStageIndex ? classes.active : ''}`}
                        >
                            <h3 style={{ color: 'red', paddingBottom: '50px' }}>Stage: {stage}</h3>
                            {playoffPairs[index]?.map((pair, pairIndex) => {
                                const { team1, team2, score1, score2, winner } = pair;
                                return (
                                    <div
                                        key={pairIndex}
                                        // style={{ position: 'relative' }}
                                    >
                                        {stage !== 'Third Place' && stage !== 'Final' && (
                                            <p>{`Match ${pairIndex + 1}`}</p>
                                        )}
                                        <p>{`Best of ${1}`}</p>
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
                })
            )}
        </div>
    );
};

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
