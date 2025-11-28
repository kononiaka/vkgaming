import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    fetchLastGamesForPlayer,
    fetchBestAndWorstCastleForPlayer,
    fetchFullCastleStatsForPlayer,
    fetchLeaderboard,
    fetchBestAndWorstOpponentForPlayer
} from '../../api/api'; // Make sure this path is correct
import classes from './Players.module.css';
import StarsComponent from '../Stars/Stars';

const PlayerDetails = () => {
    const [player, setPlayer] = useState(null);
    const { id } = useParams();
    const [leaderboardPlace, setLeaderboardPlace] = useState(null);
    const [streak, setStreak] = useState([]);
    const [bestCastle, setBestCastle] = useState(null);
    const [worstCastle, setWorstCastle] = useState(null);
    const [bestOpponent, setBestOpponent] = useState(null);
    const [worstOpponent, setWorstOpponent] = useState(null);
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
        if (player) {
            fetchLeaderboard(player).then((place) => {
                if (place !== null) {
                    setLeaderboardPlace(place);
                }
            });
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

    // Fetch best and worst opponent
    useEffect(() => {
        const fetchBestAndWorstOpponent = async () => {
            if (player && player.enteredNickname) {
                const { best, worst } = await fetchBestAndWorstOpponentForPlayer(player.enteredNickname);
                setBestOpponent(best);
                setWorstOpponent(worst);
            }
        };
        fetchBestAndWorstOpponent();
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
        <div className={classes.playerContainer}>
            {player ? (
                <>
                    <h2 className={classes.header}>🎮 Player Details</h2>
                    <p className={classes.playerName}>{player.enteredNickname}</p>

                    <div className={classes.statsGrid}>
                        <div className={classes.statCard}>
                            <div className={classes.statLabel}>Wins</div>
                            <div className={classes.statValue}>
                                {player.gamesPlayed.heroes3.total - player.gamesPlayed.heroes3.lose}
                            </div>
                        </div>
                        <div className={classes.statCard}>
                            <div className={classes.statLabel}>Losses</div>
                            <div className={classes.statValue}>{player.gamesPlayed.heroes3.lose}</div>
                        </div>
                        <div className={classes.statCard}>
                            <div className={classes.statLabel}>Total Games</div>
                            <div className={classes.statValue}>{player.gamesPlayed.heroes3.total}</div>
                        </div>
                        <div className={classes.statCard}>
                            <div className={classes.statLabel}>Rating</div>
                            <div className={classes.statValue}>
                                {parseFloat(player.ratings.split(',').pop()).toFixed(2)}
                            </div>
                        </div>
                        <div className={classes.statCard}>
                            <div className={classes.statLabel}>Stars</div>
                            <div className={classes.statValue}>
                                <StarsComponent stars={player.stars} />
                            </div>
                        </div>
                        <div className={classes.statCard}>
                            <div className={classes.statLabel}>Total Winnings</div>
                            <div className={classes.statValue}>${(player.totalPrize || 0).toFixed(2)}</div>
                        </div>
                        <div className={classes.statCard}>
                            <div className={classes.statLabel}>Leaderboard Rank</div>
                            <div className={classes.statValue}>
                                #{leaderboardPlace !== null ? leaderboardPlace : '...'}
                            </div>
                        </div>
                    </div>

                    <div className={classes.section}>
                        <h3 className={classes.sectionTitle}>🏆 Tournament Prizes</h3>
                        {Array.isArray(player.prizes) && player.prizes.length > 0 ? (
                            <table className={classes.prizesTable}>
                                <thead>
                                    <tr>
                                        <th>Tournament</th>
                                        <th>Place</th>
                                        <th>Prize</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...player.prizes].reverse().map((prize, idx) => (
                                        <tr key={idx}>
                                            <td>{prize.tournamentName}</td>
                                            <td className={classes.prizePlace}>{prize.place}</td>
                                            <td className={classes.prizeAmount}>${prize.prizeAmount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className={classes.noPrizes}>No prizes yet</div>
                        )}
                    </div>

                    <div className={classes.section}>
                        <h3 className={classes.sectionTitle}>🔥 Recent Streak</h3>
                        <div className={classes.streak}>
                            {streak.length === 0 ? (
                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>No games found</span>
                            ) : (
                                streak.map((g, i) => (
                                    <span
                                        key={i}
                                        title={`vs ${g.opponent}`}
                                        className={`${classes.streakDot} ${g.result === 'Win' ? classes.win : classes.lose}`}
                                    ></span>
                                ))
                            )}
                        </div>
                    </div>

                    <div className={classes.section}>
                        <h3 className={classes.sectionTitle}>🏯 Castle Performance</h3>
                        <div className={classes.castleInfo}>
                            <div className={`${classes.castleCard} ${classes.best}`}>
                                <div className={classes.castleName}>🏆 Best Castle</div>
                                <div className={classes.castleStats}>
                                    {bestCastle
                                        ? `${bestCastle.castle} (${bestCastle.wins}W - ${bestCastle.loses}L)`
                                        : 'N/A'}
                                </div>
                            </div>
                            <div className={`${classes.castleCard} ${classes.worst}`}>
                                <div className={classes.castleName}>🚨 Worst Castle</div>
                                <div className={classes.castleStats}>
                                    {worstCastle
                                        ? `${worstCastle.castle} (${worstCastle.wins}W - ${worstCastle.loses}L)`
                                        : 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={classes.section}>
                        <h3 className={classes.sectionTitle}>🎯 Opponent Performance</h3>
                        <div className={classes.castleInfo}>
                            <div className={`${classes.castleCard} ${classes.best}`}>
                                <div className={classes.castleName}>🏆 Best Record vs</div>
                                <div className={classes.castleStats}>
                                    {bestOpponent
                                        ? `${bestOpponent.opponent} (${bestOpponent.wins}W - ${bestOpponent.loses}L)`
                                        : 'N/A'}
                                </div>
                            </div>
                            <div className={`${classes.castleCard} ${classes.worst}`}>
                                <div className={classes.castleName}>🚨 Worst Record vs</div>
                                <div className={classes.castleStats}>
                                    {worstOpponent
                                        ? `${worstOpponent.opponent} (${worstOpponent.wins}W - ${worstOpponent.loses}L)`
                                        : 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <button className={classes.btn} onClick={handleShowCastleStats}>
                        📊 Show Full Castle Statistics
                    </button>
                    {showPopup && castleStats && (
                        <>
                            <div className={classes.popupOverlay} onClick={() => setShowPopup(false)}></div>
                            <div className={classes.popup}>
                                <h3 className={classes.popupTitle}>🏯 Full Castle Statistics</h3>
                                <table className={classes.castleStatsTable}>
                                    <thead>
                                        <tr>
                                            <th>Castle</th>
                                            <th>Wins</th>
                                            <th>Losses</th>
                                            <th>Win Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(castleStats).map(([castle, stats]) => {
                                            const total = stats.wins + stats.loses;
                                            const winRate = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : '0.0';
                                            return (
                                                <tr key={castle}>
                                                    <td>{castle}</td>
                                                    <td style={{ color: '#4caf50', fontWeight: 'bold' }}>
                                                        {stats.wins}
                                                    </td>
                                                    <td style={{ color: '#f44336', fontWeight: 'bold' }}>
                                                        {stats.loses}
                                                    </td>
                                                    <td style={{ color: '#FFD700', fontWeight: 'bold' }}>{winRate}%</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <button className={classes.btn} onClick={() => setShowPopup(false)}>
                                    ✖ Close
                                </button>
                            </div>
                        </>
                    )}
                </>
            ) : (
                <p className={classes.loading}>Loading player details...</p>
            )}
        </div>
    );
};

export default PlayerDetails;
