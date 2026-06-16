import { useEffect, useMemo, useState } from 'react';
import {
    deriveHotaTradeStats,
    fetchHotaPlayerByLobbyNickname,
    fetchHotaPlayerMatches,
    getHotaPlayerUrl,
    HOTA_FACTIONS
} from '../../api/hotaMeta';
import classes from './HotaPlayerStats.module.css';

const formatFactionLabel = (factionName) => {
    const mapping = HOTA_FACTIONS.find((entry) => entry.name === factionName);
    if (mapping && mapping.konoplayName !== factionName) {
        return `${factionName} (${mapping.konoplayName})`;
    }
    return factionName;
};

const formatMatchDate = (iso) => {
    if (!iso) {
        return '—';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return iso;
    }
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getPickRate = (games, totalGames) => {
    if (!totalGames) {
        return '0.0';
    }
    return ((games / totalGames) * 100).toFixed(1);
};

const HotaPlayerStats = ({ lobbyNickname, hotaData, isPrimarySource = false }) => {
    const [localState, setLocalState] = useState({ status: 'idle' });
    const [heroFilter, setHeroFilter] = useState('all');
    const [matches, setMatches] = useState([]);
    const [matchesLoading, setMatchesLoading] = useState(false);

    const state = hotaData ?? localState;

    useEffect(() => {
        if (hotaData !== undefined) {
            setMatches(hotaData?.matches || []);
            return;
        }

        if (!lobbyNickname?.trim()) {
            setLocalState({ status: 'idle' });
            setMatches([]);
            setHeroFilter('all');
            return;
        }

        let cancelled = false;
        setLocalState({ status: 'loading' });
        setHeroFilter('all');

        fetchHotaPlayerByLobbyNickname(lobbyNickname)
            .then((result) => {
                if (cancelled) {
                    return;
                }
                setLocalState(result);
                setMatches(result.matches || []);
            })
            .catch(() => {
                if (!cancelled) {
                    setLocalState({ status: 'error' });
                    setMatches([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [lobbyNickname, hotaData]);

    useEffect(() => {
        if (state.status !== 'ok' || !state.playerId) {
            return;
        }

        let cancelled = false;
        setMatchesLoading(true);

        fetchHotaPlayerMatches(state.playerId, {
            limit: 50,
            heroId: heroFilter === 'all' ? null : Number(heroFilter)
        })
            .then((rows) => {
                if (!cancelled) {
                    setMatches(rows);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setMatches([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setMatchesLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [heroFilter, state.status, state.playerId]);

    const profile = state.profile;
    const summary = profile?.summary;
    const totalGames = summary?.games || 0;

    const heroOptions = useMemo(() => {
        if (!profile?.hero_stats?.length) {
            return [];
        }
        return [...profile.hero_stats].sort((a, b) => b.games - a.games);
    }, [profile?.hero_stats]);

    const tradeStats = useMemo(() => deriveHotaTradeStats(matches, state.playerId), [matches, state.playerId]);

    if (!lobbyNickname?.trim()) {
        return null;
    }

    return (
        <div className={classes.section}>
            <div className={classes.header}>
                <div>
                    <h3 className={classes.title}>
                        {isPrimarySource ? 'Ranked stats (HotA Meta)' : 'HotA ranked profile'}
                    </h3>
                    <p className={classes.note}>
                        {isPrimarySource ? (
                            <>
                                Primary stats source — synced from{' '}
                                <a
                                    href="https://hotameta.com/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={classes.link}
                                >
                                    hotameta.com
                                </a>{' '}
                                by exact lobby nickname. Konoplay sections below are cups-only.
                            </>
                        ) : (
                            <>
                                Ranked stats from{' '}
                                <a
                                    href="https://hotameta.com/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={classes.link}
                                >
                                    hotameta.com
                                </a>{' '}
                                — matched by exact lobby nickname.
                            </>
                        )}
                    </p>
                </div>
            </div>

            {state.status === 'loading' && (
                <p className={classes.message}>Loading HotA Meta data for {lobbyNickname}...</p>
            )}

            {state.status === 'error' && <p className={classes.error}>HotA Meta lookup failed. Try again later.</p>}

            {state.status === 'not_found' && (
                <div className={classes.messageBox}>
                    <p className={classes.message}>
                        No exact HotA Meta match for <strong>{state.query}</strong>.
                    </p>
                    {state.suggestions?.length > 0 && (
                        <div className={classes.suggestions}>
                            <span className={classes.suggestionsLabel}>Similar names:</span>
                            {state.suggestions.map((entry) => (
                                <a
                                    key={entry.player_id}
                                    href={getHotaPlayerUrl(entry.player_id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={classes.suggestionLink}
                                >
                                    {entry.username}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {state.status === 'ok' && profile && (
                <>
                    <div className={classes.summaryGrid}>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Current rating</span>
                            <span className={classes.summaryValue}>{summary?.current_rating ?? '—'}</span>
                        </div>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Peak rating</span>
                            <span className={classes.summaryValue}>{summary?.peak_rating ?? '—'}</span>
                        </div>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Games played</span>
                            <span className={classes.summaryValue}>{summary?.games?.toLocaleString() ?? '—'}</span>
                        </div>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Win rate</span>
                            <span className={classes.summaryValue}>
                                {summary?.winrate != null ? `${summary.winrate}%` : '—'}
                            </span>
                        </div>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Avg duration</span>
                            <span className={classes.summaryValue}>
                                {summary?.avg_duration_min != null ? `${summary.avg_duration_min}m` : '—'}
                            </span>
                        </div>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Best win streak</span>
                            <span className={classes.summaryValue}>{profile.streaks?.best_win_streak ?? '—'}</span>
                        </div>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Worst loss streak</span>
                            <span className={classes.summaryValue}>{profile.streaks?.worst_loss_streak ?? '—'}</span>
                        </div>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Biggest rating swing</span>
                            <span className={classes.summaryValue}>
                                {summary?.biggest_gain != null ? `+${summary.biggest_gain}` : '—'} /{' '}
                                {summary?.biggest_loss ?? '—'}
                            </span>
                        </div>
                    </div>

                    {profile.streaks?.recent?.length > 0 && (
                        <div className={classes.subsection}>
                            <h4 className={classes.subsectionTitle}>Current form</h4>
                            <p className={classes.subsectionNote}>Last {profile.streaks.recent.length} ranked games</p>
                            <div className={classes.formRow}>
                                {profile.streaks.recent.map((won, index) => (
                                    <span
                                        key={index}
                                        className={`${classes.formDot} ${won ? classes.formWin : classes.formLoss}`}
                                        title={won ? 'Win' : 'Loss'}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {(profile.color_stats || tradeStats) && (
                        <div className={classes.subsection}>
                            <h4 className={classes.subsectionTitle}>Colors &amp; gold trade</h4>
                            {tradeStats && (
                                <div className={classes.tradeSummary}>
                                    <span className={classes.tradeLabel}>Avg gold trade</span>
                                    <span
                                        className={`${classes.tradeValue} ${
                                            tradeStats.averageTrade >= 0 ? classes.tradePositive : classes.tradeNegative
                                        }`}
                                    >
                                        {tradeStats.averageTrade >= 0 ? '+' : ''}
                                        {Math.round(tradeStats.averageTrade).toLocaleString()}
                                    </span>
                                    <span className={classes.tradeHint}>
                                        from last {tradeStats.games} ranked matches
                                    </span>
                                </div>
                            )}
                            {profile.color_stats && (
                                <div className={classes.colorGrid}>
                                    {Object.entries(profile.color_stats).map(([color, stats]) => (
                                        <div key={color} className={classes.colorCard}>
                                            <span className={classes.colorName}>{color}</span>
                                            <span className={classes.colorRate}>{stats.winrate?.toFixed(1)}%</span>
                                            <span className={classes.colorGames}>{stats.games} games</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {profile.faction_stats?.length > 0 && (
                        <div className={classes.subsection}>
                            <h4 className={classes.subsectionTitle}>Faction performance</h4>
                            <div className={classes.tableWrap}>
                                <table className={classes.table}>
                                    <thead>
                                        <tr>
                                            <th>Faction</th>
                                            <th>Games</th>
                                            <th>Wins</th>
                                            <th>Win rate</th>
                                            <th>Pick rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...profile.faction_stats]
                                            .sort((a, b) => b.games - a.games)
                                            .map((faction) => (
                                                <tr key={faction.faction_name}>
                                                    <td>{formatFactionLabel(faction.faction_name)}</td>
                                                    <td>{faction.games}</td>
                                                    <td>{faction.wins}</td>
                                                    <td>{faction.winrate?.toFixed(1)}%</td>
                                                    <td>{getPickRate(faction.games, totalGames)}%</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {profile.vs_faction_stats?.length > 0 && (
                        <div className={classes.subsection}>
                            <h4 className={classes.subsectionTitle}>Results vs factions</h4>
                            <div className={classes.tableWrap}>
                                <table className={classes.table}>
                                    <thead>
                                        <tr>
                                            <th>Opponent faction</th>
                                            <th>Games</th>
                                            <th>Wins</th>
                                            <th>Win rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...profile.vs_faction_stats]
                                            .sort((a, b) => b.games - a.games)
                                            .map((row) => (
                                                <tr key={row.faction_name}>
                                                    <td>{formatFactionLabel(row.faction_name)}</td>
                                                    <td>{row.games}</td>
                                                    <td>{row.wins}</td>
                                                    <td>{row.winrate?.toFixed(1)}%</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {heroOptions.length > 0 && (
                        <div className={classes.subsection}>
                            <h4 className={classes.subsectionTitle}>Hero picks</h4>
                            <div className={classes.tableWrap}>
                                <table className={classes.table}>
                                    <thead>
                                        <tr>
                                            <th>Hero</th>
                                            <th>Faction</th>
                                            <th>Games</th>
                                            <th>Wins</th>
                                            <th>Win rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {heroOptions.slice(0, 15).map((hero) => (
                                            <tr key={`${hero.hero_id}-${hero.hero_name}`}>
                                                <td>{hero.hero_name}</td>
                                                <td>{formatFactionLabel(hero.faction_name)}</td>
                                                <td>{hero.games}</td>
                                                <td>{hero.wins}</td>
                                                <td>{hero.winrate?.toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {profile.template_stats?.length > 0 && (
                        <div className={classes.subsection}>
                            <h4 className={classes.subsectionTitle}>Most played templates</h4>
                            <div className={classes.tableWrap}>
                                <table className={classes.table}>
                                    <thead>
                                        <tr>
                                            <th>Template</th>
                                            <th>Family</th>
                                            <th>Games</th>
                                            <th>Wins</th>
                                            <th>Win rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...profile.template_stats]
                                            .sort((a, b) => b.games - a.games)
                                            .slice(0, 10)
                                            .map((template) => (
                                                <tr key={`${template.template_id}-${template.name}`}>
                                                    <td>{template.name}</td>
                                                    <td>{template.family_name}</td>
                                                    <td>{template.games}</td>
                                                    <td>{template.wins}</td>
                                                    <td>{template.winrate?.toFixed(1)}%</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {profile.opponents?.length > 0 && (
                        <div className={classes.subsection}>
                            <h4 className={classes.subsectionTitle}>Most played opponents</h4>
                            <div className={classes.tableWrap}>
                                <table className={classes.table}>
                                    <thead>
                                        <tr>
                                            <th>Opponent</th>
                                            <th>Games</th>
                                            <th>Wins</th>
                                            <th>Win rate</th>
                                            <th>Net Elo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...profile.opponents]
                                            .sort((a, b) => b.games - a.games)
                                            .slice(0, 12)
                                            .map((opp) => (
                                                <tr key={opp.opp_id}>
                                                    <td>{opp.opp_name}</td>
                                                    <td>{opp.games}</td>
                                                    <td>{opp.wins}</td>
                                                    <td>{opp.winrate?.toFixed(1)}%</td>
                                                    <td
                                                        className={
                                                            opp.net_elo >= 0 ? classes.positive : classes.negative
                                                        }
                                                    >
                                                        {opp.net_elo > 0 ? `+${opp.net_elo}` : opp.net_elo}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className={classes.subsection}>
                        <div className={classes.matchesHeader}>
                            <div>
                                <h4 className={classes.subsectionTitle}>Recent ranked matches</h4>
                                <p className={classes.subsectionNote}>Latest up to 50 games from HotA Meta</p>
                            </div>
                            {heroOptions.length > 0 && (
                                <label className={classes.filterLabel}>
                                    Hero filter
                                    <select
                                        className={classes.filterSelect}
                                        value={heroFilter}
                                        onChange={(event) => setHeroFilter(event.target.value)}
                                    >
                                        <option value="all">All heroes</option>
                                        {heroOptions.map((hero) => (
                                            <option key={hero.hero_id} value={hero.hero_id}>
                                                {hero.hero_name} ({hero.games})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                        </div>

                        {matchesLoading ? (
                            <p className={classes.message}>Loading matches...</p>
                        ) : matches.length === 0 ? (
                            <p className={classes.message}>No matches found for this filter.</p>
                        ) : (
                            <div className={classes.tableWrap}>
                                <table className={`${classes.table} ${classes.matchesTable}`}>
                                    <thead>
                                        <tr>
                                            <th>Result</th>
                                            <th>My faction</th>
                                            <th>Hero</th>
                                            <th>vs</th>
                                            <th>Opponent</th>
                                            <th>Map</th>
                                            <th>Trade</th>
                                            <th>Rating</th>
                                            <th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matches.map((match) => {
                                            const isP2 = match.side === 'p2';
                                            const myFaction = isP2 ? match.p2_faction_name : match.p1_faction_name;
                                            const myHero = isP2 ? match.p2_hero_name : match.p1_hero_name;
                                            const opponent = isP2 ? match.p1_name : match.p2_name;
                                            const trade = isP2 ? match.p2_trade : match.p1_trade;
                                            const postRating = isP2 ? match.p2_post_rating : match.p1_post_rating;

                                            return (
                                                <tr key={match.match_id}>
                                                    <td
                                                        className={
                                                            match.result === 'win' ? classes.positive : classes.negative
                                                        }
                                                    >
                                                        {match.elo_delta > 0 ? `+${match.elo_delta}` : match.elo_delta}
                                                    </td>
                                                    <td>{formatFactionLabel(myFaction)}</td>
                                                    <td>{myHero}</td>
                                                    <td className={classes.vsCell}>vs</td>
                                                    <td>{opponent}</td>
                                                    <td>{match.map_name}</td>
                                                    <td>{trade > 0 ? `+${trade}` : (trade ?? '—')}</td>
                                                    <td>{postRating}</td>
                                                    <td>{formatMatchDate(match.start_time_iso)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <a
                        href={getHotaPlayerUrl(state.playerId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={classes.profileLink}
                    >
                        Open full HotA profile for {state.username} (filters, AI coach, rating chart)
                    </a>
                </>
            )}
        </div>
    );
};

export default HotaPlayerStats;
