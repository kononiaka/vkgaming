import React from 'react';
import { getHeadToHeadSourceLabel } from '../../utils/headToHeadStats';
import classes from './StatsPopup.module.css';

const StatsPopup = ({ stats, loading = false, onClose }) => {
    if (!stats) {
        return null;
    }

    return (
        <div className={classes.backdrop} onClick={loading ? undefined : onClose}>
            <div className={classes.popup} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <button type="button" className={classes.closeButton} onClick={onClose} aria-label="Close stats">
                    ×
                </button>
                <div className={classes.header}>
                    <h3 className={classes.title}>
                        {stats.playerA} vs {stats.playerB}
                    </h3>
                    <p className={classes.subtitle}>
                        Head-to-head statistics
                        {!loading && stats.source ? (
                            <>
                                {' '}
                                · <span className={classes.sourceBadge}>{getHeadToHeadSourceLabel(stats.source)}</span>
                            </>
                        ) : null}
                    </p>
                </div>
                <div className={classes.body}>
                    {loading ? (
                        <div className={classes.loadingState} aria-live="polite" aria-busy="true">
                            <div className={classes.spinner} aria-hidden="true" />
                            <p className={classes.loadingText}>Loading head-to-head stats…</p>
                            <p className={classes.loadingHint}>Checking HotA Meta, then Konoplay if needed</p>
                        </div>
                    ) : (
                        <>
                            <section className={classes.section}>
                                <h4 className={classes.sectionTitle}>Overview</h4>
                                <div className={classes.statsGrid}>
                                    <div className={`${classes.statCard} ${classes.statCardWide}`}>
                                        <span className={classes.statLabel}>Total games</span>
                                        <span className={classes.statValue}>{stats.total}</span>
                                    </div>
                                    <div className={classes.statCard}>
                                        <span className={classes.statLabel}>Wins for {stats.playerA}</span>
                                        <span className={classes.statValue}>{stats.wins}</span>
                                    </div>
                                    <div className={classes.statCard}>
                                        <span className={classes.statLabel}>Wins for {stats.playerB}</span>
                                        <span className={classes.statValue}>{stats.losses}</span>
                                    </div>
                                    <div className={`${classes.statCard} ${classes.statCardWide}`}>
                                        <span className={classes.statLabel}>Win rate for {stats.playerA}</span>
                                        <span className={classes.statValue}>{stats.winPercent}%</span>
                                    </div>
                                </div>
                            </section>

                            {(stats.restartCoeffA !== undefined || stats.restartCoeffB !== undefined) && (
                                <section className={classes.section}>
                                    <h4 className={classes.sectionTitle}>Restarts</h4>
                                    <ul className={classes.statsList}>
                                        <li>
                                            {stats.playerA}: <b>{stats.restartCoeffA?.toFixed(2) || '1.00'}</b>
                                        </li>
                                        <li>
                                            {stats.playerB}: <b>{stats.restartCoeffB?.toFixed(2) || '1.00'}</b>
                                        </li>
                                    </ul>
                                </section>
                            )}

                            {stats.last5Games && stats.last5Games.length > 0 && (
                                <section className={classes.section}>
                                    <h4 className={classes.sectionTitle}>Last 5 games</h4>
                                    <ul className={classes.statsList}>
                                        {stats.last5Games.map((game, idx) => (
                                            <li key={game.date + idx}>
                                                {new Date(game.date).toLocaleDateString()} — {game.opponent1} vs{' '}
                                                {game.opponent2}: <em>{game.score}</em> (Winner: <b>{game.winner}</b>)
                                                {game.id && (
                                                    <>
                                                        {' — '}
                                                        <a
                                                            href={`/games/homm3#${game.id}`}
                                                            className={classes.historyLink}
                                                        >
                                                            View in History
                                                        </a>
                                                    </>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatsPopup;
