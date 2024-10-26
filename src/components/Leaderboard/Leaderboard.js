import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { calculateStarsFromRating } from '../../api/api';
import StarsComponent from '../Stars/Stars';
import classes from './Leaderboard.module.css';

const Leaderboard = () => {
    // const [playerScores, setPlayerScores] = useState([]);
    const [playerRating, setPlayerRating] = useState([]);

    useEffect(() => {
        const fetchPlayerScores = async () => {
            try {
                const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
                if (!response.ok) {
                    throw new Error('Unable to fetch data from the server.');
                }
                const data = await response.json();
                // const scores = Object.entries(data).map(([id, player]) => ({
                //     id,
                //     enteredNickname: player.enteredNickname,
                //     score: player.score,
                //     games: player.gamesPlayed.heroes3.total
                // }));

                // scores.sort((a, b) => b.score - a.score);

                // setPlayerScores(scores);

                const playerObj = Object.entries(data)
                    .map(([id, player]) => ({
                        id,
                        enteredNickname: player.enteredNickname,
                        score: player.score,
                        ratings: player.ratings ? player.ratings.toFixed(2) : 0,
                        games: player.gamesPlayed ? player.gamesPlayed.heroes3.total : 0,
                        stars: player.stars
                    }))

                    // .filter((player) => player.ratings > 0)
                    .sort((a, b) => b.ratings - a.ratings);

                    //TODO: refactor this when the max score is 10 and the lowest score is 5 e.g.
                const highestRating = playerObj[0].ratings;
                const lowestRating = Math.min(
                    ...playerObj
                        .filter((player) => player.ratings > 0)
                        .map((player) => {
                            console.log(player.ratings);
                            return player.ratings;
                        })
                );

                // Update each player's stars property
                const playerObjWithStars = playerObj.map((player) => ({
                    ...player,
                    stars: calculateStarsFromRating(player.ratings, highestRating, lowestRating)
                }));

                // console.log('playerObjWithStars', playerObjWithStars);

                setPlayerRating(playerObjWithStars);
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
            // const player = playerScores[i];
            // console.log('playerScores[i]', playerScores[i]);
            const player = playerRating[i];
            console.log('player', player);
            const enteredNickname = player ? player.enteredNickname : '-';
            console.log('enteredNickname', enteredNickname);
            const score = player ? player.score : '-';
            const games = player ? player.games : '-';
            const rating = player ? player.ratings : '-';
            const stars = player ? player.stars : '-';
            const playerId = player ? player.id : '-';
            // console.log('getStarImageFilename', getStarImageFilename(stars));
            rows.push(
                <tr key={i} className={getRankClass(i)}>
                    <td>{i + 1}</td>
                    {/* <td>{enteredNickname}</td> */}
                    <td>
                        {/* Wrap the content in a Link component */}
                        <NavLink to={`/players/${playerId}`}>{enteredNickname}</NavLink>
                    </td>
                    <td>{score}</td>
                    <td>{games}</td>
                    <td>{rating}</td>
                    {/* <td>{stars}</td> */}
                    <td>{<StarsComponent stars={stars} />}</td>
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
                        <th>Rate</th>
                        {/* <th>Stars</th> */}
                        <th>Stars Img</th>
                    </tr>
                </thead>
                <tbody>{getRows()}</tbody>
            </table>
        </div>
    );
};

export default Leaderboard;
