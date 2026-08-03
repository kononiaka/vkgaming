import React from 'react';
import { getHeadToHeadSourceLabel } from '../../utils/headToHeadStats';
import classes from './StatsPopup.module.css';

const formatSeriesDate = (date) => {
    if (!date) {
        return '—';
    }
    try {
        return new Date(date).toLocaleDateString();
    } catch {
        return '—';
    }
};

const StatsPopup = ({ stats, loading = false, onClose }) => {
    if (!stats) {
        return null;
    }

    const tournament = stats.tournament;
    const hasTournamentSeries = Boolean(tournament?.all?.seriesTotal > 0);
    const yearHasSeries = Boolean(tournament?.thisYear?.seriesTotal > 0);
    const showAllCupsCard =
        yearHasSeries && tournament.all.seriesTotal !== tournament.thisYear.seriesTotal;

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
                        Head-to-head
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
                            <p className={classes.loadingHint}>
                                Checking HotA Meta, Konoplay, and tournament series
                            </p>
                        </div>
                    ) : (
                        <>
                            <section className={classes.section}>
                                <h4 className={classes.sectionTitle}>Tournaments (official)</h4>
                                {hasTournamentSeries ? (
                                    <>
                                        <div
                                            className={`${classes.statsGrid} ${
                                                showAllCupsCard ? '' : classes.statsGridSingle
                                            }`}
                                        >
                                            <div className={classes.statCard}>
                                                <span className={classes.statLabel}>
                                                    {yearHasSeries ? `Series ${tournament.year}` : 'All cups'}
                                                </span>
                                                <span className={classes.statValue}>
                                                    {yearHasSeries
                                                        ? tournament.thisYear.seriesScore
                                                        : tournament.all.seriesScore}
                                                </span>
                                                <span className={classes.statHint}>
                                                    {yearHasSeries
                                                        ? 'By series this year'
                                                        : 'By series · all cups'}
                                                </span>
                                            </div>
                                            {showAllCupsCard && (
                                                <div className={classes.statCard}>
                                                    <span className={classes.statLabel}>All cups</span>
                                                    <span className={classes.statValue}>
                                                        {tournament.all.seriesScore}
                                                    </span>
                                                    <span className={classes.statHint}>
                                                        {tournament.all.seriesTotal} series total
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {(tournament.banInsightA || tournament.banInsightB) && (
                                            <ul className={classes.insightList}>
                                                {tournament.banInsightA && <li>{tournament.banInsightA}</li>}
                                                {tournament.banInsightB && <li>{tournament.banInsightB}</li>}
                                            </ul>
                                        )}

                                        {tournament.recentSeries?.length > 0 && (
                                            <div className={classes.seriesBlock}>
                                                <h4 className={classes.sectionTitleSpaced}>Recent cup series</h4>
                                                <div className={classes.seriesTable}>
                                                    <div className={classes.seriesHead}>
                                                        <span>Date</span>
                                                        <span>Cup</span>
                                                        <span>Score</span>
                                                        <span>Winner</span>
                                                    </div>
                                                    {tournament.recentSeries.map((series, idx) => (
                                                        <div
                                                            key={
                                                                series.id ||
                                                                `${series.tournamentName}-${series.score}-${series.date}-${idx}`
                                                            }
                                                            className={classes.seriesRow}
                                                        >
                                                            <span className={classes.seriesDate}>
                                                                {formatSeriesDate(series.date)}
                                                            </span>
                                                            <span className={classes.seriesCup}>
                                                                {series.tournamentName || 'Tournament'}
                                                            </span>
                                                            <span className={classes.seriesScore}>
                                                                {series.score || '—'}
                                                            </span>
                                                            <span className={classes.seriesWinner}>
                                                                {series.winner || '—'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className={classes.emptyNote}>
                                        No official cup series logged between these players yet.
                                    </p>
                                )}
                            </section>

                            <section className={classes.section}>
                                <h4 className={classes.sectionTitle}>
                                    {stats.source === 'hota-meta' ? 'HotA Meta (ranked)' : 'Konoplay (all games)'}
                                </h4>
                                <div className={classes.statsGrid}>
                                    <div className={classes.statCard}>
                                        <span className={classes.statLabel}>Games</span>
                                        <span className={classes.statValue}>{stats.total}</span>
                                    </div>
                                    <div className={classes.statCard}>
                                        <span className={classes.statLabel}>{stats.playerA} W</span>
                                        <span className={classes.statValue}>{stats.wins}</span>
                                    </div>
                                    <div className={classes.statCard}>
                                        <span className={classes.statLabel}>{stats.playerB} W</span>
                                        <span className={classes.statValue}>{stats.losses}</span>
                                    </div>
                                    <div className={classes.statCard}>
                                        <span className={classes.statLabel}>{stats.playerA} WR</span>
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
                                    <h4 className={classes.sectionTitle}>
                                        Recent in game log
                                        {stats.last5Games.length < 5
                                            ? ` (${stats.last5Games.length})`
                                            : ' (last 5)'}
                                    </h4>
                                    <p className={classes.statHint} style={{ marginBottom: '0.55rem' }}>
                                        Only matches saved under Games history — cup brackets above can show more.
                                    </p>
                                    <ul className={classes.statsList}>
                                        {stats.last5Games.map((game, idx) => (
                                            <li key={(game.id || game.date || '') + idx}>
                                                {game.date ? `${new Date(game.date).toLocaleDateString()} — ` : ''}
                                                <em>{game.score}</em>
                                                {game.winner ? (
                                                    <>
                                                        {' · '}
                                                        <b>{game.winner}</b>
                                                    </>
                                                ) : null}
                                                {game.id && (
                                                    <>
                                                        {' — '}
                                                        <a
                                                            href={`/games/homm3#${game.id}`}
                                                            className={classes.historyLink}
                                                        >
                                                            History
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
