import classes from './tournamentsBracket.module.css';

const formatPlayerName = (player) => player.name;

export const renderPlayerList = (players) => (
    <>
        <h4>Players:</h4>
        <ul>
            {Object.values(players)
                .filter((player) => player !== null)
                .map((player) => (
                    <li key={player.name}>{formatPlayerName(player)}</li>
                ))}
        </ul>
    </>
);

export const TournamentBracket = ({ maxPlayers }) => {
    // console.log('maxPlayers', maxPlayers);
    maxPlayers.length = Object.keys(maxPlayers).length;
    let stageLabels = ['1/8 Final', 'Quater-final', 'Semi-final', 'Third Place', 'Final', 'Winner'];

    // Determine the stage label based on the number of max players
    if (maxPlayers && maxPlayers.length === 4) {
        stageLabels = ['Semi-final', 'Third Place', 'Final', 'Winner'];
    } else if (maxPlayers && maxPlayers.length === 8) {
        stageLabels = ['Quater-final', 'Semi-final', 'Third Place', 'Final', 'Winner'];
    } else if (maxPlayers && maxPlayers.length === 16) {
        stageLabels = ['1/8 Final', 'Quater-final', 'Semi-final', 'Third Place', 'Final', 'Winner'];
    }

    const playoffPairs = [
        // Playoff pairs for each stage
        [
            { team1: 'Team A', team2: 'Team B' },
            { team1: 'Team C', team2: 'Team D' }
            // Add more playoff pairs for the 1/8 Final stage
        ],
        [
            { team1: 'Team E', team2: 'Team F' },
            { team1: 'Team G', team2: 'Team H' }
            // Add more playoff pairs for the Quarter-final stage
        ]
        // Add playoff pairs for the remaining stages
    ];

    return (
        <div>
            {stageLabels.map((stage, index) => {
                // console.log('Current stage:', stage); // Add the console log statement here
                console.log('playoffPairs[index]', playoffPairs[index]);
                return (
                    <div key={stage} className={classes.brackets}>
                        <h3>{stage}</h3>
                        {playoffPairs[index]?.map((pair, pairIndex) => (
                            <div key={pairIndex}>
                                <p>{`Match ${pairIndex + 1}`}</p>
                                <p>{pair.team1}</p>
                                <p>{pair.team2}</p>
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
};

export const checkRegisterUser = (authCtx, players) => {
    console.log('players', players);
    let { userNickName } = authCtx;
    console.log(userNickName);

    return true;
};
