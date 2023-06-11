import { useEffect, useState } from 'react';
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

        // setStageLabels(labels);

        setGamesPerStage({
            '1/8 Final': 8,
            'Quater-final': 4,
            'Semi-final': 2,
            'Third Place': 1,
            Final: 1,
            Winner: 1
        });
    }, [maxPlayers]);

    // Shuffle the array using Fisher-Yates algorithm
    useEffect(() => {
        setShuffledNames([...uniquePlayerNames]);
    }, [uniquePlayerNames]);

    useEffect(() => {
        // console.log('==============playoffPairs==============', playoffPairs);
    }, [playoffPairs]);

    const shuffleArray = () => {
        const shuffledArray = [...shuffledNames];
        for (let i = shuffledArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
        }
        setShuffledNames(shuffledArray);
    };

    useEffect(() => {
        const fetchPlayoffPairs = async () => {
            try {
                const response = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/pairs/.json`
                );

                if (response.ok) {
                    const data = await response.json();
                    const key = Object.keys(data)[0];

                    console.log('data[key]', data[key]);

                    let semiFinals = data[key].playoffPairs[0];
                    let stageLabelsArray = data[key].stageLabels;
                    console.log('quarterFinals', semiFinals);
                    console.log('stageLabelsArray', stageLabelsArray);

                    // const updatedPairs = [data['0'], data['1']];
                    setPlayoffPairs(data[key].playoffPairs);
                    setStageLabels(data[key].stageLabels);
                } else {
                    console.log('Failed to fetch playoff pairs');
                }
            } catch (error) {
                console.error('Error fetching playoff pairs:', error);
            }
        };

        fetchPlayoffPairs();
    }, []);

    useEffect(() => {
        const updatedPairs = [];
        stageLabels.forEach((stage, index) => {
            const numGames = gamesPerStage[stage];
            const pairs = [];

            for (let i = 0; i < numGames; i++) {
                let team1 = 'TBA';
                let score1 = undefined;
                let team2 = 'TBA';
                let score2 = undefined;

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

        // setPlayoffPairs(updatedPairs);
    }, [stageLabels, gamesPerStage, shuffledNames]);

    // useEffect(() => {
    //     shuffleArray(uniquePlayerNames);
    // }, []);

    const getWinner = (pair) => {
        const score1 = parseInt(pair.score1) || 0;
        const score2 = parseInt(pair.score2) || 0;

        if (score1 < score2) {
            return `${pair.team1} wins`;
        } else if (score1 > score2) {
            return `${pair.team2} wins`;
        } else {
            return 'Tie';
        }
    };

    const handleStartTournament = async () => {
        setStartTournament(true);
        console.log(stageLabels);
        // Prepare the tournament data
        const tournamentData = {
            stageLabels: stageLabels,
            playoffPairs: playoffPairs
        };

        console.log('tournamentData', tournamentData);

        try {
            const response = await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/pairs/.json`,
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

    const handleScoreChange = (pairIndex, teamIndex, newScore) => {
        setPlayoffPairs((prevPairs) => {
            const updatedPairs = [...prevPairs];
            const pair = updatedPairs[currentStageIndex][pairIndex];

            if (teamIndex === 1) {
                pair.score1 = newScore;
                console.log('pair1', pair);
                console.log('pair.score1', pair.score1);
            } else if (teamIndex === 2) {
                console.log('pair2', pair);
                pair.score2 = newScore;
                console.log('pair.score2', pair.score2);
            }

            if (pair.score1 !== null && pair.score2 !== null) {
                pair.winner = getWinner(pair);
            }

            return updatedPairs;
        });
    };

    return (
        <div className={classes['scrollable-list']}>
            {!startTournament && <button onClick={handleStartTournament}>Start Tournament</button>}
            {!startTournament && <button onClick={() => shuffleArray(uniquePlayerNames)}>Shuffle</button>}
            {stageLabels.map((stage, index) => (
                <div key={stage} className={`${classes.brackets} ${index === currentStageIndex ? classes.active : ''}`}>
                    <h3 style={{ color: 'red' }}>Stage: {stage}</h3>
                    {playoffPairs[index]?.map((pair, pairIndex) => (
                        <div key={pairIndex}>
                            <p>{`Match ${pairIndex + 1}`}</p>
                            <div>
                                <label htmlFor={`score-team1-${pairIndex}`}>{pair.team1}</label>
                                <input
                                    type="text"
                                    id={`score-team1-${pairIndex}`}
                                    value={pair.score1 || ''}
                                    onChange={(event) => handleScoreChange(pairIndex, 1, event.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor={`score-team2-${pairIndex}`}>{pair.team2}</label>
                                <input
                                    type="text"
                                    id={`score-team2-${pairIndex}`}
                                    value={pair.score2 || ''}
                                    onChange={(event) => handleScoreChange(pairIndex, 2, event.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export const checkRegisterUser = (authCtx, players) => {
    console.log('players', players);
    let { userNickName } = authCtx;
    console.log(userNickName);

    return true;
};

export const renderPlayerList = (players) => {
    const playerNames = Object.values(players)
        .filter((player) => player !== null)
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
                {playerNames.map((name, index) => (
                    <li key={index}>{formatPlayerName({ name })}</li>
                ))}
            </ul>
        </>
    );
};
