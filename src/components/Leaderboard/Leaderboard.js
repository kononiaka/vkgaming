import { useEffect, useState } from 'react';
import classes from './Leaderboard.module.css';

const Leaderboard = () => {
    const [playerScores, setPlayerScores] = useState([]);

    useEffect(() => {
        const fetchPlayerScores = async () => {
            try {
                const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
                if (!response.ok) {
                    throw new Error('Unable to fetch data from the server.');
                }
                const data = await response.json();
                console.log('data', data);
                const scores = Object.entries(data).map(([id, player]) => ({
                    id,
                    enteredNickname: player.enteredNickname,
                    score: player.score,
                    games: player.gamesPlayed.heroes3
                }));
                scores.sort((a, b) => b.score - a.score);
                setPlayerScores(scores);
            } catch (error) {
                console.error(error);
            }
        };
        fetchPlayerScores();
    }, []);

    const getRankClass = (index) => {
        if (index === 0) {
            return classes.gold;
        } else if (index === 1) {
            return classes.silver;
        } else if (index === 2) {
            return classes.bronze;
        } else {
            return '';
        }
    };

    const getRows = () => {
        const rows = [];
        for (let i = 0; i < 10; i++) {
            const player = playerScores[i];
            const enteredNickname = player ? player.enteredNickname : '-';
            const score = player ? player.score : '-';
            const games = player ? player.games : '-';
            rows.push(
                <tr key={i} className={getRankClass(i)}>
                    <td>{i + 1}</td>
                    <td>{enteredNickname}</td>
                    <td>{score}</td>
                    <td>{games}</td>
                </tr>
            );
        }
        return rows;
    };

    return (
        <div className={classes.leaderboard}>
            <h2>Leaderboard</h2>
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Score</th>
                        <th>Games</th>
                    </tr>
                </thead>
                <tbody>{getRows()}</tbody>
            </table>
        </div>
    );
};

export default Leaderboard;
