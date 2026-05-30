import React, { useState } from 'react';
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

/**
 * LeagueBracket — display component for round-robin league tournaments.
 *
 * Props:
 *  pairs              — flat array of all league match objects (playoffPairs[0])
 *  onSelectPair(idx)  — called when user wants to report / view a match
 *  canViewReportButton(pair) — whether to show the report button for this pair
 */
const LeagueBracket = ({ pairs = [], onSelectPair, canViewReportButton, registeredPlayers = [] }) => {
    const [activeTab, setActiveTab] = useState('schedule');

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
                if (pair.winner === pair.team1) {
                    map[pair.team1].wins++;
                    map[pair.team1].points += 3;
                    map[pair.team2].losses++;
                } else {
                    map[pair.team2].wins++;
                    map[pair.team2].points += 3;
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
                    {pairs.map((pair, idx) => {
                        const isFinished = Boolean(pair.winner);
                        const showBtn = canViewReportButton ? canViewReportButton(pair) : false;
                        const inProgressGames = !isFinished
                            ? (pair.games || []).filter((g) => g.castle1 && g.castle2 && !g.castleWinner)
                            : [];
                        const isInProgress = inProgressGames.length > 0;
                        return (
                            <div
                                key={idx}
                                className={`${classes.matchRow} ${isFinished ? classes.matchFinished : isInProgress ? classes.matchInProgress : classes.matchPending}`}
                            >
                                <span
                                    className={`${classes.teamName} ${pair.winner === pair.team1 ? classes.winnerName : ''}`}
                                >
                                    {pair.team1}
                                </span>

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

                                <span
                                    className={`${classes.teamName} ${classes.teamRight} ${pair.winner === pair.team2 ? classes.winnerName : ''}`}
                                >
                                    {pair.team2}
                                </span>

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
                                <th title="Points (win = 3)">Pts</th>
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
                    <p className={classes.pointsNote}>3 points awarded per series win.</p>
                </div>
            )}
        </div>
    );
};

export default LeagueBracket;
