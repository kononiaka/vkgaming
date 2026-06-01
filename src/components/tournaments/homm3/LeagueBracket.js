import React, { useState, useEffect } from 'react';
import StarsComponent from '../../Stars/Stars';
import classes from './LeagueBracket.module.css';
import castleImg from '../../../image/castles/castle.jpeg';
import rampartImg from '../../../image/castles/rampart.jpeg';
import towerImg from '../../../image/castles/tower.jpeg';
import infernoImg from '../../../image/castles/inferno.jpeg';
import necropolisImg from '../../../image/castles/necropolis.jpeg';
import dungeonImg from '../../../image/castles/dungeon.jpeg';
import strongholdImg from '../../../image/castles/stronghold.jpeg';
import fortressImg from '../../../image/castles/fortress.jpeg';
import confluxImg from '../../../image/castles/conflux.jpeg';
import coveImg from '../../../image/castles/cove.jpeg';
import factoryImg from '../../../image/castles/factory.jpeg';
import kronverkImg from '../../../image/castles/kronverk.jpeg';

const CASTLE_IMAGE_MAP = {
    castle: castleImg,
    rampart: rampartImg,
    tower: towerImg,
    inferno: infernoImg,
    necropolis: necropolisImg,
    dungeon: dungeonImg,
    stronghold: strongholdImg,
    fortress: fortressImg,
    conflux: confluxImg,
    cove: coveImg,
    factory: factoryImg,
    kronverk: kronverkImg
};

const getCastleImage = (name) =>
    CASTLE_IMAGE_MAP[
        String(name || '')
            .split('-')[0]
            .trim()
            .toLowerCase()
    ] || null;

const renderRestartTokens = (r111, r112) => {
    const used111 = Math.max(0, Math.min(2, Number(r111) || 0));
    const show112AsUsed = (Number(r112) || 0) >= 1 || used111 >= 1;
    return (
        <div className={classes.restartRow}>
            {[0, 1].map((i) => (
                <span key={i} className={`${classes.restartToken} ${i < used111 ? classes.restartTokenUsed : ''}`}>
                    111
                </span>
            ))}
            <span className={`${classes.restartToken} ${show112AsUsed ? classes.restartTokenUsed : ''}`}>112</span>
        </div>
    );
};

// Circle-method round-robin: returns map of "team1|team2" -> round number (1-indexed)
const buildRoundMap = (names) => {
    const list = names.length % 2 !== 0 ? [...names, null] : [...names];
    const size = list.length;
    const map = {};
    for (let r = 0; r < size - 1; r++) {
        const rotation = [list[0]];
        for (let i = 0; i < size - 1; i++) {
            rotation.push(list[1 + ((i + r) % (size - 1))]);
        }
        for (let i = 0; i < size / 2; i++) {
            const p1 = rotation[i];
            const p2 = rotation[size - 1 - i];
            if (p1 !== null && p2 !== null) {
                map[`${p1}|${p2}`] = r + 1;
                map[`${p2}|${p1}`] = r + 1;
            }
        }
    }
    return map;
};

// Leaderboard-based win prediction (no H2H history needed)
const getWinPrediction = (team1Rating, team2Rating, team1Stars, team2Stars, team1Place, team2Place) => {
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const r1 = parseFloat(team1Rating) || 0;
    const r2 = parseFloat(team2Rating) || 0;
    const s1 = parseFloat(team1Stars) || 0;
    const s2 = parseFloat(team2Stars) || 0;
    const p1 = Number(team1Place) > 0 ? Number(team1Place) : null;
    const p2 = Number(team2Place) > 0 ? Number(team2Place) : null;
    const placeAdv = p1 && p2 ? clamp((p2 - p1) * 1.8, -12, 12) : 0;
    const ratingAdv = clamp((r1 - r2) * 0.04, -12, 12);
    const starsAdv = clamp((s1 - s2) * 0.8, -4, 4);
    const pred1 = clamp(50 + placeAdv + ratingAdv + starsAdv, 15, 85);
    return { team1: pred1.toFixed(1), team2: (100 - pred1).toFixed(1) };
};

