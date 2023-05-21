import { useState, useEffect } from 'react';

import classes from './Heroes3.module.css';

const Heroes3Games = () => {
    const [games, setGames] = useState([]);

    useEffect(() => {
        // Fetch Heroes 3 games from database
        const fetchGamesList = async () => {
            try {
                const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/games.json');
                const data = await response.json();

                const games = Object.entries(data).map(([id, game]) => ({
                    id: id,
                    date: game.date,
                    gameName: game.gameName,
                    gameType: game.gameType,
                    opponent1: game.opponent1,
                    opponent1Castle: game.opponent1Castle,
                    opponent2: game.opponent2,
                    opponent2Castle: game.opponent2Castle,
                    score: game.score,
                    winner: game.winner
                }));

                console.log('games', games);

                setGames(games);
            } catch (error) {
                console.error(error);
            }
        };

        fetchGamesList();
    }, []);

    return (
        <div>
            <h2>Heroes 3 Games</h2>
            <ul className={classes['games-list']}>
                {games.map(game => (
                    <li key={game.id}>
                        <p>Date: {game.date}</p>
                        <p>Opponent 1: {game.opponent1} {game.opponent1Castle}</p>
                        <p>Opponent 2: {game.opponent2} {game.opponent2Castle}</p>
                        <p>Score: {game.score}</p>
                        <p>Winner: {game.winner}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Heroes3Games;