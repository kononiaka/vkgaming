import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
    SITE_STARS_MAX,
    computeSiteStarsFromRank,
    fetchLastGamesForPlayer,
    fetchBestAndWorstCastleForPlayer,
    fetchFullCastleStatsForPlayer,
    fetchLeaderboard,
    fetchBestAndWorstOpponentForPlayer,
    getAvatar
} from '../../api/api';
import classes from './Players.module.css';
import StarsComponent from '../Stars/Stars';
import GameMechanicsStats from './GameMechanicsStats';
import HotaPlayerStats from './HotaPlayerStats';
import MyUpcomingMatchesSection from '../MyUpcomingMatches/MyUpcomingMatchesSection';
import PlayerTournamentsSection from '../Profile/PlayerTournamentsSection';
import { fetchMyUpcomingMatches } from '../../utils/myUpcomingMatches';
import { fetchPlayerTournaments } from '../../utils/playerTournaments';
import LobbyNicknameField from '../Profile/LobbyNicknameField';
import PublicLinksField from '../Profile/PublicLinksField';
import CountryFlag from '../Country/CountryFlag';
import { resolveCountryCode } from '../../utils/country';
import { buildPublicLinks } from '../../utils/publicLinks';
import {
    deriveBestWorstFaction,
    deriveBestWorstOpponent,
    deriveHotaPlayerSummary,
    fetchHotaLeaderboard,
    fetchHotaPlayerByLobbyNickname,
    findHotaLeaderboardRank
} from '../../api/hotaMeta';

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
    upcomingMatchesTitle = 'Upcoming matches',
    attendedTournamentsTitle = 'Tournaments attended',
    attendedTournamentsEmptyMessage = 'No tournaments yet.',
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
    const [hotaData, setHotaData] = useState({ status: 'idle' });
    const [profileSiteStars, setProfileSiteStars] = useState(null);
    const [upcomingMatches, setUpcomingMatches] = useState([]);
    const [attendedTournaments, setAttendedTournaments] = useState([]);

    useEffect(() => {
        if (!player?.enteredNickname) {
            setHotaData({ status: 'idle' });
            return;
        }

        let cancelled = false;
        setHotaData({ status: 'loading' });

        fetchHotaPlayerByLobbyNickname(player.enteredNickname)
            .then((result) => {
                if (!cancelled) {
                    setHotaData(result);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setHotaData({ status: 'error' });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [player?.enteredNickname]);

    useEffect(() => {
        if (!player?.enteredNickname) {
            setUpcomingMatches([]);
            return undefined;
        }

        let cancelled = false;

        fetchMyUpcomingMatches(player.enteredNickname)
            .then((matches) => {
                if (!cancelled) {
                    setUpcomingMatches(matches);
                }
            })
            .catch((error) => {
                console.error('Error fetching upcoming matches:', error);
                if (!cancelled) {
                    setUpcomingMatches([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [player?.enteredNickname]);

    useEffect(() => {
        if (!player?.enteredNickname) {
            setAttendedTournaments([]);
            return undefined;
        }

        let cancelled = false;

        fetchPlayerTournaments(
            { ...player, id: playerId },
            { includePrivateTournaments: Boolean(settingsSlot) }
        )
            .then((tournaments) => {
                if (!cancelled) {
                    setAttendedTournaments(tournaments);
                }
            })
            .catch((error) => {
                console.error('Error fetching attended tournaments:', error);
                if (!cancelled) {
                    setAttendedTournaments([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [player, playerId, settingsSlot]);

    const hotaIsSource = hotaData.status === 'ok';
    const showKonoplayPerformance = !hotaIsSource && hotaData.status !== 'loading';
    const hotaProfile = hotaIsSource ? hotaData.profile : null;
    const hotaDerived = hotaProfile ? deriveHotaPlayerSummary(hotaProfile) : null;
    const hotaFactions = hotaProfile ? deriveBestWorstFaction(hotaProfile) : { best: null, worst: null };
    const hotaOpponents = hotaProfile ? deriveBestWorstOpponent(hotaProfile) : { best: null, worst: null };

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
        if (!player?.enteredNickname) {
            setLeaderboardPlace(null);
            setProfileSiteStars(null);
            return;
        }

        if (hotaIsSource) {
            fetchHotaLeaderboard({ limit: 500 })
                .then((leaderboard) => {
                    const rank = findHotaLeaderboardRank(player.enteredNickname, leaderboard);
                    setLeaderboardPlace(rank);
                    setProfileSiteStars(rank != null ? computeSiteStarsFromRank(rank) : null);
                })
                .catch(() => {
                    setLeaderboardPlace(null);
                    setProfileSiteStars(null);
                });
            return;
        }

        setProfileSiteStars(null);

        if (hotaData.status === 'loading') {
            return;
        }

        fetchLeaderboard(player).then((place) => {
            setLeaderboardPlace(place);
        });
    }, [player, hotaIsSource, hotaData.status]);

    // Fetch streak (last 10 games) — konoplay fallback only
    useEffect(() => {
        if (hotaIsSource) {
            setStreak([]);
            return;
        }

        const fetchStreak = async () => {
            if (player && player.enteredNickname) {
                const games = await fetchLastGamesForPlayer(player.enteredNickname, 10);
                setStreak(games);
            }
        };
        fetchStreak();
    }, [player, hotaIsSource]);

    // Fetch best and worst castle — konoplay fallback only
    useEffect(() => {
        if (hotaIsSource) {
            setBestCastle(null);
            setWorstCastle(null);
            return;
        }

        const fetchBestAndWorstCastle = async () => {
            if (player && player.enteredNickname) {
                const { best, worst } = await fetchBestAndWorstCastleForPlayer(player.enteredNickname);
                setBestCastle(best);
                setWorstCastle(worst);
            }
        };
        fetchBestAndWorstCastle();
    }, [player, hotaIsSource]);

    // Fetch best and worst opponent — konoplay fallback only
    useEffect(() => {
        if (hotaIsSource) {
            setBestOpponent(null);
            setWorstOpponent(null);
            return;
        }

        const fetchBestAndWorstOpponent = async () => {
            if (player && player.enteredNickname) {
                const { best, worst } = await fetchBestAndWorstOpponentForPlayer(player.enteredNickname);
                setBestOpponent(best);
                setWorstOpponent(worst);
            }
        };
        fetchBestAndWorstOpponent();
    }, [player, hotaIsSource]);

    // Fetch gold/restart from Konoplay cup games only (not needed when HotA is primary)
    useEffect(() => {
        if (hotaIsSource) {
            setGoldStats(null);
            setRestartStats(null);
            return;
        }

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
    }, [player, hotaIsSource]);

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

    // Prepare rating trend chart data — konoplay fallback only
    useEffect(() => {
        if (hotaIsSource) {
            setChartData(null);
            return;
        }

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
    }, [player, hotaIsSource]);

    const handleShowCastleStats = async () => {
        if (showPopup) {
            setShowPopup(false);
            return;
        }
        const stats = await fetchFullCastleStatsForPlayer(player.enteredNickname);
        setCastleStats(stats);
        setShowPopup(true);
    };

    const konoplayTotalGames = player?.gamesPlayed?.heroes3?.total || 0;
    const konoplayLosses = player?.gamesPlayed?.heroes3?.lose || 0;
    const konoplayWins = Math.max(konoplayTotalGames - konoplayLosses, 0);
    const konoplayRating = player?.ratings
        ? parseFloat(player.ratings.split(',').pop()).toFixed(2)
        : '0.00';
    const konoplayWinRate =
        konoplayTotalGames > 0 ? ((konoplayWins / konoplayTotalGames) * 100).toFixed(1) : '0.0';

    const totalGames = hotaDerived?.totalGames ?? konoplayTotalGames;
    const losses = hotaDerived?.losses ?? konoplayLosses;
    const wins = hotaDerived?.wins ?? konoplayWins;
    const latestRating =
        hotaDerived?.rating != null ? Number(hotaDerived.rating).toFixed(2) : konoplayRating;
    const peakRating =
        hotaDerived?.peakRating != null ? Number(hotaDerived.peakRating).toFixed(2) : null;
    const overallWinRate =
        hotaDerived?.winRate != null
            ? Number(hotaDerived.winRate).toFixed(1)
            : konoplayWinRate;

    const displayBestCastle = hotaIsSource ? hotaFactions.best : bestCastle;
    const displayWorstCastle = hotaIsSource ? hotaFactions.worst : worstCastle;
    const displayBestOpponent = hotaIsSource ? hotaOpponents.best : bestOpponent;
    const displayWorstOpponent = hotaIsSource ? hotaOpponents.worst : worstOpponent;

    const publicLinks = buildPublicLinks(player);

    return (
        <div className={classes.playerContainer}>
            {player ? (
                <>
                    <h2 className={classes.header}>{title}</h2>
                    <p className={classes.headerSubtitle}>
                        {hotaIsSource
                            ? 'Ranked stats from HotA Meta. Konoplay sections below cover cups, prizes, and site rewards.'
                            : subtitle}
                    </p>
                    {hotaIsSource && (
                        <div className={classes.sourceBadge}>Stats synced from HotA Meta</div>
                    )}

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
                                    <p className={classes.playerName}>
                                        {resolveCountryCode(player) && (
                                            <CountryFlag
                                                code={resolveCountryCode(player)}
                                                size={28}
                                                className={classes.playerCountryFlag}
                                            />
                                        )}
                                        {player.enteredNickname}
                                    </p>
                                    {settingsSlot ? (
                                        <LobbyNicknameField
                                            className={classes.lobbyNick}
                                            userId={playerId}
                                            nickname={player.enteredNickname}
                                            onSaved={(nextNickname) =>
                                                setPlayer((prev) =>
                                                    prev ? { ...prev, enteredNickname: nextNickname } : prev
                                                )
                                            }
                                        />
                                    ) : (
                                        <div className={classes.lobbyNick}>
                                            <span className={classes.lobbyLabel}>Lobby nickname</span>
                                            <span className={classes.lobbyValue}>{player.enteredNickname}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={classes.publicLinksBlock}>
                                <div className={classes.publicLinksTitle}>Public links</div>
                                {settingsSlot ? (
                                    <PublicLinksField
                                        userId={playerId}
                                        links={{
                                            telegram: player?.telegram,
                                            twitch: player?.twitch,
                                            youtube: player?.youtube
                                        }}
                                        onSaved={(update) =>
                                            setPlayer((prev) => (prev ? { ...prev, ...update } : prev))
                                        }
                                    />
                                ) : publicLinks.length > 0 ? (
                                    <div className={classes.publicLinksList}>
                                        {publicLinks.map((link) => (
                                            <a
                                                key={link.key}
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
                                {hotaIsSource ? (
                                    <>
                                        <div className={classes.statusItem}>
                                            <span className={classes.statusLabel}>HotA rating</span>
                                            <span className={classes.statusValue}>{latestRating}</span>
                                        </div>
                                        {peakRating && (
                                            <div className={classes.statusItem}>
                                                <span className={classes.statusLabel}>Peak rating</span>
                                                <span className={classes.statusValue}>{peakRating}</span>
                                            </div>
                                        )}
                                        <div className={classes.statusItem}>
                                            <span className={classes.statusLabel}>Ranked win rate</span>
                                            <span className={classes.statusValue}>{overallWinRate}%</span>
                                        </div>
                                    </>
                                ) : null}
                                <div className={classes.statusItem}>
                                    <span className={classes.statusLabel}>
                                        {hotaIsSource ? 'HotA rank' : 'Place'}
                                    </span>
                                    <span className={classes.statusValue}>
                                        {leaderboardPlace !== null ? `#${leaderboardPlace}` : '-'}
                                    </span>
                                </div>
                                {!hotaIsSource && (
                                    <div className={classes.statusItem}>
                                        <span className={classes.statusLabel}>Win rate</span>
                                        <span className={classes.statusValue}>{overallWinRate}%</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {hotaIsSource ? (
                        <div className={classes.statsGrid}>
                            <div className={classes.statCard}>
                                <div className={classes.statLabel}>
                                    Site stars
                                    <span className={classes.statHint}> (max {SITE_STARS_MAX})</span>
                                </div>
                                <div className={classes.statValue}>
                                    <StarsComponent stars={profileSiteStars ?? player.stars} />
                                </div>
                            </div>
                            <div className={classes.statCard}>
                                <div className={classes.statLabel}>Cup winnings</div>
                                <div className={classes.statValue}>${(player.totalPrize || 0).toFixed(2)}</div>
                            </div>
                        </div>
                    ) : (
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
                                <div className={classes.statLabel}>Site stars</div>
                                <div className={classes.statValue}>
                                    <StarsComponent stars={player.stars} />
                                </div>
                            </div>
                            <div className={classes.statCard}>
                                <div className={classes.statLabel}>Cup winnings</div>
                                <div className={classes.statValue}>${(player.totalPrize || 0).toFixed(2)}</div>
                            </div>
                            <div className={classes.statCard}>
                                <div className={classes.statLabel}>Konoplay rank</div>
                                <div className={classes.statValue}>
                                    #{leaderboardPlace !== null ? leaderboardPlace : '...'}
                                </div>
                            </div>
                        </div>
                    )}

                    <HotaPlayerStats
                        lobbyNickname={player.enteredNickname}
                        hotaData={hotaData}
                        isPrimarySource={hotaIsSource}
                    />

                    {!hotaIsSource && (
                        <GameMechanicsStats
                            goldStats={goldStats}
                            restartStats={restartStats}
                            showRestartDetails={showRestartDetails}
                            onToggleRestartDetails={() => setShowRestartDetails((open) => !open)}
                        />
                    )}

                    <div className={classes.section}>
                        <h3 className={classes.sectionTitle}>
                            {hotaIsSource ? 'Konoplay cups' : 'Tournament prizes'}
                        </h3>
                        {hotaIsSource && (
                            <p className={classes.sectionNote}>
                                Prize money from tournaments on this site. Ranked stats, colors, and gold trade are
                                from HotA Meta above.
                            </p>
                        )}
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

                    {showKonoplayPerformance && (
                        <>
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
                                            {displayBestCastle
                                                ? `${displayBestCastle.castle} (${displayBestCastle.wins}W - ${displayBestCastle.loses}L)`
                                                : 'N/A'}
                                        </div>
                                    </div>
                                    <div className={`${classes.castleCard} ${classes.worst}`}>
                                        <div className={classes.castleName}>Worst castle</div>
                                        <div className={classes.castleStats}>
                                            {displayWorstCastle
                                                ? `${displayWorstCastle.castle} (${displayWorstCastle.wins}W - ${displayWorstCastle.loses}L)`
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
                                            {displayBestOpponent
                                                ? `${displayBestOpponent.opponent} (${displayBestOpponent.wins}W - ${displayBestOpponent.loses}L)`
                                                : 'N/A'}
                                        </div>
                                    </div>
                                    <div className={`${classes.castleCard} ${classes.worst}`}>
                                        <div className={classes.castleName}>Worst record vs</div>
                                        <div className={classes.castleStats}>
                                            {displayWorstOpponent
                                                ? `${displayWorstOpponent.opponent} (${displayWorstOpponent.wins}W - ${displayWorstOpponent.loses}L)`
                                                : 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button className={classes.btn} onClick={handleShowCastleStats}>
                                Show full castle statistics
                            </button>
                        </>
                    )}
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
                    {showKonoplayPerformance && (
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
                    )}

                    <MyUpcomingMatchesSection
                        matches={upcomingMatches}
                        title={upcomingMatchesTitle}
                        className={classes.upcomingMatchesSection}
                    />

                    <PlayerTournamentsSection
                        tournaments={attendedTournaments}
                        title={attendedTournamentsTitle}
                        emptyMessage={attendedTournamentsEmptyMessage}
                        className={classes.attendedTournamentsSection}
                    />

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
