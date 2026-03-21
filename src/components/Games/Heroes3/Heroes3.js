import { useEffect, useState } from 'react';

import classes from './Heroes3.module.css';

const Heroes3Games = () => {
    let [games, setGames] = useState([]);
    const [sortBy, setSortBy] = useState('date-desc');
    const [searchPlayer, setSearchPlayer] = useState('');
    const [isLoaded, setIsLoaded] = useState(false);

    const formatGameType = (gameType) => {
        const normalized = String(gameType ?? '')
            .toLowerCase()
            .trim();

        if (normalized === '1' || normalized === 'bo1' || normalized === 'bo-1') {
            return 'bo-1';
        }

        if (normalized === '3' || normalized === 'bo3' || normalized === 'bo-3') {
            return 'bo-3';
        }

        return gameType;
    };

    useEffect(() => {
        // Fetch Heroes 3 games from database
        const fetchGamesList = async () => {
            try {
                const response = await fetch(
                    'https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3.json'
                );
                const data = await response.json();

                if (data) {
                    games = Object.entries(data).map(([id, game]) => ({
                        id: id,
                        date: game.date,
                        gameName: game.gameName,
                        gameType: game.gameType,
                        tournamentName: game.tournamentName,
                        stage: game.stage,
                        opponent1: game.opponent1,
                        opponent1Castle: game.opponent1Castle,
                        opponent2: game.opponent2,
                        opponent2Castle: game.opponent2Castle,
                        score: game.score,
                        winner: game.winner
                    }));

                    console.log('games', games);
                    setGames(games);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoaded(true);
            }
        };

        fetchGamesList();
    }, []);

    // Filter games by player name search
    const filteredGames = games.filter((game) => {
        if (!searchPlayer) {
            return true;
        }
        const search = searchPlayer.toLowerCase();
        return (
            (game.opponent1 || '').toLowerCase().includes(search) ||
            (game.opponent2 || '').toLowerCase().includes(search)
        );
    });

    // Sort filtered games based on selected criteria
    const sortedGames = [...filteredGames].sort((a, b) => {
        if (sortBy === 'date-desc') {
            return new Date(b.date) - new Date(a.date);
        } else if (sortBy === 'date-asc') {
            return new Date(a.date) - new Date(b.date);
        }
        return 0;
    });

    return (
        <div className={classes.gamesContainer}>
            <h2 className={classes.header}>🎮 Heroes 3 Games History</h2>
            {!isLoaded ? (
                <p className={classes.loading}>Loading games...</p>
            ) : games.length === 0 ? (
                <p className={classes.loading}>No games found.</p>
            ) : (
                <>
                    <div className={classes.controls}>
                        <div className={classes.searchBox}>
                            <label className={classes.controlLabel}>🔍 Search Player:</label>
                            <input
                                type="text"
                                className={classes.searchInput}
                                placeholder="Type player name..."
                                value={searchPlayer}
                                onChange={(e) => setSearchPlayer(e.target.value)}
                            />
                        </div>
                        <div className={classes.sortBox}>
                            <label className={classes.controlLabel}>📊 Sort by:</label>
                            <select
                                className={classes.sortSelect}
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="date-desc">Date (Newest First)</option>
                                <option value="date-asc">Date (Oldest First)</option>
                            </select>
                        </div>
                    </div>
                    <div className={classes.gamesList}>
                        {sortedGames.map((game) => (
                            <div key={game.id} className={classes.gameCard}>
                                <div className={classes.gameHeader}>
                                    <span className={classes.gameDate}>📅 {game.date}</span>
                                    {game.gameType && (
                                        <span className={classes.gameType}>{formatGameType(game.gameType)}</span>
                                    )}
                                </div>
                                {(game.tournamentName || game.stage) && (
                                    <div className={classes.tournamentInfo}>
                                        {game.tournamentName && (
                                            <span className={classes.tournamentName}>🏆 {game.tournamentName}</span>
                                        )}
                                        {game.stage && <span className={classes.stage}>🎯 {game.stage}</span>}
                                    </div>
                                )}
                                <div className={classes.matchup}>
                                    <div
                                        className={`${classes.player} ${game.winner === game.opponent1 ? classes.winnerPlayer : ''}`}
                                    >
                                        <div className={classes.playerName}>{game.opponent1}</div>
                                        {game.opponent1Castle && (
                                            <div className={classes.castle}>🏰 {game.opponent1Castle}</div>
                                        )}
                                    </div>
                                    <div className={classes.vs}>VS</div>
                                    <div
                                        className={`${classes.player} ${game.winner === game.opponent2 ? classes.winnerPlayer : ''}`}
                                    >
                                        <div className={classes.playerName}>{game.opponent2}</div>
                                        {game.opponent2Castle && (
                                            <div className={classes.castle}>🏰 {game.opponent2Castle}</div>
                                        )}
                                    </div>
                                </div>
                                {game.score && <div className={classes.score}>Score: {game.score}</div>}
                                {game.winner && <div className={classes.winner}>🏆 Winner: {game.winner}</div>}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default Heroes3Games;
