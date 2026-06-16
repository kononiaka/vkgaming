import { FIREBASE_DATABASE_URL } from '../../../../config/firebase';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ALL_CASTLES } from '../../../Players/Players';
import { fetchHotaFactions, fetchHotaSummary, HOTA_FACTIONS } from '../../../../api/hotaMeta';
import classes from './Heroes3Stats.module.css';

const getCastleImage = (name) => {
    const match = ALL_CASTLES.find((castle) => castle.name === name);
    return match?.image || null;
};

const Heroes3Stats = () => {
    const [castles, setCastles] = useState([]);
    const [inProgressCastles, setInProgressCastles] = useState(new Set());
    const [isLoaded, setIsLoaded] = useState(false);
    const [hotaFactions, setHotaFactions] = useState([]);
    const [hotaSummary, setHotaSummary] = useState(null);
    const [hotaError, setHotaError] = useState('');
    const [hotaLoaded, setHotaLoaded] = useState(false);

    useEffect(() => {
        const fetchCastlesList = async () => {
            try {
                const response = await fetch(`${FIREBASE_DATABASE_URL}/statistic/heroes3/castles.json`);
                const data = await response.json();

                const list = Object.entries(data || {}).map(([id, castle]) => ({
                    id,
                    name: id,
                    win: castle.win,
                    lose: castle.lose,
                    total: castle.total,
                    rate: castle.total !== 0 ? (castle.win / castle.total) * 100 : 0
                }));

                list.sort((a, b) => b.rate - a.rate);
                setCastles(list);
            } catch (error) {
                console.error(error);
            }
        };

        const fetchInProgressGames = async () => {
            try {
                const response = await fetch(`${FIREBASE_DATABASE_URL}/tournaments.json`);
                const data = await response.json();
                const castlesInProgress = new Set();

                if (data) {
                    Object.keys(data).forEach((tournamentKey) => {
                        const tournaments = data[tournamentKey];
                        for (const tournament in tournaments) {
                            const tourney = tournaments[tournament];
                            const pairs = tourney.bracket?.playoffPairs || tourney.playoffPairs;
                            if (pairs && Array.isArray(pairs)) {
                                pairs.forEach((stage) => {
                                    if (Array.isArray(stage)) {
                                        stage.forEach((pair) => {
                                            if (pair.gameStatus === 'In Progress' && pair.castle1 && pair.castle2) {
                                                castlesInProgress.add(pair.castle1);
                                                castlesInProgress.add(pair.castle2);
                                            }
                                            if (pair.games && Array.isArray(pair.games)) {
                                                pair.games.forEach((game) => {
                                                    if (
                                                        game.gameStatus === 'In Progress' &&
                                                        game.castle1 &&
                                                        game.castle2
                                                    ) {
                                                        castlesInProgress.add(game.castle1);
                                                        castlesInProgress.add(game.castle2);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        }
                    });
                }

                setInProgressCastles(castlesInProgress);
            } catch (error) {
                console.error('Error fetching in-progress games:', error);
            }
        };

        const load = async () => {
            await Promise.all([fetchCastlesList(), fetchInProgressGames()]);
            setIsLoaded(true);
        };

        load();
    }, []);

    useEffect(() => {
        const loadHotaMeta = async () => {
            try {
                const [summary, factions] = await Promise.all([fetchHotaSummary(), fetchHotaFactions()]);
                setHotaSummary(summary);
                setHotaFactions(
                    factions
                        .filter((faction) => faction?.faction_name)
                        .sort((a, b) => (b.winrate || 0) - (a.winrate || 0))
                );
            } catch (error) {
                console.error('HotA Meta fetch failed:', error);
                setHotaError('HotA Meta data is unavailable right now.');
            } finally {
                setHotaLoaded(true);
            }
        };

        loadHotaMeta();
    }, []);

    const totals = useMemo(() => {
        const games = castles.reduce((sum, castle) => sum + (castle.total || 0), 0);
        const wins = castles.reduce((sum, castle) => sum + (castle.win || 0), 0);
        const losses = castles.reduce((sum, castle) => sum + (castle.lose || 0), 0);
        return { games, wins, losses };
    }, [castles]);

    const loadBounds = useMemo(() => {
        const gameTotals = castles
            .map((castle) => castle.total)
            .filter((total) => typeof total === 'number' && !Number.isNaN(total));
        return {
            max: gameTotals.length ? Math.max(...gameTotals) : 0,
            min: gameTotals.length ? Math.min(...gameTotals) : 0
        };
    }, [castles]);

    const getCastleLoadClass = (total) => {
        if (loadBounds.max === loadBounds.min) {
            return classes.castleLoadMedium;
        }
        if (total === loadBounds.max) {
            return classes.castleLoadHigh;
        }
        if (total === loadBounds.min) {
            return classes.castleLoadLow;
        }
        return classes.castleLoadMedium;
    };

    const getRows = () =>
        castles.map((castle, index) => {
            const castleName = castle?.name || '-';
            const castleTotal = castle?.total ?? '-';
            const castleWin = castle?.win ?? '-';
            const castleLose = castle?.lose ?? '-';
            const winRate = castle?.total > 0 ? ((castle.win / castle.total) * 100).toFixed(1) : '0.0';
            const castleLoadClass = getCastleLoadClass(castle?.total);
            const hasInProgressGame = inProgressCastles.has(castleName);
            const castleImage = getCastleImage(castleName);

            return (
                <tr key={castle.id} className={index < 3 ? classes.topRank : ''}>
                    <td className={classes.rankCol}>{index + 1}</td>
                    <td className={classes.castleCol}>
                        <div className={`${classes.castleCell} ${castleLoadClass}`}>
                            {castleImage && <img src={castleImage} alt={castleName} className={classes.castleThumb} />}
                            <span className={classes.castleName}>{castleName}</span>
                            {hasInProgressGame && (
                                <span
                                    className={classes.liveDot}
                                    title="Game in progress — total includes ongoing matches"
                                />
                            )}
                        </div>
                    </td>
                    <td className={classes.numCol}>{castleTotal}</td>
                    <td className={`${classes.numCol} ${classes.winCol}`}>{castleWin}</td>
                    <td className={`${classes.numCol} ${classes.loseCol}`}>{castleLose}</td>
                    <td className={classes.rateCol}>
                        <span className={classes.rateValue}>{winRate}%</span>
                        <div className={classes.rateBar}>
                            <div
                                className={classes.rateBarFill}
                                style={{ width: `${Math.min(Number(winRate), 100)}%` }}
                            />
                        </div>
                    </td>
                </tr>
            );
        });

    return (
        <div className={classes.page}>
            <h1 className={classes.pageTitle}>Castle Statistics</h1>
            <p className={classes.pageSubtitle}>
                Primary faction win rates from HotA ranked meta. Konoplay cup stats are shown separately below.{' '}
                <Link to="/games/homm3">Back to games</Link>
            </p>

            <section className={classes.section}>
                <div className={classes.sectionHeader}>
                    <div>
                        <h2 className={classes.sectionTitle}>HotA ranked meta</h2>
                        <p className={classes.sectionNote}>
                            Primary source — global faction stats from{' '}
                            <a
                                href="https://hotameta.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={classes.externalLink}
                            >
                                hotameta.com
                            </a>
                            . Bulwark maps to Kronverk on konoplay.
                        </p>
                    </div>
                </div>

                {!hotaLoaded ? (
                    <p className={classes.loading}>Loading HotA Meta...</p>
                ) : hotaError ? (
                    <p className={classes.hotaError}>{hotaError}</p>
                ) : (
                    <>
                        {hotaSummary && (
                            <div className={classes.summaryGrid}>
                                <div className={classes.summaryCard}>
                                    <span className={classes.summaryLabel}>Factions</span>
                                    <span className={classes.summaryValue}>{hotaFactions.length}</span>
                                </div>
                                <div className={classes.summaryCard}>
                                    <span className={classes.summaryLabel}>Ranked matches</span>
                                    <span className={classes.summaryValue}>
                                        {hotaSummary.total_matches?.toLocaleString()}
                                    </span>
                                </div>
                                <div className={classes.summaryCard}>
                                    <span className={classes.summaryLabel}>Unique players</span>
                                    <span className={classes.summaryValue}>
                                        {hotaSummary.total_players?.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className={classes.tableWrapper}>
                            <table className={classes.dataTable}>
                                <thead>
                                    <tr>
                                        <th className={classes.rankCol}>Rank</th>
                                        <th>Faction</th>
                                        <th className={classes.numCol}>Ranked games</th>
                                        <th className={classes.numCol}>Pick rate</th>
                                        <th>Win rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hotaFactions.map((faction, index) => {
                                        const mapping = HOTA_FACTIONS.find((entry) => entry.id === faction.faction_id);
                                        const konoplayName = mapping?.konoplayName || faction.faction_name;
                                        const hotaRate = faction.winrate?.toFixed(1) ?? '0.0';
                                        const castleImage = getCastleImage(konoplayName);

                                        return (
                                            <tr key={faction.faction_id} className={index < 3 ? classes.topRank : ''}>
                                                <td className={classes.rankCol}>{index + 1}</td>
                                                <td className={classes.castleCol}>
                                                    <div className={classes.castleCell}>
                                                        {castleImage && (
                                                            <img
                                                                src={castleImage}
                                                                alt={faction.faction_name}
                                                                className={classes.castleThumb}
                                                            />
                                                        )}
                                                        <span className={classes.castleName}>
                                                            {faction.faction_name}
                                                            {konoplayName !== faction.faction_name && (
                                                                <span className={classes.alias}> ({konoplayName})</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className={classes.numCol}>{faction.games?.toLocaleString()}</td>
                                                <td className={classes.numCol}>{faction.pick_rate?.toFixed(1)}%</td>
                                                <td className={classes.rateCol}>
                                                    <span className={classes.rateValue}>{hotaRate}%</span>
                                                    <div className={classes.rateBar}>
                                                        <div
                                                            className={classes.rateBarFill}
                                                            style={{
                                                                width: `${Math.min(Number(hotaRate), 100)}%`
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>

            <section className={classes.section}>
                <h2 className={classes.sectionTitle}>Konoplay cups</h2>
                <p className={classes.sectionNote}>
                    Supplemental — win rates from tournaments and reported games on this site only.
                </p>

                <div className={classes.toolbar}>
                    <div className={classes.summaryGrid}>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Castles</span>
                            <span className={classes.summaryValue}>{castles.length}</span>
                        </div>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Cup games</span>
                            <span className={classes.summaryValue}>{totals.games}</span>
                        </div>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Wins</span>
                            <span className={classes.summaryValue}>{totals.wins}</span>
                        </div>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Losses</span>
                            <span className={classes.summaryValue}>{totals.losses}</span>
                        </div>
                    </div>

                    <div className={classes.legend}>
                        <span className={classes.legendItem}>
                            <span className={`${classes.legendDot} ${classes.legendDotHigh}`} />
                            Most played
                        </span>
                        <span className={classes.legendItem}>
                            <span className={`${classes.legendDot} ${classes.legendDotMedium}`} />
                            Average
                        </span>
                        <span className={classes.legendItem}>
                            <span className={`${classes.legendDot} ${classes.legendDotLow}`} />
                            Least played
                        </span>
                        <span className={classes.legendItem}>
                            <span className={classes.legendLive} />
                            Live match
                        </span>
                    </div>
                </div>

                {!isLoaded ? (
                    <p className={classes.loading}>Loading castle statistics...</p>
                ) : (
                    <div className={classes.tableWrapper}>
                        <table className={classes.dataTable}>
                            <thead>
                                <tr>
                                    <th className={classes.rankCol}>Rank</th>
                                    <th>Castle</th>
                                    <th className={classes.numCol}>Total</th>
                                    <th className={classes.numCol}>Wins</th>
                                    <th className={classes.numCol}>Losses</th>
                                    <th>Win rate</th>
                                </tr>
                            </thead>
                            <tbody>{getRows()}</tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
};

export default Heroes3Stats;