/**
 * LeagueBracket — display component for round-robin league tournaments.
 *
 * Props:
 *  pairs              — flat array of all league match objects (playoffPairs[0])
 *  onSelectPair(idx)  — called when user wants to report / view a match
 *  canViewReportButton(pair) — whether to show the report button for this pair
 */
const LeagueBracket = ({ pairs = [], onSelectPair, canViewReportButton, registeredPlayers = [], playersObj = {} }) => {
    const [activeTab, setActiveTab] = useState('schedule');
    const [rankByNickname, setRankByNickname] = useState({});

    // Fetch all users once and compute global leaderboard ranks (same as StartingPageContent)
    useEffect(() => {
        const fetchRanks = async () => {
            try {
                const res = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
                if (!res.ok) return;
                const data = await res.json();
                const getLatestRating = (u) => {
                    const r = u.ratings;
                    if (typeof r === 'string' && r.includes(',')) return parseFloat(r.split(',').at(-1)) || 0;
                    return parseFloat(r) || 0;
                };
                const sorted = Object.values(data || {})
                    .filter((u) => u && u.ratings !== undefined)
                    .sort((a, b) => getLatestRating(b) - getLatestRating(a));
                const map = {};
                sorted.forEach((u, idx) => {
                    if (u.enteredNickname) map[u.enteredNickname] = idx + 1;
                });
                setRankByNickname(map);
            } catch {
                // silently ignore
            }
        };
        fetchRanks();
    }, []);

    // Points for a series win based on total restarts used by the winner:
    //   0 restarts → 3 pts | 1× 111 → 2.5 pts | 2× 111 or any 112 → 2 pts
    const calcWinPoints = (pair, winnerTeam) => {
        const games = Array.isArray(pair.games) ? pair.games : [];
        const isTeam1 = winnerTeam === pair.team1;
        let total111 = 0;
        let total112 = 0;
        games.forEach((g) => {
            if (!g) return;
            total111 += Number(isTeam1 ? g.restart1_111 : g.restart2_111) || 0;
            total112 += Number(isTeam1 ? g.restart1_112 : g.restart2_112) || 0;
        });
        const totalRestarts = total111 + total112;
        if (totalRestarts === 0) return 3;
        if (totalRestarts === 1) return 2.5;
        return 2;
    };

    // Compute standings from settled pairs, seeding all registered players at zero
    const computeStandings = () => {
        const map = {};
        registeredPlayers.forEach((name) => {
            if (name) {
                map[name] = { played: 0, wins: 0, losses: 0, points: 0 };
            }
        });
        pairs.forEach((pair) => {
            if (pair.team1 && pair.team1 !== 'TBD' && !map[pair.team1])
                map[pair.team1] = { played: 0, wins: 0, losses: 0, points: 0 };
            if (pair.team2 && pair.team2 !== 'TBD' && !map[pair.team2])
                map[pair.team2] = { played: 0, wins: 0, losses: 0, points: 0 };
            if (pair.winner && pair.winner !== 'TBD') {
                map[pair.team1].played++;
                map[pair.team2].played++;
                const pts = calcWinPoints(pair, pair.winner);
                if (pair.winner === pair.team1) {
                    map[pair.team1].wins++;
                    map[pair.team1].points += pts;
                    map[pair.team2].losses++;
                } else {
                    map[pair.team2].wins++;
                    map[pair.team2].points += pts;
                    map[pair.team1].losses++;
                }
            }
        });
        return Object.entries(map)
            .map(([name, s]) => ({ name, ...s }))
            .sort((a, b) => b.points - a.points || b.wins - a.wins);
    };

    const standings = computeStandings();
    const finished = pairs.filter((p) => p.winner).length;
    const total = pairs.length;

    // Group matches into days using pair.round if available, else compute via circle method
    const computeRoundGroups = () => {
        if (pairs.length === 0) {
            return [];
        }
        if (pairs[0]?.round != null) {
            const groups = {};
            pairs.forEach((pair, idx) => {
                const r = pair.round;
                if (!groups[r]) {
                    groups[r] = [];
                }
                groups[r].push({ pair, idx });
            });
            return Object.keys(groups)
                .sort((a, b) => Number(a) - Number(b))
                .map((r) => ({ round: Number(r), items: groups[r] }));
        }
        // Fallback: derive rounds from team names using circle method
        const playerNames = [...new Set(pairs.flatMap((p) => [p.team1, p.team2]).filter((n) => n && n !== 'TBD'))];
        const roundMap = buildRoundMap(playerNames);
        const groups = {};
        pairs.forEach((pair, idx) => {
            const r = roundMap[`${pair.team1}|${pair.team2}`] || 1;
            if (!groups[r]) {
                groups[r] = [];
            }
            groups[r].push({ pair, idx });
        });
        return Object.keys(groups)
            .sort((a, b) => Number(a) - Number(b))
            .map((r) => ({ round: Number(r), items: groups[r] }));
    };
    const roundGroups = computeRoundGroups();

    return (
        <div className={classes.container}>
            <div className={classes.progress}>
                Matches played: <strong>{finished}</strong> / <strong>{total}</strong>
            </div>

            <div className={classes.tabs}>
                <button
                    className={`${classes.tab} ${activeTab === 'schedule' ? classes.activeTab : ''}`}
                    onClick={() => setActiveTab('schedule')}
                >
                    Schedule
                </button>
                <button
                    className={`${classes.tab} ${activeTab === 'standings' ? classes.activeTab : ''}`}
                    onClick={() => setActiveTab('standings')}
                >
                    Standings
                </button>
            </div>

            {activeTab === 'schedule' && (
                <div className={classes.schedule}>
                    {roundGroups.map(({ round, items }) => (
                        <div key={round}>
                            <div className={classes.dayHeader}>Day {round}</div>
                            {items.map(({ pair, idx }) => {
                                const isFinished = Boolean(pair.winner);
                                const showBtn = canViewReportButton ? canViewReportButton(pair) : false;
                                const inProgressGames = !isFinished
                                    ? (pair.games || []).filter((g) => g.castle1 && g.castle2 && !g.castleWinner)
                                    : [];
                                const isInProgress = inProgressGames.length > 0;

                                const getPlayer = (name) =>
                                    name && name !== 'TBD'
                                        ? Object.values(playersObj || {}).find((p) => p && p.name === name) || null
                                        : null;

                                const getLatestRating = (ratingsStr) => {
                                    if (!ratingsStr) return 0;
                                    const str = String(ratingsStr);
                                    if (str.includes(',')) return parseFloat(str.split(',').at(-1)) || 0;
                                    return parseFloat(str) || 0;
                                };

                                const p1 = getPlayer(pair.team1);
                                const p2 = getPlayer(pair.team2);

                                const stars1 =
                                    pair.stars1 != null
                                        ? (typeof pair.stars1 === 'string' && pair.stars1.includes(',')
                                              ? parseFloat(pair.stars1.split(',').at(-1))
                                              : parseFloat(pair.stars1)) || 0
                                        : parseFloat(p1?.stars) || 0;
                                const stars2 =
                                    pair.stars2 != null
                                        ? (typeof pair.stars2 === 'string' && pair.stars2.includes(',')
                                              ? parseFloat(pair.stars2.split(',').at(-1))
                                              : parseFloat(pair.stars2)) || 0
                                        : parseFloat(p2?.stars) || 0;

                                const place1 = rankByNickname[pair.team1] || p1?.placeInLeaderboard || null;
                                const place2 = rankByNickname[pair.team2] || p2?.placeInLeaderboard || null;

                                const rating1 = getLatestRating(pair.ratings1 ?? p1?.ratings);
                                const rating2 = getLatestRating(pair.ratings2 ?? p2?.ratings);

                                const prediction = getWinPrediction(rating1, rating2, stars1, stars2, place1, place2);

                                return (
                                    <div
                                        key={idx}
                                        className={`${classes.matchRow} ${isFinished ? classes.matchFinished : isInProgress ? classes.matchInProgress : classes.matchPending}`}
                                    >
                                        <div className={classes.teamCell}>
                                            <span
                                                className={`${classes.teamName} ${pair.winner === pair.team1 ? classes.winnerName : ''}`}
                                            >
                                                {place1 && <span className={classes.placeTag}>#{place1}</span>}
                                                {pair.team1}
                                            </span>
                                            {stars1 > 0 && (
                                                <div className={classes.starsWrap}>
                                                    <StarsComponent stars={stars1} />
                                                </div>
                                            )}
                                        </div>

                                        <div className={classes.centerBlock}>
                                            {isFinished ? (
                                                <span className={classes.score}>
                                                    {pair.score1 ?? 0}&nbsp;:&nbsp;{pair.score2 ?? 0}
                                                </span>
                                            ) : isInProgress ? (
                                                <span className={classes.liveTag}>LIVE</span>
                                            ) : (
                                                <span className={classes.vs}>vs</span>
                                            )}
                                            {!isFinished && (
                                                <span className={classes.predictionRow}>
                                                    {prediction.team1}% / {prediction.team2}%
                                                </span>
                                            )}
                                            {showBtn && (
                                                <button
                                                    className={`${classes.reportBtn} ${isFinished ? classes.reReportBtn : ''}`}
                                                    onClick={() => onSelectPair(idx)}
                                                    title={isFinished ? 'Re-report result' : 'Report result'}
                                                >
                                                    {isFinished ? '✎' : '▶'}
                                                </button>
                                            )}
                                        </div>

                                        <div className={`${classes.teamCell} ${classes.teamCellRight}`}>
                                            {stars2 > 0 && (
                                                <div className={classes.starsWrap}>
                                                    <StarsComponent stars={stars2} />
                                                </div>
                                            )}
                                            <span
                                                className={`${classes.teamName} ${classes.teamRight} ${pair.winner === pair.team2 ? classes.winnerName : ''}`}
                                            >
                                                {pair.team2}
                                                {place2 && <span className={classes.placeTag}>#{place2}</span>}
                                            </span>
                                        </div>

                                        {isInProgress &&
                                            inProgressGames.map((game, gIdx) => (
                                                <div key={gIdx} className={classes.gameDetail}>
                                                    <div className={classes.castleCard}>
                                                        {getCastleImage(game.castle1) && (
                                                            <img
                                                                src={getCastleImage(game.castle1)}
                                                                alt={game.castle1}
                                                                className={classes.castleImg}
                                                            />
                                                        )}
                                                        <div className={classes.castleName}>{game.castle1 || '—'}</div>
                                                        <div className={classes.goldRow}>💰 {game.gold1 ?? 0}</div>
                                                        {renderRestartTokens(game.restart1_111, game.restart1_112)}
                                                    </div>
                                                    <div className={classes.gameDetailCenter}>
                                                        Game {(game.gameId ?? gIdx) + 1}
                                                    </div>
                                                    <div className={`${classes.castleCard} ${classes.castleCardRight}`}>
                                                        {getCastleImage(game.castle2) && (
                                                            <img
                                                                src={getCastleImage(game.castle2)}
                                                                alt={game.castle2}
                                                                className={classes.castleImg}
                                                            />
                                                        )}
                                                        <div className={classes.castleName}>{game.castle2 || '—'}</div>
                                                        <div className={classes.goldRow}>💰 {game.gold2 ?? 0}</div>
                                                        {renderRestartTokens(game.restart2_111, game.restart2_112)}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                    {pairs.length === 0 && <p className={classes.emptyNote}>No matches generated yet.</p>}
                </div>
            )}

            {activeTab === 'standings' && (
                <div className={classes.standingsWrapper}>
                    <table className={classes.standingsTable}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Player</th>
                                <th title="Played">P</th>
                                <th title="Wins">W</th>
                                <th title="Losses">L</th>
                                <th title="Points (3/2.5/2 per win based on restarts)">Pts</th>
                            </tr>
                        </thead>
                        <tbody>
                            {standings.map((s, i) => (
                                <tr key={s.name} className={i === 0 && s.played > 0 ? classes.leader : ''}>
                                    <td>{i + 1}</td>
                                    <td className={classes.playerCell}>{s.name}</td>
                                    <td>{s.played}</td>
                                    <td>{s.wins}</td>
                                    <td>{s.losses}</td>
                                    <td className={classes.pointsCell}>{s.points}</td>
                                </tr>
                            ))}
                            {standings.length === 0 && (
                                <tr>
                                    <td colSpan={6} className={classes.emptyNote}>
                                        No completed matches yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <p className={classes.pointsNote}>Win pts: 3 (no restarts) · 2.5 (1× 111) · 2 (2× 111 or 112)</p>
                </div>
            )}
        </div>
    );
};

export default LeagueBracket;
