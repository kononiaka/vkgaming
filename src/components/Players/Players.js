import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const PlayerDetails = () => {
    const [player, setPlayer] = useState(null);
    const { id } = useParams();
    const [leaderboardPlace, setLeaderboardPlace] = useState(null);

    console.log('id', id);

    useEffect(() => {
        // Fetch player details based on the ID from the database
        const fetchPlayerDetails = async () => {
            try {
                const response = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${id}.json`
                );
                if (!response.ok) {
                    throw new Error('Unable to fetch data from the server.');
                }
                const data = await response.json();
                console.log('response.data', data);
                setPlayer(data); // Assuming the API response contains player details
            } catch (error) {
                console.error('Error fetching player details:', error);
            }
        };

        fetchPlayerDetails();
    }, [id]);

    useEffect(() => {
        // Fetch all users and determine leaderboard place
        const fetchLeaderboard = async () => {
            try {
                const response = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json`);
                if (!response.ok) throw new Error('Unable to fetch leaderboard.');
                const data = await response.json();
                if (!data || !player) return;

                // Convert users object to array and sort by totalPrize descending
                const usersArray = Object.values(data).filter((u) => u && u.totalPrize !== undefined);
                usersArray.sort((a, b) => (b.totalPrize || 0) - (a.totalPrize || 0));

                // Find the index of the current player
                const place = usersArray.findIndex((u) => u.enteredNickname === player.enteredNickname) + 1;
                setLeaderboardPlace(place);
            } catch (error) {
                console.error('Error fetching leaderboard:', error);
            }
        };

        if (player) {
            fetchLeaderboard();
        }
    }, [player]);

    console.log('player', player);

    return (
        <div>
            {player ? (
                <div style={{ color: 'white' }}>
                    <h2>Player Details</h2>
                    {/* <p>ID: {player.id}</p> */}
                    <p>Name: {player.enteredNickname}</p>
                    <ul>
                        Statistic:
                        <li>Win: {player.gamesPlayed.heroes3.total - player.gamesPlayed.heroes3.lose}</li>
                        <li>Lose: {player.gamesPlayed.heroes3.lose}</li>
                        <li>Total: {player.gamesPlayed.heroes3.total}</li>
                        <li>Rating: {player.ratings.split(',').pop()}</li>
                        <li>Stars: {player.stars}</li>
                        <li>Total win: {player.totalPrize}</li>
                        <li>Place in Leaderboard: {leaderboardPlace !== null ? leaderboardPlace : '...'}</li>
                        <li>
                            Prizes:
                            <ul>
                                {Array.isArray(player.prizes) && player.prizes.length > 0 ? (
                                    [...player.prizes].reverse().map((prize, idx) => (
                                        <li key={idx}>
                                            {prize.tournamentName} — {prize.place} place — {prize.prizeAmount}
                                        </li>
                                    ))
                                ) : (
                                    <li>No prizes</li>
                                )}
                            </ul>
                        </li>
                        <li>Twitch:</li>
                        <li>Youtube:</li>
                        <li>Telegram:</li>
                    </ul>
                    {/* Add more player details as needed */}
                </div>
            ) : (
                <p>Loading player details...</p>
            )}
        </div>
    );
};

export default PlayerDetails;
