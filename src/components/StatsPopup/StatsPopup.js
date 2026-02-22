import React from 'react';
import classes from './StatsPopup.module.css';

const StatsPopup = ({ stats, onClose }) => {
    if (!stats) return null;
    return (
        <div className={classes.backdrop} onClick={onClose}>
            <div className={classes.popup} onClick={(e) => e.stopPropagation()}>
                <button className={classes.closeButton} onClick={onClose}>
                    ×
                </button>
                <h3>
                    {stats.playerA} vs {stats.playerB}
                </h3>
                <ul className={classes.statsList}>
                    <li>
                        Total games: <b>{stats.total}</b>
                    </li>
                    <li>
                        Wins for {stats.playerA}: <b>{stats.wins}</b>
                    </li>
                    <li>
                        Wins for {stats.playerB}: <b>{stats.losses}</b>
                    </li>
                    <li>
                        Win % for {stats.playerA}: <b>{stats.winPercent}%</b>
                    </li>
                </ul>
                {/* Restart Statistics Section */}
                {(stats.restartCoeffA !== undefined || stats.restartCoeffB !== undefined) && (
                    <div style={{ marginTop: '1rem', borderTop: '1px solid #FFD700', paddingTop: '1rem' }}>
                        <h4 style={{ margin: '0.5rem 0', color: '#FFD700' }}>РЕСТАРТЫ (Restarts)</h4>
                        <ul className={classes.statsList}>
                            <li>
                                {stats.playerA}: <b>{stats.restartCoeffA?.toFixed(2) || '1.00'}</b>
                            </li>
                            <li>
                                {stats.playerB}: <b>{stats.restartCoeffB?.toFixed(2) || '1.00'}</b>
                            </li>
                        </ul>
                    </div>
                )}
                {stats.last5Games && stats.last5Games.length > 0 && (
                    <div className={classes.lastGames}>
                        <b>Last 5 games:</b>
                        <ul className={classes.statsList}>
                            {stats.last5Games.map((game, idx) => (
                                <li key={game.date + idx}>
                                    {new Date(game.date).toLocaleDateString()} — {game.opponent1} vs {game.opponent2} :{' '}
                                    <b>{game.score}</b> (Winner: <b>{game.winner}</b>)
                                    {game.id && (
                                        <>
                                            {' — '}
                                            <a
                                                href={`/games/homm3#${game.id}`}
                                                style={{ color: '#00ffff', textDecoration: 'underline' }}
                                            >
                                                View in History
                                            </a>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsPopup;
