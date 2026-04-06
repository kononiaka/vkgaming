import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import { NavLink } from 'react-router-dom';
import StarsComponent from '../../../Stars/Stars';
import { fetchLastGamesForPlayer, getAvatar, lookForUserId, fetchLeaderboard } from '../../../../api/api';
import classes from './PlayerBracket.module.css';

// Import local castle images
import castleImg from '../../../../image/castles/castle.jpeg';
import rampartImg from '../../../../image/castles/rampart.jpeg';
import towerImg from '../../../../image/castles/tower.jpeg';
import infernoImg from '../../../../image/castles/inferno.jpeg';
import necropolisImg from '../../../../image/castles/necropolis.jpeg';
import dungeonImg from '../../../../image/castles/dungeon.jpeg';
import strongholdImg from '../../../../image/castles/stronghold.jpeg';
import fortressImg from '../../../../image/castles/fortress.jpeg';
import factoryImg from '../../../../image/castles/factory.jpeg';
import confluxImg from '../../../../image/castles/conflux.jpeg';
import coveImg from '../../../../image/castles/cove.jpeg';
import kronverkImg from '../../../../image/castles/kronverk.jpeg';

export const PlayerBracket = (props) => {
    const {
        pair,
        team,
        pairIndex,
        hasTruthyPlayers,
        stageIndex,
        setPlayoffPairs,
        handleCastleChange,
        handleScoreChange,
        handleBlur,
        handleRadioChange,
        stage,
        teamIndex,
        getWinner,
        clickedRadioButton,
        playersObj,
        sourcePair,
        sourceIsLoser
    } = props;

    const { team1, team2, stars1, stars2, score1, score2, winner, castle1, castle2, color1, color2 } = pair;

    let teamPlayer = team === 'team1' ? team1 : team2;
    let playerColor = team === 'team1' ? color1 : color2;
    let playerStars =
        team === 'team1'
            ? Number(typeof stars1 === 'string' && stars1.includes(',') ? stars1.split(',').at(-1) : stars1) || null
            : Number(typeof stars2 === 'string' && stars2.includes(',') ? stars2.split(',').at(-1) : stars2) || null;
    let playerScore =
        team === 'team1'
            ? Number(typeof score1 === 'string' && score1.includes(',') ? score1.split(',').at(-1) : score1) || null
            : Number(typeof score2 === 'string' && score2.includes(',') ? score2.split(',').at(-1) : score2) || null;
    let playerCastle = team === 'team1' ? castle1 : castle2;
    let numberOfGames = Array.isArray(pair.games) ? [...pair.games] : pair.games ? [pair.games] : [];
    const playerRatings = (() => {
        const raw = team === 'team1' ? pair.ratings1 : pair.ratings2;
        if (!raw) {
            return [];
        }
        return raw
            .split(',')
            .map((r) => parseFloat(r.trim()))
            .filter((n) => !isNaN(n));
    })();

    if (`${pair.score1} - ${pair.score2}` === '1 - 1') {
        if (numberOfGames.length === 2) {
            let extraGame = {
                gameId: 2,
                castle1: '',
                castle2: '',
                castleWinner: null,
                gameWinner: null,
                color1: 'red',
                color2: 'blue',
                gold1: 0,
                gold2: 0,
                restart1_111: 0,
                restart1_112: 0,
                restart2_111: 0,
                restart2_112: 0
            };
            numberOfGames.push(extraGame);
        }
    }

    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [streak, setStreak] = useState([]);
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [userId, setUserId] = useState(null);
    const [leaderboardPosition, setLeaderboardPosition] = useState(null);
    const tooltipTimeout = useRef(null);
    const cancelledRef = useRef(false);
    const [showDetailedStreak, setShowDetailedStreak] = useState(false);
    const [detailedStreakPos, setDetailedStreakPos] = useState({ x: 0, y: 0 });
    const [detailedStreakLoading, setDetailedStreakLoading] = useState(false);
    const [fullRatings, setFullRatings] = useState([]);
    const detailedPanelRef = useRef(null);

    // Fetch player avatar and userId
    useEffect(() => {
        const fetchAvatar = async () => {
            if (teamPlayer && teamPlayer !== 'TBD') {
                try {
                    const uid = await lookForUserId(teamPlayer);
                    if (uid) {
                        setUserId(uid);
                        const avatar = await getAvatar(uid);
                        setAvatarUrl(avatar);
                    }
                } catch (error) {
                    console.error('Error fetching avatar:', error);
                    setAvatarUrl(null);
                    setUserId(null);
                }
            } else {
                setAvatarUrl(null);
                setUserId(null);
            }
        };
        fetchAvatar();
    }, [teamPlayer]);

    // Fetch player's leaderboard position
    useEffect(() => {
        const fetchPosition = async () => {
            if (teamPlayer && teamPlayer !== 'TBD' && userId) {
                try {
                    // Fetch full user data using userId to get enteredNickname
                    const response = await fetch(
                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`
                    );
                    if (response.ok) {
                        const userData = await response.json();
                        if (userData) {
                            const position = await fetchLeaderboard(userData);
                            setLeaderboardPosition(position);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching leaderboard position:', error);
                    setLeaderboardPosition(null);
                }
            } else {
                setLeaderboardPosition(null);
            }
        };
        fetchPosition();
    }, [teamPlayer, userId]);

    // Register this instance's hide fn in a global Set so every instance can hide all others
    useEffect(() => {
        if (!window.__playerBracketTooltipRegistry) {
            window.__playerBracketTooltipRegistry = new Set();
        }
        const hide = () => setShowTooltip(false);
        window.__playerBracketTooltipRegistry.add(hide);
        return () => {
            window.__playerBracketTooltipRegistry.delete(hide);
            cancelledRef.current = true;
            if (tooltipTimeout.current) {
                clearTimeout(tooltipTimeout.current);
            }
        };
    }, []);

    // Register detailed panel hide in separate global registry
    useEffect(() => {
        if (!window.__playerBracketDetailRegistry) {
            window.__playerBracketDetailRegistry = new Set();
        }
        const hide = () => setShowDetailedStreak(false);
        window.__playerBracketDetailRegistry.add(hide);
        return () => {
            window.__playerBracketDetailRegistry.delete(hide);
        };
    }, []);

    // Close detailed panel on click outside
    useEffect(() => {
        if (!showDetailedStreak) {
            return;
        }
        const handleClickOutside = (e) => {
            if (detailedPanelRef.current && !detailedPanelRef.current.contains(e.target)) {
                setShowDetailedStreak(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDetailedStreak]);

    const hideAllTooltips = () => {
        if (window.__playerBracketTooltipRegistry) {
            window.__playerBracketTooltipRegistry.forEach((fn) => fn());
        }
    };

    const handleMouseEnter = async (e) => {
        cancelledRef.current = false;
        hideAllTooltips();
        if (tooltipTimeout.current) {
            clearTimeout(tooltipTimeout.current);
        }

        // Capture rect before async — e.currentTarget may be null after await
        const rect = e && e.currentTarget ? e.currentTarget.getBoundingClientRect() : null;

        const streakArr = await fetchLastGamesForPlayer(teamPlayer, 5);
        if (cancelledRef.current) {
            return;
        }

        setStreak(streakArr);
        if (rect) {
            setTooltipPos({ x: rect.right + 8, y: rect.top });
        }
        setShowTooltip(true);
    };

    const handleMouseLeave = () => {
        cancelledRef.current = true;
        if (tooltipTimeout.current) {
            clearTimeout(tooltipTimeout.current);
        }
        setShowTooltip(false);
    };

    const handleStreakClick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (teamPlayer === 'TBD') {
            return;
        }

        // Toggle off if already open
        if (showDetailedStreak) {
            setShowDetailedStreak(false);
            return;
        }

        // Hide all other detailed panels
        if (window.__playerBracketDetailRegistry) {
            window.__playerBracketDetailRegistry.forEach((fn) => fn());
        }

        const rect = e.currentTarget.getBoundingClientRect();
        setDetailedStreakPos({ x: rect.right + 12, y: rect.top });

        // Reuse cached streak data if already fetched, otherwise fetch now
        if (streak.length === 0) {
            setDetailedStreakLoading(true);
            const streakArr = await fetchLastGamesForPlayer(teamPlayer, 5);
            setStreak(streakArr);
            setDetailedStreakLoading(false);
        }

        // Fetch full player ratings from DB if not yet loaded
        if (fullRatings.length === 0 && userId) {
            try {
                const response = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`
                );
                if (response.ok) {
                    const userData = await response.json();
                    if (userData && userData.ratings) {
                        const parsed = userData.ratings
                            .split(',')
                            .map((r) => parseFloat(r.trim()))
                            .filter((n) => !isNaN(n));
                        setFullRatings(parsed);
                    }
                }
            } catch (error) {
                console.error('Error fetching full ratings:', error);
            }
        }

        setShowDetailedStreak(true);
    };

    const isMultiGameLayout = Array.isArray(numberOfGames) && numberOfGames.length > 1;
    const gamesCount = Array.isArray(numberOfGames) ? numberOfGames.length : 1;
    const gamesStripMinWidth = isMultiGameLayout ? `${gamesCount * 44 + Math.max(gamesCount - 1, 0) * 8}px` : '52px';
    const isSourcePairHint =
        teamPlayer === 'TBD' &&
        sourcePair &&
        sourcePair.team1 &&
        sourcePair.team1 !== 'TBD' &&
        sourcePair.team2 &&
        sourcePair.team2 !== 'TBD';

    return (
        <div
            className={classes.player_bracket}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap' }}
        >
            <div
                className={classes.playerInfoColumn}
                style={isSourcePairHint ? { flex: '1 1 auto', maxWidth: 'none', overflow: 'visible' } : undefined}
            >
                <label
                    htmlFor={`score-${team}-${pairIndex}`}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={handleStreakClick}
                    style={{ cursor: 'pointer' }}
                >
                    {teamPlayer === winner ? (
                        <div className={classes['green-indicator']}></div>
                    ) : winner === 'Tie' || winner === undefined ? (
                        <div className={classes['grey-indicator']}></div>
                    ) : (
                        <div className={classes['red-indicator']}></div>
                    )}
                </label>

                {avatarUrl && (
                    <img
                        src={avatarUrl}
                        alt={teamPlayer}
                        style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            marginRight: '8px',
                            border: '2px solid #00ffff',
                            objectFit: 'cover',
                            boxShadow: '0 2px 4px rgba(0, 255, 255, 0.3)'
                        }}
                    />
                )}

                {/* Color Indicator Badge - REMOVED */}
                {false && playerColor && (
                    <div
                        style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            background:
                                playerColor === 'red'
                                    ? 'linear-gradient(135deg, #8B0000, #FF0000, #DC143C)'
                                    : 'linear-gradient(135deg, #00008B, #0000FF, #4169E1)',
                            border: '2px solid #FFD700',
                            marginRight: '6px',
                            boxShadow:
                                playerColor === 'red'
                                    ? '0 0 8px rgba(255, 0, 0, 0.6), inset 0 0 6px rgba(255, 255, 255, 0.2)'
                                    : '0 0 8px rgba(0, 0, 255, 0.6), inset 0 0 6px rgba(255, 255, 255, 0.2)',
                            flexShrink: 0
                        }}
                        title={`Playing as ${playerColor}`}
                    />
                )}

                {userId && teamPlayer !== 'TBD' ? (
                    <NavLink
                        to={`/players/${userId}`}
                        className={classes.playerName}
                        style={{
                            color: '#00ffff',
                            textDecoration: 'none',
                            fontWeight: 'bold',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => (e.target.style.color = '#00cccc')}
                        onMouseLeave={(e) => (e.target.style.color = '#00ffff')}
                    >
                        <span className={classes.leaderboardPlace}>({leaderboardPosition || '...'})</span>
                        <span>{teamPlayer}</span>
                    </NavLink>
                ) : (
                    <span
                        className={classes.playerName}
                        style={isSourcePairHint ? { whiteSpace: 'normal', overflow: 'visible' } : undefined}
                    >
                        {!isSourcePairHint && (
                            <span className={classes.leaderboardPlace}>({leaderboardPosition || '...'})</span>
                        )}
                        <span>
                            {isSourcePairHint ? (
                                <span>
                                    {sourceIsLoser ? 'L' : 'W'}: {sourcePair.team1} / {sourcePair.team2}
                                </span>
                            ) : (
                                teamPlayer
                            )}
                        </span>
                    </span>
                )}
                {showTooltip && teamPlayer !== 'TBD' && (
                    <div
                        style={{
                            position: 'absolute',
                            left: 40, // adjust as needed to position right of the name/circle
                            top: -30,
                            background: '#fff',
                            border: '1px solid #3e20c0',
                            borderRadius: 6,
                            padding: '8px 12px',
                            zIndex: 9999,
                            color: '#222',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            minWidth: 120
                        }}
                        onMouseLeave={handleMouseLeave}
                    >
                        <b>Last 5 games:</b>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', gap: 6 }}>
                            {streak.length === 0 && <li>No games found</li>}
                            {streak.map((g, i) => (
                                <li key={i} title={g.opponent} style={{ position: 'relative' }}>
                                    <span
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
                                        onMouseEnter={(e) => {
                                            const tooltip = document.getElementById(`opponent-tooltip-${i}`);
                                            if (tooltip) {
                                                tooltip.style.display = 'block';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            const tooltip = document.getElementById(`opponent-tooltip-${i}`);
                                            if (tooltip) {
                                                tooltip.style.display = 'none';
                                            }
                                        }}
                                    ></span>
                                    {/* Hidden opponent name, shown on hover */}
                                    <span
                                        id={`opponent-tooltip-${i}`}
                                        style={{
                                            display: 'none',
                                            position: 'absolute',
                                            top: '-28px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            background: '#222',
                                            color: '#fff',
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                            fontSize: '0.95em',
                                            whiteSpace: 'nowrap',
                                            zIndex: 10000,
                                            pointerEvents: 'none'
                                        }}
                                    >
                                        {g.opponent}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Detailed streak panel — opened on click, rendered via portal to escape stacking contexts */}
            {showDetailedStreak &&
                teamPlayer !== 'TBD' &&
                ReactDOM.createPortal(
                    <>
                        {/* Overlay — blocks hover/click on background */}
                        <div
                            style={{
                                position: 'fixed',
                                inset: 0,
                                background: 'rgba(0, 0, 0, 0.75)',
                                zIndex: 10000
                            }}
                            onClick={() => setShowDetailedStreak(false)}
                        />

                        {/* Modal */}
                        <div
                            ref={detailedPanelRef}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                position: 'fixed',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                background: '#120c2e',
                                border: '1px solid rgba(62,32,192,0.8)',
                                borderRadius: 12,
                                padding: '20px 24px',
                                zIndex: 10001,
                                color: '#fff',
                                boxShadow: '0 8px 40px rgba(0,0,0,0.85)',
                                width: '900px',
                                maxWidth: '96vw',
                                maxHeight: '90vh',
                                overflowY: 'auto'
                            }}
                        >
                            {/* Header */}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 16,
                                    paddingBottom: 14,
                                    borderBottom: '1px solid rgba(62,32,192,0.5)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {avatarUrl && (
                                        <img
                                            src={avatarUrl}
                                            alt={teamPlayer}
                                            style={{
                                                width: 38,
                                                height: 38,
                                                borderRadius: '50%',
                                                border: '2px solid #ffd700',
                                                objectFit: 'cover'
                                            }}
                                        />
                                    )}
                                    <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '1.15rem' }}>
                                        {teamPlayer}
                                    </span>
                                    {leaderboardPosition && (
                                        <span style={{ color: '#888', fontSize: '0.85rem' }}>
                                            #{leaderboardPosition}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowDetailedStreak(false)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#aaa',
                                        cursor: 'pointer',
                                        fontSize: '1.5rem',
                                        lineHeight: 1,
                                        padding: '0 4px'
                                    }}
                                >
                                    ×
                                </button>
                            </div>

                            {/* Body: two columns */}
                            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                                {/* Left: recent games table */}
                                <div style={{ flex: '1 1 190px', minWidth: 0 }}>
                                    <div
                                        style={{
                                            color: '#aaa',
                                            fontSize: '0.72rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '.07em',
                                            marginBottom: 10
                                        }}
                                    >
                                        Recent games
                                    </div>
                                    {detailedStreakLoading ? (
                                        <div style={{ color: '#aaa', fontSize: '0.85rem' }}>Loading...</div>
                                    ) : streak.length === 0 ? (
                                        <div style={{ color: '#aaa', fontSize: '0.85rem' }}>No games found</div>
                                    ) : (
                                        <table
                                            style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}
                                        >
                                            <thead>
                                                <tr
                                                    style={{
                                                        color: '#aaa',
                                                        borderBottom: '1px solid rgba(62,32,192,0.5)'
                                                    }}
                                                >
                                                    <th
                                                        style={{
                                                            padding: '2px 8px 6px 0',
                                                            textAlign: 'left',
                                                            fontWeight: 'normal'
                                                        }}
                                                    >
                                                        #
                                                    </th>
                                                    <th
                                                        style={{
                                                            padding: '2px 8px 6px',
                                                            textAlign: 'left',
                                                            fontWeight: 'normal'
                                                        }}
                                                    >
                                                        Result
                                                    </th>
                                                    <th
                                                        style={{
                                                            padding: '2px 8px 6px',
                                                            textAlign: 'left',
                                                            fontWeight: 'normal'
                                                        }}
                                                    >
                                                        Opponent
                                                    </th>
                                                    <th
                                                        style={{
                                                            padding: '2px 8px 6px 0',
                                                            textAlign: 'left',
                                                            fontWeight: 'normal'
                                                        }}
                                                    >
                                                        Date
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {streak.map((g, i) => (
                                                    <tr
                                                        key={i}
                                                        style={{ borderBottom: '1px solid rgba(62,32,192,0.15)' }}
                                                    >
                                                        <td style={{ padding: '6px 8px 6px 0', color: '#888' }}>
                                                            {i + 1}
                                                        </td>
                                                        <td style={{ padding: '6px 8px' }}>
                                                            <span
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 5
                                                                }}
                                                            >
                                                                <span
                                                                    style={{
                                                                        display: 'inline-block',
                                                                        width: 10,
                                                                        height: 10,
                                                                        borderRadius: '50%',
                                                                        background:
                                                                            g.result === 'Win' ? '#4caf50' : '#f44336',
                                                                        flexShrink: 0
                                                                    }}
                                                                />
                                                                <span
                                                                    style={{
                                                                        color:
                                                                            g.result === 'Win' ? '#4caf50' : '#f44336',
                                                                        fontWeight: 'bold'
                                                                    }}
                                                                >
                                                                    {g.result === 'Win' ? 'W' : 'L'}
                                                                </span>
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '6px 8px', color: '#00ffff' }}>
                                                            {g.opponent}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: '6px 8px 6px 0',
                                                                color: '#aaa',
                                                                whiteSpace: 'nowrap',
                                                                fontSize: '0.8rem'
                                                            }}
                                                        >
                                                            {g.date ? new Date(g.date).toLocaleDateString() : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>

                                {/* Right: rating history chart */}
                                <div style={{ flex: '2 1 280px', minWidth: 0 }}>
                                    <div
                                        style={{
                                            color: '#aaa',
                                            fontSize: '0.72rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '.07em',
                                            marginBottom: 10
                                        }}
                                    >
                                        Rating history ({fullRatings.length} point
                                        {fullRatings.length !== 1 ? 's' : ''})
                                    </div>
                                    {fullRatings.length === 0 ? (
                                        <div style={{ color: '#aaa', fontSize: '0.85rem' }}>No rating data</div>
                                    ) : fullRatings.length === 1 ? (
                                        <div style={{ color: '#aaa', fontSize: '0.85rem' }}>
                                            Current rating:{' '}
                                            <span style={{ color: '#ffd700', fontWeight: 'bold' }}>
                                                {fullRatings[0].toFixed(2)}
                                            </span>
                                        </div>
                                    ) : (
                                        (() => {
                                            const minRating = Math.min(...fullRatings);
                                            const maxRating = Math.max(...fullRatings);
                                            const padding = (maxRating - minRating) * 0.1 || 0.5;
                                            const chartData = {
                                                labels: fullRatings.map((_, i) => `Game ${i + 1}`),
                                                datasets: [
                                                    {
                                                        label: 'Rating Trend',
                                                        data: fullRatings,
                                                        borderColor: '#FFD700',
                                                        backgroundColor: 'rgba(255, 215, 0, 0.1)',
                                                        borderWidth: 3,
                                                        fill: true,
                                                        tension: 0.4,
                                                        pointRadius: 5,
                                                        pointBackgroundColor: '#FFD700',
                                                        pointBorderColor: '#FFF',
                                                        pointBorderWidth: 2,
                                                        pointHoverRadius: 7,
                                                        pointHoverBackgroundColor: '#FFF',
                                                        pointHoverBorderColor: '#FFD700'
                                                    }
                                                ]
                                            };
                                            const chartOptions = {
                                                responsive: true,
                                                maintainAspectRatio: true,
                                                plugins: {
                                                    legend: {
                                                        display: true,
                                                        labels: {
                                                            color: '#00ffff',
                                                            font: { size: 14, weight: 'bold' },
                                                            padding: 15
                                                        }
                                                    },
                                                    tooltip: {
                                                        backgroundColor: 'rgba(0,0,0,0.8)',
                                                        titleColor: '#FFD700',
                                                        bodyColor: '#00ffff',
                                                        borderColor: '#FFD700',
                                                        borderWidth: 2,
                                                        padding: 10,
                                                        displayColors: false,
                                                        callbacks: {
                                                            label: (context) => {
                                                                const value = context.parsed.y;
                                                                const prevValue =
                                                                    context.dataIndex > 0
                                                                        ? fullRatings[context.dataIndex - 1]
                                                                        : null;
                                                                const change = prevValue
                                                                    ? (value - prevValue).toFixed(2)
                                                                    : 'N/A';
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
                                                        ticks: { color: '#00ffff', font: { size: 12 } },
                                                        grid: { color: 'rgba(0,255,255,0.1)', drawBorder: false }
                                                    },
                                                    x: {
                                                        ticks: {
                                                            color: '#00ffff',
                                                            font: { size: 11 },
                                                            maxRotation: 45,
                                                            minRotation: 0
                                                        },
                                                        grid: { color: 'rgba(0,255,255,0.05)', drawBorder: false }
                                                    }
                                                }
                                            };
                                            return (
                                                <div
                                                    style={{
                                                        background:
                                                            'linear-gradient(135deg, rgba(255,215,0,0.05), rgba(0,255,255,0.05))',
                                                        border: '2px solid rgba(255,215,0,0.3)',
                                                        borderRadius: 8,
                                                        padding: '1rem',
                                                        boxShadow: '0 4px 12px rgba(255,215,0,0.1)'
                                                    }}
                                                >
                                                    <Line data={chartData} options={chartOptions} />
                                                </div>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>
                        </div>
                    </>,
                    document.body
                )}

            {/* TODO: add the stars image when the tournament just started */}
            <div className={classes.playerMiddleRow} style={isSourcePairHint ? { display: 'none' } : undefined}>
                <div className={classes.starsContainer}>
                    {playerStars && playerStars !== 'TBD' && (
                        <div className={classes.stars_wrapper} style={{ cursor: 'pointer' }}>
                            <StarsComponent stars={playerStars} />
                            <div className={classes.stars_details}>
                                Ratings:
                                {team === 'team1'
                                    ? (() => {
                                          let ratingsArray;

                                          if (pair.ratings1.includes(',')) {
                                              // It's a comma-separated list → split into an array of floats
                                              ratingsArray = pair.ratings1
                                                  .split(',')
                                                  .map((rating) => parseFloat(rating.trim()));
                                          } else {
                                              // It's a single rating → just wrap it in an array as a float
                                              ratingsArray = [parseFloat(pair.ratings1.trim())];
                                          }

                                          const lastRating = ratingsArray.at(-1).toFixed(2);
                                          if (stageIndex === 0) {
                                              return `${lastRating}`;
                                          }
                                          const previousRating =
                                              ratingsArray.length > 1 ? ratingsArray.at(-2).toFixed(2) : '0.00';
                                          const difference = (lastRating - previousRating).toFixed(2);
                                          return (
                                              <>
                                                  {lastRating}{' '}
                                                  <span
                                                      style={{
                                                          color: difference >= 0 ? 'green' : 'red'
                                                      }}
                                                  >
                                                      ({difference >= 0 ? '+' : ''}
                                                      {difference})
                                                  </span>
                                              </>
                                          );
                                      })()
                                    : (() => {
                                          const ratingsArray = pair.ratings2
                                              .split(',')
                                              .map((rating) => parseFloat(rating.trim()));
                                          const lastRating = ratingsArray.at(-1).toFixed(2);
                                          if (stageIndex === 0) {
                                              return `${lastRating}`;
                                          }
                                          const previousRating =
                                              ratingsArray.length > 1 ? ratingsArray.at(-2).toFixed(2) : '0.00';
                                          const difference = (lastRating - previousRating).toFixed(2);
                                          return (
                                              <>
                                                  {lastRating}
                                                  <span
                                                      style={{
                                                          color: difference >= 0 ? 'green' : 'red'
                                                      }}
                                                  >
                                                      ({difference >= 0 ? '+' : ''}
                                                      {difference})
                                                  </span>
                                              </>
                                          );
                                      })()}
                            </div>
                        </div>
                    )}
                </div>
                <div
                    className={`${classes.gamesStrip} ${isMultiGameLayout ? classes.gamesStripBo3 : ''}`}
                    style={{ minWidth: hasTruthyPlayers ? gamesStripMinWidth : '52px' }}
                >
                    {hasTruthyPlayers &&
                        numberOfGames.length > 0 &&
                        numberOfGames.map((game) => {
                            let castle =
                                // pair.games.length > 1 &&
                                game
                                    ? team === 'team1'
                                        ? game.castle1
                                        : game.castle2
                                    : playerCastle
                                      ? playerCastle
                                      : '';

                            let checked =
                                game.castle1 &&
                                game.castle2 &&
                                game.castleWinner === castle &&
                                game.gameStatus === 'Processed';

                            // Extract castle name from format "Castle-Замок" -> "Castle"
                            const getCastleName = (castleValue) => {
                                if (!castleValue) {
                                    return '';
                                }
                                return castleValue.split('-')[0];
                            };

                            // Map castle names to imported local images
                            const getCastleImageUrl = (castleName) => {
                                const castleImages = {
                                    Castle: castleImg,
                                    Rampart: rampartImg,
                                    Tower: towerImg,
                                    Inferno: infernoImg,
                                    Necropolis: necropolisImg,
                                    Dungeon: dungeonImg,
                                    Stronghold: strongholdImg,
                                    Fortress: fortressImg,
                                    Factory: factoryImg,
                                    Conflux: confluxImg,
                                    Cove: coveImg,
                                    Kronverk: kronverkImg
                                };
                                return castleImages[castleName] || '';
                            };

                            const castleName = getCastleName(castle);
                            const castleImageUrl = getCastleImageUrl(castleName);

                            // Get the color for this game
                            const gameColor = team === 'team1' ? game.color1 : game.color2;
                            // Get the gold for this game
                            const gameGold = team === 'team1' ? game.gold1 : game.gold2;

                            return (
                                <div
                                    key={game.gameId}
                                    className="castle-image-display"
                                    style={{ position: 'relative' }}
                                >
                                    {castleImageUrl && (
                                        <>
                                            <img
                                                src={castleImageUrl}
                                                alt={castleName}
                                                title={castleName}
                                                className={checked ? classes['castle-selected'] : ''}
                                                style={{
                                                    width: isMultiGameLayout ? '44px' : '48px',
                                                    height: isMultiGameLayout ? '44px' : '48px',
                                                    border: checked
                                                        ? '3px solid #FFD700'
                                                        : '2px solid rgba(62, 32, 192, 0.3)',
                                                    borderRadius: '4px',
                                                    boxShadow: checked ? '0 0 10px rgba(255, 215, 0, 0.6)' : 'none',
                                                    cursor: 'pointer'
                                                }}
                                            />
                                            {/* Color indicator badge on castle */}
                                            {gameColor && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        top: '-4px',
                                                        right: '-4px',
                                                        width: isMultiGameLayout ? '17px' : '16px',
                                                        height: isMultiGameLayout ? '17px' : '16px',
                                                        borderRadius: '50%',
                                                        background:
                                                            gameColor === 'red'
                                                                ? 'linear-gradient(135deg, #8B0000, #FF0000)'
                                                                : 'linear-gradient(135deg, #00008B, #0000FF)',
                                                        border: '2px solid #FFD700',
                                                        boxShadow:
                                                            gameColor === 'red'
                                                                ? '0 0 6px rgba(255, 0, 0, 0.8)'
                                                                : '0 0 6px rgba(0, 0, 255, 0.8)'
                                                    }}
                                                    title={`Playing as ${gameColor}`}
                                                />
                                            )}
                                            {/* Gold indicator badge on castle */}
                                            {gameGold !== 0 && gameGold !== undefined && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: '-4px',
                                                        left: '50%',
                                                        transform: 'translateX(-50%)',
                                                        padding: '1px 4px',
                                                        borderRadius: '8px',
                                                        background:
                                                            gameGold > 0
                                                                ? 'linear-gradient(135deg, #00AA00, #00FF00)'
                                                                : 'linear-gradient(135deg, #AA0000, #FF0000)',
                                                        border: '1px solid #FFD700',
                                                        fontSize: isMultiGameLayout ? '10px' : '9px',
                                                        fontWeight: 'bold',
                                                        color: '#FFF',
                                                        boxShadow:
                                                            gameGold > 0
                                                                ? '0 0 6px rgba(0, 255, 0, 0.8)'
                                                                : '0 0 6px rgba(255, 0, 0, 0.8)',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                    title={`Gold: ${gameGold > 0 ? '+' : ''}${gameGold}`}
                                                >
                                                    {gameGold > 0 ? '+' : ''}
                                                    {gameGold}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                </div>
            </div>
            <div
                id={`score-${team}-${pairIndex}`}
                style={{
                    width: '3rem',
                    padding: '0.5rem 0.5rem',
                    textAlign: 'center',
                    border: '2px solid rgba(255, 215, 0, 0.5)',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, rgba(62, 32, 192, 0.3), rgba(45, 20, 150, 0.3))',
                    color: '#FFD700',
                    margin: '0.5rem 0',
                    marginLeft: 'auto',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    boxShadow: '0 2px 8px rgba(62, 32, 192, 0.3), inset 0 1px 2px rgba(255, 215, 0, 0.1)',
                    cursor: 'default',
                    userSelect: 'none'
                }}
            >
                {playerScore || 0}
            </div>
        </div>
    );
};
