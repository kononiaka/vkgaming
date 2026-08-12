import React, { useEffect, useMemo, useState } from 'react';
import { fetchHotaFactions } from '../../../../api/hotaMeta';
import { getCastleImage } from '../../../../utils/castleImages';
import { buildTournamentMetaRows, fetchTournamentGameLog, META_MIN_SAMPLE } from '../../../../utils/tournamentMetaStats';
import classes from './TournamentMeta.module.css';

const formatRate = (value) => {
    if (value == null || Number.isNaN(Number(value))) {
        return '—';
    }
    return `${Number(value).toFixed(1)}%`;
};

const formatDelta = (delta) => {
    if (delta == null || Number.isNaN(Number(delta))) {
        return '—';
    }
    const rounded = Number(delta).toFixed(1);
    if (Number(delta) > 0) {
        return `+${rounded}`;
    }
    return rounded;
};

/**
 * Per-tournament castle win rates vs global HotA Meta.
 * Aggregates from live bracket pairs + /games/heroes3 for this tournamentId.
 */
const TournamentMeta = ({ tournamentId, pairs = [], compact = false }) => {
    const [gameLogGames, setGameLogGames] = useState([]);
    const [hotaFactions, setHotaFactions] = useState([]);
    const [logLoading, setLogLoading] = useState(Boolean(tournamentId));
    const [hotaLoading, setHotaLoading] = useState(true);
    const [logError, setLogError] = useState('');
    const [hotaError, setHotaError] = useState('');

    useEffect(() => {
        let cancelled = false;

        const loadLog = async () => {
            if (!tournamentId) {
                setGameLogGames([]);
                setLogLoading(false);
                return;
            }
            setLogLoading(true);
            setLogError('');
            try {
                const games = await fetchTournamentGameLog(tournamentId);
                if (!cancelled) {
                    setGameLogGames(games);
                }
            } catch (error) {
                console.error('Tournament meta game log failed:', error);
                if (!cancelled) {
                    setLogError('Could not load reported games. Showing bracket data only.');
                    setGameLogGames([]);
                }
            } finally {
                if (!cancelled) {
                    setLogLoading(false);
                }
            }
        };

        loadLog();
        return () => {
            cancelled = true;
        };
    }, [tournamentId]);

    useEffect(() => {
        let cancelled = false;

        const loadHota = async () => {
            setHotaLoading(true);
            setHotaError('');
            try {
                const factions = await fetchHotaFactions();
                if (!cancelled) {
                    setHotaFactions(factions || []);
                }
            } catch (error) {
                console.error('Tournament meta HotA fetch failed:', error);
                if (!cancelled) {
                    setHotaError('HotA Meta unavailable — tournament rates still shown.');
                    setHotaFactions([]);
                }
            } finally {
                if (!cancelled) {
                    setHotaLoading(false);
                }
            }
        };

        loadHota();
        return () => {
            cancelled = true;
        };
    }, []);

    const { rows, gameCount } = useMemo(
        () =>
            buildTournamentMetaRows({
                pairs,
                gameLogGames,
                hotaFactions
            }),
        [pairs, gameLogGames, hotaFactions]
    );

    const loading = logLoading || hotaLoading;

    return (
        <div className={`${classes.wrap} ${compact ? classes.compact : ''}`}>
            <div className={classes.header}>
                <div>
                    <h3 className={classes.title}>Tournament Meta</h3>
                    <p className={classes.subtitle}>
                        Castle win rates in this cup only — compared with global HotA Meta ranked rates.
                    </p>
                </div>
                <div className={classes.summary}>
                    <div className={classes.summaryCard}>
                        <span className={classes.summaryLabel}>Maps counted</span>
                        <span className={classes.summaryValue}>{gameCount}</span>
                    </div>
                    <div className={classes.summaryCard}>
                        <span className={classes.summaryLabel}>Castles seen</span>
                        <span className={classes.summaryValue}>{rows.length}</span>
                    </div>
                </div>
            </div>

            {(logError || hotaError) && (
                <p className={classes.notice}>
                    {[logError, hotaError].filter(Boolean).join(' ')}
                </p>
            )}

            {loading && gameCount === 0 && rows.length === 0 ? (
                <p className={classes.loading}>Loading tournament meta…</p>
            ) : rows.length === 0 ? (
                <p className={classes.empty}>
                    No finished maps with castles yet. Meta fills in as games are reported.
                </p>
            ) : (
                <div className={classes.tableWrapper}>
                    <table className={classes.table}>
                        <thead>
                            <tr>
                                <th className={classes.rankCol}>#</th>
                                <th className={classes.castleCol}>Castle</th>
                                <th className={classes.numCol}>Games</th>
                                <th className={classes.numCol}>W</th>
                                <th className={classes.numCol}>L</th>
                                <th className={classes.rateCol}>Cup WR</th>
                                <th className={classes.rateCol}>HotA WR</th>
                                <th className={classes.deltaCol}>Δ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => {
                                const image = getCastleImage(row.name);
                                const cupRate = row.displayWinRate;
                                const deltaClass =
                                    row.delta == null
                                        ? ''
                                        : row.delta > 0.5
                                          ? classes.deltaUp
                                          : row.delta < -0.5
                                            ? classes.deltaDown
                                            : classes.deltaFlat;

                                return (
                                    <tr key={row.name} className={index < 3 ? classes.topRank : ''}>
                                        <td className={classes.rankCol}>{index + 1}</td>
                                        <td className={classes.castleCol}>
                                            <div className={classes.castleCell}>
                                                {image && (
                                                    <img
                                                        src={image}
                                                        alt=""
                                                        className={classes.castleThumb}
                                                    />
                                                )}
                                                <span>{row.name}</span>
                                            </div>
                                        </td>
                                        <td className={classes.numCol}>{row.total}</td>
                                        <td className={`${classes.numCol} ${classes.winCol}`}>{row.win}</td>
                                        <td className={`${classes.numCol} ${classes.loseCol}`}>{row.lose}</td>
                                        <td className={classes.rateCol}>
                                            {cupRate == null ? (
                                                <span
                                                    className={classes.rateMuted}
                                                    title={`Needs ${META_MIN_SAMPLE}+ maps for a stable cup WR`}
                                                >
                                                    —
                                                </span>
                                            ) : (
                                                <>
                                                    <span className={classes.rateValue}>{formatRate(cupRate)}</span>
                                                    <div className={classes.rateBar}>
                                                        <div
                                                            className={classes.rateBarFill}
                                                            style={{
                                                                width: `${Math.min(Math.max(cupRate, 0), 100)}%`
                                                            }}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </td>
                                        <td className={classes.rateCol}>{formatRate(row.hotaWinRate)}</td>
                                        <td className={`${classes.deltaCol} ${deltaClass}`}>
                                            {formatDelta(row.delta)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {rows.some((row) => !row.sampleReliable) && (
                <p className={classes.sampleNote}>
                    Cup WR and Δ need {META_MIN_SAMPLE}+ maps per castle before rates are shown.
                </p>
            )}
        </div>
    );
};

export default TournamentMeta;
