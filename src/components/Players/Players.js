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
    const [goldStats, setGoldStats] = useState(null);
    const [restartStats, setRestartStats] = useState(null);

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

    // Fetch and calculate gold and restart statistics
    useEffect(() => {
        if (!player || !player.enteredNickname) {
            return;
        }

        // Create a listener that updates stats whenever games data changes
        const unsubscribe = fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3.json')
            .then((response) => response.json())
            .then((allGames) => {
                updateGoldAndRestartStats(allGames, player.enteredNickname);
            })
            .catch((error) => {
                console.error('Error fetching gold and restart stats:', error);
                setGoldStats(null);
                setRestartStats(null);
            });

        // Also set up a polling interval to check for updates frequently (every 5 seconds)
        const pollInterval = setInterval(() => {
            fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3.json')
                .then((response) => response.json())
                .then((allGames) => {
                    updateGoldAndRestartStats(allGames, player.enteredNickname);
                })
                .catch((error) => console.error('Error polling games:', error));
        }, 5000); // Update every 5 seconds

        return () => clearInterval(pollInterval);
    }, [player]);

    const updateGoldAndRestartStats = (allGames, playerName) => {
        if (!allGames) {
            setGoldStats(null);
            setRestartStats(null);
            return;
        }

        // Filter games where player is opponent1 or opponent2 and extract gold/restart data
        const playerGames = Object.values(allGames).filter(
            (game) => game.opponent1 === playerName || game.opponent2 === playerName
        );

        if (playerGames.length === 0) {
            setGoldStats(null);
            setRestartStats(null);
            return;
        }

        // Calculate gold statistics
        let totalPositiveGold = 0;
        let totalGames = 0;
        let blueGames = 0; // Games played as blue
        let redGames = 0; // Games played as red

        // Calculate restart statistics and per-game coefficients
        let games111Count = 0; // Count of games using x2 1-11 restarts
        let games112Count = 0; // Count of games using x1 1-12 restart
        let gamesWithRestarts = 0;
        let gamesNoRestarts = 0;
        let totalAnalyzedGames = 0;
        let totalRestartCoefficient = 0; // Sum of coefficients for averaging

        playerGames.forEach((game) => {
            if (game.games && Array.isArray(game.games)) {
                game.games.forEach((g) => {
                    const playerIsTeam1 = game.opponent1 === playerName;
                    const playerGold = playerIsTeam1 ? g.gold1 : g.gold2;
                    const playerColor = playerIsTeam1 ? g.color1 : g.color2;
                    const playerRestarts111 = playerIsTeam1 ? g.restart1_111 : g.restart2_111;
                    const playerRestarts112 = playerIsTeam1 ? g.restart1_112 : g.restart2_112;

                    // Count all gold values (positive, negative, or zero) and track colors
                    if (playerGold !== undefined && playerGold !== null) {
                        totalPositiveGold += playerGold;
                        totalGames++;

                        // Track color
                        if (playerColor === 'blue') {
                            blueGames++;
                        } else if (playerColor === 'red') {
                            redGames++;
                        }
                    }

                    // Calculate per-game restart coefficient
                    if (playerRestarts111 !== undefined && playerRestarts112 !== undefined) {
                        totalAnalyzedGames++;
                        // Calculate coefficient: 1.0 + (restart_111 × 0.5) + (restart_112 × 1.0), max 2.0
                        const gameCoefficient = Math.min(
                            1.0 + (playerRestarts111 || 0) * 0.5 + (playerRestarts112 || 0) * 1.0,
                            2.0
                        );
                        totalRestartCoefficient += gameCoefficient;

                        // Track restart type used for statistics breakdown
                        if (playerRestarts111 && playerRestarts111 > 0) {
                            games111Count++;
                            gamesWithRestarts++;
                        } else if (playerRestarts112 && playerRestarts112 > 0) {
                            games112Count++;
                            gamesWithRestarts++;
                        } else {
                            gamesNoRestarts++;
                        }
                    }
                });
            }
        });

        const averageGold = totalGames > 0 ? (totalPositiveGold / totalGames).toFixed(2) : 0;
        const percent111 = totalAnalyzedGames > 0 ? ((games111Count / totalAnalyzedGames) * 100).toFixed(1) : 0;
        const percent112 = totalAnalyzedGames > 0 ? ((games112Count / totalAnalyzedGames) * 100).toFixed(1) : 0;
        const percentNoRestarts =
            totalAnalyzedGames > 0 ? ((gamesNoRestarts / totalAnalyzedGames) * 100).toFixed(1) : 0;

        setGoldStats({
            averageGold: averageGold,
            totalGames: totalGames,
            totalPositiveGold: totalPositiveGold,
            blueGames: blueGames,
            redGames: redGames
        });

        setRestartStats({
            games111: games111Count,
            games112: games112Count,
            gamesNoRestarts: gamesNoRestarts,
            percent111: percent111,
            percent112: percent112,
            percentNoRestarts: percentNoRestarts,
            gamesWithRestarts: gamesWithRestarts,
            totalAnalyzedGames: totalAnalyzedGames,
            averageCoefficient:
                totalAnalyzedGames > 0 ? (totalRestartCoefficient / totalAnalyzedGames).toFixed(2) : '1.00'
        });
    };

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

                    {/* Gold and Restart Statistics Section */}
                    <div className={classes.section}>
                        <h3 className={classes.sectionTitle}>⚔️ Game Mechanics Stats</h3>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                gap: '1.5rem',
                                marginBottom: '1.5rem'
                            }}
                        >
                            {/* Gold Statistics Card */}
                            <div
                                style={{
                                    background:
                                        'linear-gradient(135deg, rgba(218, 165, 32, 0.1), rgba(255, 215, 0, 0.05))',
                                    border: '2px solid #FFD700',
                                    borderRadius: '8px',
                                    padding: '1.5rem',
                                    boxShadow: '0 4px 12px rgba(255, 215, 0, 0.15)'
                                }}
                            >
                                <h4
                                    style={{
                                        color: '#FFD700',
                                        fontSize: '1.1rem',
                                        marginBottom: '1rem',
                                        textShadow: '0 0 8px rgba(255, 215, 0, 0.3)'
                                    }}
                                >
                                    💰 Gold Statistics
                                </h4>
                                {goldStats ? (
                                    <div style={{ display: 'grid', gap: '0.8rem' }}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <span style={{ color: '#00ffff' }}>Avg Gold Trade</span>
                                            <span
                                                style={{
                                                    color: '#4caf50',
                                                    fontWeight: 'bold',
                                                    fontSize: '1.1rem'
                                                }}
                                            >
                                                +{goldStats.averageGold}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <p style={{ color: '#999', textAlign: 'center' }}>No gold data available</p>
                                )}
                            </div>

                            {/* Flag Statistics Card */}
                            <div
                                style={{
                                    background:
                                        'linear-gradient(135deg, rgba(0, 172, 255, 0.1), rgba(255, 107, 107, 0.05))',
                                    border: '2px solid #00acff',
                                    borderRadius: '8px',
                                    padding: '1.5rem',
                                    boxShadow: '0 4px 12px rgba(0, 172, 255, 0.15)'
                                }}
                            >
                                <h4
                                    style={{
                                        color: '#00acff',
                                        fontSize: '1.1rem',
                                        marginBottom: '1rem',
                                        textShadow: '0 0 8px rgba(0, 172, 255, 0.3)'
                                    }}
                                >
                                    🚩 Flag Statistics
                                </h4>
                                {goldStats ? (
                                    <div style={{ display: 'grid', gap: '0.8rem' }}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                borderBottom: '1px solid rgba(0, 172, 255, 0.2)',
                                                paddingBottom: '0.5rem'
                                            }}
                                        >
                                            <span style={{ color: '#00ffff' }}>🔵 Blue Flag Games</span>
                                            <span style={{ color: '#00acff', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                                {goldStats.blueGames}
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <span style={{ color: '#00ffff' }}>🔴 Red Flag Games</span>
                                            <span style={{ color: '#ff6b6b', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                                {goldStats.redGames}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <p style={{ color: '#999', textAlign: 'center' }}>No flag data available</p>
                                )}
                            </div>

                            {/* Restart Statistics Card */}
                            <div
                                style={{
                                    background:
                                        'linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(129, 199, 132, 0.05))',
                                    border: '2px solid #4caf50',
                                    borderRadius: '8px',
                                    padding: '1.5rem',
                                    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.15)'
                                }}
                            >
                                <h4
                                    style={{
                                        color: '#4caf50',
                                        fontSize: '1.1rem',
                                        marginBottom: '0.5rem',
                                        textShadow: '0 0 8px rgba(76, 175, 80, 0.3)'
                                    }}
                                >
                                    🔄 Restart Strategy
                                </h4>
                                <p
                                    style={{
                                        color: '#888',
                                        fontSize: '0.85rem',
                                        marginBottom: '1rem',
                                        fontStyle: 'italic'
                                    }}
                                >
                                    (Choose either x2 1-11 OR x1 1-12 per game)
                                </p>
                                {restartStats ? (
                                    <div style={{ display: 'grid', gap: '1rem' }}>
                                        {/* 1-11 Restart Strategy */}
                                        <div
                                            style={{
                                                background: 'rgba(76, 175, 80, 0.1)',
                                                border: '1px solid rgba(76, 175, 80, 0.3)',
                                                borderRadius: '6px',
                                                padding: '1rem'
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginBottom: '0.5rem'
                                                }}
                                            >
                                                <span style={{ color: '#00ffff', fontWeight: 'bold' }}>
                                                    x2 1-11 Restarts
                                                </span>
                                                <span
                                                    style={{ color: '#4caf50', fontWeight: 'bold', fontSize: '1.2rem' }}
                                                >
                                                    {restartStats.games111}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    width: '100%',
                                                    height: '6px',
                                                    background: 'rgba(76, 175, 80, 0.2)',
                                                    borderRadius: '3px',
                                                    overflow: 'hidden',
                                                    marginBottom: '0.5rem'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: `${restartStats.percent111}%`,
                                                        height: '100%',
                                                        background: '#4caf50',
                                                        transition: 'width 0.3s ease'
                                                    }}
                                                />
                                            </div>
                                            <div style={{ color: '#999', fontSize: '0.9rem' }}>
                                                {restartStats.percent111}% of restart games
                                            </div>
                                        </div>

                                        {/* 1-12 Restart Strategy */}
                                        <div
                                            style={{
                                                background: 'rgba(255, 152, 0, 0.1)',
                                                border: '1px solid rgba(255, 152, 0, 0.3)',
                                                borderRadius: '6px',
                                                padding: '1rem'
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginBottom: '0.5rem'
                                                }}
                                            >
                                                <span style={{ color: '#00ffff', fontWeight: 'bold' }}>
                                                    x1 1-12 Restart
                                                </span>
                                                <span
                                                    style={{ color: '#ff9800', fontWeight: 'bold', fontSize: '1.2rem' }}
                                                >
                                                    {restartStats.games112}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    width: '100%',
                                                    height: '6px',
                                                    background: 'rgba(255, 152, 0, 0.2)',
                                                    borderRadius: '3px',
                                                    overflow: 'hidden',
                                                    marginBottom: '0.5rem'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: `${restartStats.percent112}%`,
                                                        height: '100%',
                                                        background: '#ff9800',
                                                        transition: 'width 0.3s ease'
                                                    }}
                                                />
                                            </div>
                                            <div style={{ color: '#999', fontSize: '0.9rem' }}>
                                                {restartStats.percent112}% of restart games
                                            </div>
                                        </div>

                                        {/* No Restarts Strategy */}
                                        <div
                                            style={{
                                                background: 'rgba(200, 200, 200, 0.1)',
                                                border: '1px solid rgba(200, 200, 200, 0.3)',
                                                borderRadius: '6px',
                                                padding: '1rem'
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginBottom: '0.5rem'
                                                }}
                                            >
                                                <span style={{ color: '#00ffff', fontWeight: 'bold' }}>
                                                    No Restarts Used
                                                </span>
                                                <span
                                                    style={{
                                                        color: '#c0c0c0',
                                                        fontWeight: 'bold',
                                                        fontSize: '1.2rem'
                                                    }}
                                                >
                                                    {restartStats.gamesNoRestarts}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    width: '100%',
                                                    height: '6px',
                                                    background: 'rgba(200, 200, 200, 0.2)',
                                                    borderRadius: '3px',
                                                    overflow: 'hidden',
                                                    marginBottom: '0.5rem'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: `${restartStats.percentNoRestarts}%`,
                                                        height: '100%',
                                                        background: '#c0c0c0',
                                                        transition: 'width 0.3s ease'
                                                    }}
                                                />
                                            </div>
                                            <div style={{ color: '#999', fontSize: '0.9rem' }}>
                                                {restartStats.percentNoRestarts}% of all analyzed games
                                            </div>
                                        </div>

                                        {/* Summary */}
                                        <div
                                            style={{
                                                background: 'rgba(100, 100, 100, 0.1)',
                                                border: '1px solid rgba(100, 100, 100, 0.3)',
                                                borderRadius: '6px',
                                                padding: '1rem',
                                                display: 'grid',
                                                gap: '0.5rem',
                                                textAlign: 'center'
                                            }}
                                        >
                                            <div style={{ color: '#00ffff' }}>
                                                <strong>Games Analyzed:</strong> {restartStats.totalAnalyzedGames}
                                            </div>
                                            <div style={{ color: '#4caf50' }}>
                                                <strong>With Restarts:</strong> {restartStats.gamesWithRestarts}
                                            </div>
                                            <div style={{ color: '#c0c0c0' }}>
                                                <strong>Without Restarts:</strong> {restartStats.gamesNoRestarts}
                                            </div>
                                        </div>

                                        {/* Restart Coefficient */}
                                        <div
                                            style={{
                                                background: 'rgba(147, 112, 219, 0.15)',
                                                border: '2px solid #9370db',
                                                borderRadius: '6px',
                                                padding: '1.2rem',
                                                textAlign: 'center'
                                            }}
                                        >
                                            <div
                                                style={{
                                                    color: '#9370db',
                                                    fontSize: '0.9rem',
                                                    marginBottom: '0.5rem',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                AVERAGE RESTART COEFFICIENT
                                            </div>
                                            <div
                                                style={{
                                                    color: '#dda0dd',
                                                    fontSize: '2.2rem',
                                                    fontWeight: 'bold',
                                                    textShadow: '0 0 10px rgba(147, 112, 219, 0.5)'
                                                }}
                                            >
                                                {restartStats.averageCoefficient || '1.00'}
                                            </div>
                                            <div style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                                Range: 1.0 (no restarts) to 2.0 (max restarts)
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p style={{ color: '#999', textAlign: 'center' }}>No restart data available</p>
                                )}
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
