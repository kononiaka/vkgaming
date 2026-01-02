import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    fetchLastGamesForPlayer,
    fetchBestAndWorstCastleForPlayer,
    fetchFullCastleStatsForPlayer,
    fetchLeaderboard,
    fetchBestAndWorstOpponentForPlayer,
    getAvatar
} from '../../api/api'; // Make sure this path is correct
import classes from './Players.module.css';
import StarsComponent from '../Stars/Stars';

// Import castle images
import castleImg from '../../image/castles/castle.jpeg';
import rampartImg from '../../image/castles/rampart.jpeg';
import towerImg from '../../image/castles/tower.jpeg';
import infernoImg from '../../image/castles/inferno.jpeg';
import necropolisImg from '../../image/castles/necropolis.jpeg';
import dungeonImg from '../../image/castles/dungeon.jpeg';
import strongholdImg from '../../image/castles/stronghold.jpeg';
import fortressImg from '../../image/castles/fortress.jpeg';
import factoryImg from '../../image/castles/factory.jpeg';
import confluxImg from '../../image/castles/conflux.jpeg';
import coveImg from '../../image/castles/cove.jpeg';
import kronverkImg from '../../image/castles/kronverk.jpeg';

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
    const [avatarUrl, setAvatarUrl] = useState(null);

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

                // Fetch avatar
                if (data && id) {
                    try {
                        const avatar = await getAvatar(id);
                        setAvatarUrl(avatar);
                    } catch (error) {
                        console.error('Error fetching avatar:', error);
                    }
                }
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
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '15px',
                            marginBottom: '20px'
                        }}
                    >
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt={`${player.enteredNickname}'s avatar`}
                                style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '50%',
                                    border: '3px solid #ffd700',
                                    objectFit: 'cover',
                                    boxShadow: '0 4px 8px rgba(255, 215, 0, 0.4)'
                                }}
                            />
                        ) : (
                            <div
                                style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '50%',
                                    border: '3px solid #ffd700',
                                    backgroundColor: '#1a1a2e',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontFamily: '"Press Start 2P", "Courier New", monospace',
                                    fontSize: '24px',
                                    fontWeight: 'bold',
                                    color: '#00ffff',
                                    textShadow: '2px 2px 4px rgba(0, 255, 255, 0.5)',
                                    boxShadow: '0 4px 8px rgba(255, 215, 0, 0.4)',
                                    imageRendering: 'pixelated'
                                }}
                            >
                                {player.enteredNickname.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <p className={classes.playerName} style={{ margin: 0 }}>
                            {player.enteredNickname}
                        </p>
                    </div>

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
                                <div className={classes.castleStatsHeader}>
                                    <div className={classes.castleStatsTitle}>CASTLE WINRATE</div>
                                    <div className={classes.castleStatsSubtitle}>ALL TIME</div>
                                </div>
                                <div className={classes.castleStatsGrid}>
                                    {(() => {
                                        // Define all available castles with their images
                                        const allCastles = [
                                            { name: 'Castle', image: castleImg },
                                            { name: 'Rampart', image: rampartImg },
                                            { name: 'Tower', image: towerImg },
                                            { name: 'Inferno', image: infernoImg },
                                            { name: 'Necropolis', image: necropolisImg },
                                            { name: 'Dungeon', image: dungeonImg },
                                            { name: 'Stronghold', image: strongholdImg },
                                            { name: 'Fortress', image: fortressImg },
                                            { name: 'Factory', image: factoryImg },
                                            { name: 'Conflux', image: confluxImg },
                                            { name: 'Cove', image: coveImg },
                                            { name: 'Kronverk', image: kronverkImg }
                                        ];

                                        // Merge actual stats with all castles
                                        const mergedData = allCastles.map(({ name, image }) => {
                                            // Find matching stats (handle both "Castle" and "Castle-Замок" formats)
                                            const statsEntry = Object.entries(castleStats).find(([key]) => {
                                                const keyName = key.includes('-') ? key.split('-')[0] : key;
                                                return keyName === name;
                                            });

                                            const stats = statsEntry ? statsEntry[1] : { wins: 0, loses: 0 };
                                            const total = stats.wins + stats.loses;
                                            const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;

                                            return {
                                                name,
                                                image,
                                                stats,
                                                total,
                                                winRate
                                            };
                                        });

                                        // Sort by total games (most played first)
                                        mergedData.sort((a, b) => b.total - a.total);

                                        return mergedData.map(({ name, image, stats, total, winRate }) => (
                                            <div key={name} className={classes.castleStatsCard}>
                                                <div className={classes.castleImageWrapper}>
                                                    {image && (
                                                        <img
                                                            src={image}
                                                            alt={name}
                                                            className={classes.castleStatsImage}
                                                        />
                                                    )}
                                                </div>
                                                <div className={classes.castleStatsName}>{name.toUpperCase()}</div>
                                                <div className={classes.castleStatsTotalGames}>
                                                    <div className={classes.castleStatsLabel}>TOTAL GAMES</div>
                                                    <div className={classes.castleStatsTotalValue}>{total}</div>
                                                </div>
                                                <div className={classes.castleStatsWinRate}>
                                                    <div className={classes.castleStatsLabel}>WIN RATE</div>
                                                    <div className={classes.castleStatsWinValue}>{winRate}%</div>
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                                <button className={classes.closeBtn} onClick={() => setShowPopup(false)}>
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
