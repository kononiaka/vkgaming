import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    fetchLastGamesForPlayer,
    fetchBestAndWorstCastleForPlayer,
    fetchFullCastleStatsForPlayer
} from '../../api/api'; // Make sure this path is correct

const PlayerDetails = () => {
    const [player, setPlayer] = useState(null);
    const { id } = useParams();
    const [leaderboardPlace, setLeaderboardPlace] = useState(null);
    const [streak, setStreak] = useState([]);
    const [bestCastle, setBestCastle] = useState(null);
    const [worstCastle, setWorstCastle] = useState(null);
    const [castleStats, setCastleStats] = useState(null);
    const [showPopup, setShowPopup] = useState(false);

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
                setPlayer(data);
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

    // Fetch streak (last 10 games)
    useEffect(() => {
        const fetchStreak = async () => {
            if (player && player.enteredNickname) {
                const games = await fetchLastGamesForPlayer(player.enteredNickname, 10);
                setStreak(games);
            }
        };
        fetchStreak();
    }, [player]);

    // Fetch best and worst castle
    useEffect(() => {
        const fetchBestAndWorstCastle = async () => {
            if (player && player.enteredNickname) {
                const { best, worst } = await fetchBestAndWorstCastleForPlayer(player.enteredNickname);
                setBestCastle(best);
                setWorstCastle(worst);
            }
        };
        fetchBestAndWorstCastle();
    }, [player]);

    const handleShowCastleStats = async () => {
        if (showPopup) {
            setShowPopup(false);
            return;
        }
        const stats = await fetchFullCastleStatsForPlayer(player.enteredNickname);
        setCastleStats(stats);
        setShowPopup(true);
    };

    return (
        <div>
            {player ? (
                <div style={{ color: 'white' }}>
                    <h2>Player Details</h2>
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
                        <li>
                            Streak:&nbsp;
                            {streak.length === 0 && 'No games found'}
                            {streak.map((g, i) => (
                                <span
                                    key={i}
                                    title={g.opponent}
                                    style={{
                                        display: 'inline-block',
                                        width: 14,
                                        height: 14,
                                        borderRadius: '50%',
                                        background: g.result === 'Win' ? '#4caf50' : '#f44336',
                                        marginRight: 4,
                                        verticalAlign: 'middle',
                                        cursor: 'pointer'
                                    }}
                                ></span>
                            ))}
                        </li>
                        <li>
                            Best Castle:{' '}
                            {bestCastle
                                ? `${bestCastle.castle} (Wins: ${bestCastle.wins} - Loses: ${bestCastle.loses})`
                                : 'N/A'}
                        </li>
                        <li>
                            Worst Castle:{' '}
                            {worstCastle
                                ? `${worstCastle.castle} (Wins: ${worstCastle.wins} - Loses: ${worstCastle.loses})`
                                : 'N/A'}
                        </li>
                        <li>Twitch:</li>
                        <li>Youtube:</li>
                        <li>Telegram:</li>
                    </ul>
                    <button onClick={handleShowCastleStats}>Show Full Castle Statistics</button>
                    {showPopup && castleStats && (
                        <div>
                            <h3>Full Castle Statistics</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Castle</th>
                                        <th>Wins</th>
                                        <th>Loses</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(castleStats).map(([castle, stats]) => (
                                        <tr key={castle}>
                                            <td>{castle}</td>
                                            <td>{stats.wins}</td>
                                            <td>{stats.loses}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button onClick={() => setShowPopup(false)}>Close</button>
                        </div>
                    )}
                </div>
            ) : (
                <p>Loading player details...</p>
            )}
        </div>
    );
};

export default PlayerDetails;
