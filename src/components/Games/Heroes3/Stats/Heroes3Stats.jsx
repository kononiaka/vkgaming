import { useEffect, useState } from 'react';
import classes from './Heroes3Stats.module.css';

const Heroes3Stats = () => {
    let [castles, setCastles] = useState([]);
    const [inProgressCastles, setInProgressCastles] = useState(new Set());

    useEffect(() => {
        // Fetch Heroes 3 games from database
        const fetchCastlesList = async () => {
            try {
                const response = await fetch(
                    'https://test-prod-app-81915-default-rtdb.firebaseio.com/statistic/heroes3/castles.json'
                );
                const data = await response.json();

                castles = Object.entries(data).map(([id, castle]) => ({
                    id: id,
                    name: id,
                    win: castle.win,
                    lose: castle.lose,
                    total: castle.total,
                    rate: castle.total !== 0 ? (castle.win / castle.total) * 100 : 0
                }));

                castles.sort((a, b) => b.rate - a.rate);

                setCastles(castles);
            } catch (error) {
                console.error(error);
            }
        };

        // Fetch in-progress games to identify castles with ongoing games
        const fetchInProgressGames = async () => {
            try {
                const response = await fetch(
                    'https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments.json'
                );
                const data = await response.json();
                const castlesInProgress = new Set();

                if (data) {
                    // Iterate through all tournament objects
                    Object.keys(data).forEach((tournamentKey) => {
                        const tournaments = data[tournamentKey];
                        console.log('Processing tournament:', tournaments);
                        for (const tournament in tournaments) {
                            const tourney = tournaments[tournament];
                            console.log('Processing individual tournament:', tourney);

                            // Check if tournament has bracket with playoffPairs
                            const pairs = tourney.bracket?.playoffPairs || tourney.playoffPairs;
                            if (pairs && Array.isArray(pairs)) {
                                pairs.forEach((stage) => {
                                    if (Array.isArray(stage)) {
                                        stage.forEach((pair) => {
                                            // Check for BO-1 games (single game with castle1/castle2)
                                            if (pair.gameStatus === 'In Progress' && pair.castle1 && pair.castle2) {
                                                console.log('Found BO-1 in progress:', pair.castle1, pair.castle2);
                                                castlesInProgress.add(pair.castle1);
                                                castlesInProgress.add(pair.castle2);
                                            }
                                            // Check for BO-3 games (games array)
                                            if (pair.games && Array.isArray(pair.games)) {
                                                pair.games.forEach((game) => {
                                                    if (
                                                        game.gameStatus === 'In Progress' &&
                                                        game.castle1 &&
                                                        game.castle2
                                                    ) {
                                                        console.log(
                                                            'Found BO-3 game in progress:',
                                                            game.castle1,
                                                            game.castle2
                                                        );
                                                        castlesInProgress.add(game.castle1);
                                                        castlesInProgress.add(game.castle2);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        }
                    });
                }

                console.log('Castles with in-progress games:', Array.from(castlesInProgress));

                setInProgressCastles(castlesInProgress);
            } catch (error) {
                console.error('Error fetching in-progress games:', error);
            }
        };

        fetchCastlesList();
        fetchInProgressGames();
    }, []);

    const getRows = () => {
        const rows = [];
        for (let i = 0; i < castles.length; i++) {
            const castleRows = castles[i];
            const castleName = castleRows ? castleRows.name : '-';
            const castleTotal = castleRows ? castleRows.total : '-';
            const castleWin = castleRows ? castleRows.win : '-';
            const castleLose = castleRows ? castleRows.lose : '-';
            const castleRate = castleTotal ? `${(castleWin / castleTotal) * 100} %` : '-';

            const hasInProgressGame = inProgressCastles.has(castleName);
            rows.push(
                <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {castleName}
                            {hasInProgressGame && (
                                <span
                                    className={classes.liveDot}
                                    title="Game in progress - Total includes ongoing games not yet completed"
                                ></span>
                            )}
                        </div>
                    </td>
                    <td>{castleTotal}</td>
                    <td>{castleWin}</td>
                    <td>{castleLose}</td>
                    <td>{castleRate}</td>
                </tr>
            );
        }
        return rows;
    };
    return (
        <div className={classes.statsContainer}>
            <h2 className={classes.title}>Castle Statistics</h2>
            <div className={classes.tableWrapper}>
                <table className={classes.statsTable}>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Castle</th>
                            <th>Total Games</th>
                            <th>Wins</th>
                            <th>Losses</th>
                            <th>Win Rate</th>
                        </tr>
                    </thead>
                    <tbody>{getRows()}</tbody>
                </table>
            </div>
        </div>
    );
};

export default Heroes3Stats;
