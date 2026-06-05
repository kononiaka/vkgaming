import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
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
import GameMechanicsStats from './GameMechanicsStats';

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

export const ALL_CASTLES = [
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

export const PlayerProfileContent = ({
    playerId,
    title = 'Player Details',
    subtitle = 'Public profile with social links, current standing, and season performance.',
    loadingMessage = 'Loading player details...',
    settingsSlot = null,
    avatarRefreshKey = 0,
    children
}) => {
    const [player, setPlayer] = useState(null);
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
    const [showRestartDetails, setShowRestartDetails] = useState(false);
    const [chartData, setChartData] = useState(null);

    useEffect(() => {
        if (!playerId) {
            setPlayer(null);
            setAvatarUrl(null);
            return;
        }

        const fetchPlayerDetails = async () => {
            try {
                const response = await fetch(`${FIREBASE_DATABASE_URL}/users/${playerId}.json`);
                if (!response.ok) {
                    throw new Error('Unable to fetch data from the server.');
                }
                const data = await response.json();
                setPlayer(data);

                if (data && playerId) {
                    try {
                        const avatar = await getAvatar(playerId);
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
    }, [playerId]);

    // Poll for player data updates (e.g., prize updates from tournaments)
    useEffect(() => {
        if (!playerId) {
            return undefined;
        }

        const pollPlayerData = setInterval(() => {
            fetch(`${FIREBASE_DATABASE_URL}/users/${playerId}.json`)
                .then((response) => response.json())
                .then((data) => setPlayer(data))
                .catch((error) => console.error('Error polling player data:', error));
        }, 3000);

        return () => clearInterval(pollPlayerData);
    }, [playerId]);

    useEffect(() => {
        if (!playerId || avatarRefreshKey === 0) {
            return;
        }

        const refreshAvatar = async () => {
            try {
                const avatar = await getAvatar(playerId);
                setAvatarUrl(avatar);
            } catch (_) {
                setAvatarUrl(null);
            }
        };

        refreshAvatar();
    }, [playerId, avatarRefreshKey]);

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
        fetch(`${FIREBASE_DATABASE_URL}/games/heroes3.json`)
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
            fetch(`${FIREBASE_DATABASE_URL}/games/heroes3.json`)
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
        let games111x1Count = 0; // Count of games using x1 1-11 restarts (1 restart)
        let games111x2Count = 0; // Count of games using x2 1-11 restarts (2 restarts)
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

                        // Track restart type used for statistics breakdown - SEPARATED LOGIC
                        if (playerRestarts112 && playerRestarts112 > 0) {
                            // x1 1-12 restart (coefficient 2.0)
                            games112Count++;
                            gamesWithRestarts++;
                        } else if (playerRestarts111 === 1) {
                            // x1 1-11 restart (coefficient 1.5)
                            games111x1Count++;
                            gamesWithRestarts++;
                        } else if (playerRestarts111 === 2 || playerRestarts111 > 1) {
                            // x2 1-11 restarts (coefficient 2.0)
                            games111x2Count++;
                            gamesWithRestarts++;
                        } else {
                            // No restarts used (coefficient 1.0)
                            gamesNoRestarts++;
                        }
                    }
                });
            }
        });

        const averageGold = totalGames > 0 ? (totalPositiveGold / totalGames).toFixed(2) : 0;
        const percent111x1 = totalAnalyzedGames > 0 ? ((games111x1Count / totalAnalyzedGames) * 100).toFixed(1) : 0;
        const percent111x2 = totalAnalyzedGames > 0 ? ((games111x2Count / totalAnalyzedGames) * 100).toFixed(1) : 0;
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
            games111x1: games111x1Count,
            games111x2: games111x2Count,
            games112: games112Count,
            gamesNoRestarts: gamesNoRestarts,
            percent111x1: percent111x1,
            percent111x2: percent111x2,
            percent112: percent112,
            percentNoRestarts: percentNoRestarts,
            gamesWithRestarts: gamesWithRestarts,
            totalAnalyzedGames: totalAnalyzedGames,
            averageCoefficient:
                totalAnalyzedGames > 0 ? (totalRestartCoefficient / totalAnalyzedGames).toFixed(2) : '1.00'
        });
    };

    // Prepare rating trend chart data
    useEffect(() => {
        if (player && player.ratings) {
            const ratingsString = player.ratings;
            const ratingsArray = ratingsString
                .split(',')
                .map((r) => parseFloat(r.trim()))
                .filter((r) => !isNaN(r));

            if (ratingsArray.length > 0) {
                const labels = ratingsArray.map((_, index) => `Game ${index + 1}`);
                const minRating = Math.min(...ratingsArray);
                const maxRating = Math.max(...ratingsArray);
                const padding = (maxRating - minRating) * 0.1 || 0.5;

                const data = {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Rating Trend',
                            data: ratingsArray,
                            borderColor: '#c9a227',
                            backgroundColor: 'rgba(201, 162, 39, 0.08)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.35,
                            pointRadius: 4,
                            pointBackgroundColor: '#c9a227',
                            pointBorderColor: '#141a24',
                            pointBorderWidth: 1,
                            pointHoverRadius: 5,
                            pointHoverBackgroundColor: '#dbb84a',
                            pointHoverBorderColor: '#141a24'
                        }
                    ]
                };

                const options = {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: true,
                            labels: {
                                color: '#8b9aab',
                                font: { size: 12, weight: '500' },
                                padding: 12
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(20, 26, 36, 0.95)',
                            titleColor: '#dbb84a',
                            bodyColor: '#e8ecf1',
                            borderColor: 'rgba(201, 162, 39, 0.35)',
                            borderWidth: 1,
                            padding: 10,
                            displayColors: false,
                            callbacks: {
                                label: (context) => {
                                    const value = context.parsed.y;
                                    const prevValue =
                                        context.dataIndex > 0 ? ratingsArray[context.dataIndex - 1] : null;
                                    const change = prevValue ? (value - prevValue).toFixed(2) : 'N/A';
                                    const changeSymbol = prevValue
                                        ? value > prevValue
                                            ? '↑'
                                            : value < prevValue
                                              ? '↓'
                                              : '→'
                                        : '';
                                    return `Rating: ${value.toFixed(2)} ${changeSymbol ? `(${changeSymbol} ${change})` : ''}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            min: Math.max(0, minRating - padding),
                            max: maxRating + padding,
                            ticks: {
                                color: '#8b9aab',
                                font: { size: 11 }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.06)',
                                drawBorder: false
                            }
                        },
                        x: {
                            ticks: {
                                color: '#8b9aab',
                                font: { size: 10 },
                                maxRotation: 45,
                                minRotation: 0
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.04)',
                                drawBorder: false
                            }
                        }
                    }
                };

                setChartData({ data, options });
            }
        }
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

    const normalizeSocialUrl = (rawValue, platform) => {
        if (!rawValue) {
            return null;
        }

        const value = String(rawValue).trim();
        if (!value) {
            return null;
        }

        if (/^https?:\/\//i.test(value)) {
            return value;
        }

        const cleaned = value.replace(/^@/, '');

        if (platform === 'telegram') {
            return `https://t.me/${cleaned}`;
        }

        if (platform === 'twitch') {
            return `https://www.twitch.tv/${cleaned.replace(/^www\.twitch\.tv\//i, '').replace(/^twitch\.tv\//i, '')}`;
        }

        if (platform === 'youtube') {
            if (value.startsWith('@')) {
                return `https://www.youtube.com/${value}`;
            }
            return `https://www.youtube.com/${cleaned}`;
        }

        return null;
    };

    const totalGames = player?.gamesPlayed?.heroes3?.total || 0;
    const losses = player?.gamesPlayed?.heroes3?.lose || 0;
    const wins = Math.max(totalGames - losses, 0);
    const latestRating = player?.ratings ? parseFloat(player.ratings.split(',').pop()).toFixed(2) : '0.00';
    const overallWinRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0.0';
    const currentLeague = player?.league || player?.currentLeague || 'Not specified';

    const publicLinks = [
        {
            label: 'Telegram',
            value: player?.telegram,
            href: normalizeSocialUrl(player?.telegram, 'telegram')
        },
        {
            label: 'Twitch',
            value: player?.twitch,
            href: normalizeSocialUrl(player?.twitch, 'twitch')
        },
        {
            label: 'YouTube',
            value: player?.youtube,
            href: normalizeSocialUrl(player?.youtube, 'youtube')
        }
    ].filter((entry) => entry.value && entry.href);

    return (
        <div className={classes.playerContainer}>
            {player ? (
                <>
                    <h2 className={classes.header}>{title}</h2>
                    <p className={classes.headerSubtitle}>{subtitle}</p>

                    <div className={classes.heroGrid}>
                        <div className={classes.profileCard}>
                            <div className={classes.profileMain}>
                                {avatarUrl ? (
                                    <img
                                        src={avatarUrl}
                                        alt={`${player.enteredNickname}'s avatar`}
                                        className={classes.avatarImage}
                                    />
                                ) : (
                                    <div className={classes.avatarFallback}>
                                        {player.enteredNickname.charAt(0).toUpperCase()}
                                    </div>
                                )}

                                <div className={classes.profileInfo}>
                                    <div className={classes.profileEyebrow}>
                                        {settingsSlot ? 'Your profile' : 'Player profile'}
                                    </div>
                                    <p className={classes.playerName}>{player.enteredNickname}</p>
                                    <div className={classes.lobbyNick}>
                                        <span className={classes.lobbyLabel}>Lobby nickname</span>
                                        <span className={classes.lobbyValue}>{player.enteredNickname}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={classes.publicLinksBlock}>
                                <div className={classes.publicLinksTitle}>Public links</div>
                                {publicLinks.length > 0 ? (
                                    <div className={classes.publicLinksList}>
                                        {publicLinks.map((link) => (
                                            <a
                                                key={link.label}
                                                href={link.href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={classes.publicLinkItem}
                                            >
                                                <span className={classes.publicLinkLabel}>{link.label}</span>
                                                <span>{link.value}</span>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <span className={classes.publicLinksEmpty}>No public links added yet</span>
                                )}
                            </div>

                            {settingsSlot && <div className={classes.settingsBlock}>{settingsSlot}</div>}
                        </div>

                        <div className={classes.statusCard}>
                            <h3 className={classes.statusTitle}>Current status</h3>
                            <div className={classes.statusList}>
                                <div className={classes.statusItem}>
                                    <span className={classes.statusLabel}>League</span>
                                    <span className={classes.statusValue}>{currentLeague}</span>
                                </div>
                                <div className={classes.statusItem}>
                                    <span className={classes.statusLabel}>Place</span>
                                    <span className={classes.statusValue}>
                                        {leaderboardPlace !== null ? `#${leaderboardPlace}` : '-'}
                                    </span>
                                </div>
                                <div className={classes.statusItem}>
                                    <span className={classes.statusLabel}>Win rate</span>
                                    <span className={classes.statusValue}>{overallWinRate}%</span>
                                </div>
                                {settingsSlot && (
                                    <>
                                        <div className={classes.statusItem}>
                                            <span className={classes.statusLabel}>Coins</span>
                                            <span className={classes.statusValue}>{player.coins ?? 0}</span>
                                        </div>
                                        <div className={classes.statusItem}>
                                            <span className={classes.statusLabel}>Score</span>
                                            <span className={classes.statusValue}>{player.score ?? 0}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={classes.statsGrid}>
                        <div className={classes.statCard}>
                            <div className={classes.statLabel}>Wins</div>
                            <div className={classes.statValue}>{wins}</div>
                        </div>
                        <div className={classes.statCard}>
                            <div className={classes.statLabel}>Losses</div>
                            <div className={classes.statValue}>{losses}</div>
                        </div>
                        <div className={classes.statCard}>
                            <div className={classes.statLabel}>Total Games</div>
                            <div className={classes.statValue}>{totalGames}</div>
                        </div>
                        <div className={classes.statCard}>
                            <div className={classes.statLabel}>Rating</div>
                            <div className={classes.statValue}>{latestRating}</div>
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

                    <GameMechanicsStats
                        goldStats={goldStats}
                        restartStats={restartStats}
                        showRestartDetails={showRestartDetails}
                        onToggleRestartDetails={() => setShowRestartDetails((open) => !open)}
                    />

                    <div className={classes.section}>
                        <h3 className={classes.sectionTitle}>Tournament prizes</h3>
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
                        <h3 className={classes.sectionTitle}>Recent streak</h3>
                        <div className={classes.streak}>
                            {streak.length === 0 ? (
                                <span className={classes.streakEmpty}>No games found</span>
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
                        <h3 className={classes.sectionTitle}>Castle performance</h3>
                        <div className={classes.castleInfo}>
                            <div className={`${classes.castleCard} ${classes.best}`}>
                                <div className={classes.castleName}>Best castle</div>
                                <div className={classes.castleStats}>
                                    {bestCastle
                                        ? `${bestCastle.castle} (${bestCastle.wins}W - ${bestCastle.loses}L)`
                                        : 'N/A'}
                                </div>
                            </div>
                            <div className={`${classes.castleCard} ${classes.worst}`}>
                                <div className={classes.castleName}>Worst castle</div>
                                <div className={classes.castleStats}>
                                    {worstCastle
                                        ? `${worstCastle.castle} (${worstCastle.wins}W - ${worstCastle.loses}L)`
                                        : 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={classes.section}>
                        <h3 className={classes.sectionTitle}>Opponent performance</h3>
                        <div className={classes.castleInfo}>
                            <div className={`${classes.castleCard} ${classes.best}`}>
                                <div className={classes.castleName}>Best record vs</div>
                                <div className={classes.castleStats}>
                                    {bestOpponent
                                        ? `${bestOpponent.opponent} (${bestOpponent.wins}W - ${bestOpponent.loses}L)`
                                        : 'N/A'}
                                </div>
                            </div>
                            <div className={`${classes.castleCard} ${classes.worst}`}>
                                <div className={classes.castleName}>Worst record vs</div>
                                <div className={classes.castleStats}>
                                    {worstOpponent
                                        ? `${worstOpponent.opponent} (${worstOpponent.wins}W - ${worstOpponent.loses}L)`
                                        : 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <button className={classes.btn} onClick={handleShowCastleStats}>
                        Show full castle statistics
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
                                        const mergedData = ALL_CASTLES.map(({ name, image }) => {
                                            // Find matching stats (handle both "Castle" and "Castle-Замок" formats)
                                            const statsEntry = Object.entries(castleStats).find(([key]) => {
                                                const keyName = key.includes('-') ? key.split('-')[0] : key;
                                                return keyName === name;
                                            });

                                            const stats = statsEntry ? statsEntry[1] : { wins: 0, loses: 0 };
                                            const total = stats.wins + stats.loses;
                                            const castleWinRate =
                                                total > 0 ? ((stats.wins / total) * 100).toFixed(2) : '0.00';

                                            return {
                                                name,
                                                image,
                                                stats,
                                                total,
                                                winRate: castleWinRate
                                            };
                                        });

                                        // Sort by total games (most played first)
                                        mergedData.sort((a, b) => b.total - a.total);

                                        return mergedData.map(({ name, image, total, winRate }) => (
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
                    {/* Rating Trend Chart Section */}
                    <div className={classes.section}>
                        <h3 className={classes.sectionTitle}>Rating trend</h3>
                        <div className={classes.chartPanel}>
                            {chartData ? (
                                <Line data={chartData.data} options={chartData.options} />
                            ) : (
                                <p className={classes.emptyNote}>No rating data available</p>
                            )}
                        </div>
                    </div>

                    {children}
                </>
            ) : (
                <p className={classes.loading}>{loadingMessage}</p>
            )}
        </div>
    );
};

const PlayerDetails = () => {
    const { id } = useParams();
    return (
        <PlayerProfileContent
            playerId={id}
            title="Player Details"
            subtitle="Public profile with social links, current standing, and season performance."
        />
    );
};

export default PlayerDetails;
