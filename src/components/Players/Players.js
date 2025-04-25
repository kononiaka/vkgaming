// PlayerDetails.js

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const PlayerDetails = () => {
    const [player, setPlayer] = useState(null);
    const { id } = useParams();

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
                        <li>Place in Leaderboard: {player.totalPrize}</li>
                        {/* <li>Prizes: {player.prizes}</li> */}
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
