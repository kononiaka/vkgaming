import { Link } from 'react-router-dom';
import TournamentMeta from '../TournamentMeta/TournamentMeta';
import {
    buildHubCupMechanics,
    buildHubRestartStats,
    buildTournamentHubSummary,
    collectHubMatches,
    collectHubParticipants,
    DEFAULT_TOURNAMENT_HUB_TAB,
    TOURNAMENT_HUB_TABS
} from '../../../../utils/tournamentHub';
import classes from './TournamentHub.module.css';

const formatSeriesRecord = (player) => {
    if (!player.played) {
        return '—';
    }
    if (player.draws > 0) {
        return `${player.wins}–${player.losses}–${player.draws}`;
    }
    return `${player.wins}–${player.losses}`;
};

const MatchesPanel = ({ tournament }) => {
    const matches = collectHubMatches(tournament);

    if (matches.length === 0) {
        return (
            <p className={classes.empty}>
                No matches on this cup yet. They appear here for every existing tournament once games are scheduled or
                reported — not only new cups.
            </p>
        );
    }

    return (
        <ul className={classes.matchList}>
            {matches.map((match) => {
                const scoreLabel =
                    match.status === 'upcoming' && match.score1 === 0 && match.score2 === 0
                        ? 'vs'
                        : `${match.score1} : ${match.score2}`;
                const mapsLabel = match.maps > 0 ? `${match.maps} map${match.maps === 1 ? '' : 's'}` : null;
                const content = (
                    <>
                        <div className={classes.matchMeta}>
                            {match.status === 'live' ? <span className={classes.liveBadge}>Live</span> : null}
                            {match.stageLabel ? <span className={classes.matchStage}>{match.stageLabel}</span> : null}
                            {match.dateLabel ? <span className={classes.matchDate}>{match.dateLabel}</span> : null}
                        </div>
                        <div className={classes.matchup}>
                            <span
                                className={`${classes.playerName} ${
                                    match.winner === match.team1 ? classes.winnerName : ''
                                }`}
                            >
                                {match.team1}
                            </span>
                            <span className={classes.score}>{scoreLabel}</span>
                            <span
                                className={`${classes.playerName} ${classes.playerNameRight} ${
                                    match.winner === match.team2 ? classes.winnerName : ''
                                }`}
                            >
                                {match.team2}
                            </span>
                        </div>
                        {mapsLabel ? <span className={classes.maps}>{mapsLabel}</span> : null}
                    </>
                );

                return (
                    <li key={match.id}>
                        {match.href ? (
                            <Link to={match.href} className={`${classes.matchRow} ${classes.matchRowLink}`}>
                                {content}
                            </Link>
                        ) : (
                            <div className={classes.matchRow}>{content}</div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};

const ParticipantsPanel = ({ tournament }) => {
    const participants = collectHubParticipants(tournament);

    if (participants.length === 0) {
        return <p className={classes.empty}>No players registered on this cup yet.</p>;
    }

    return (
        <div className={classes.tableWrap}>
            <table className={classes.table}>
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Series</th>
                        <th>Maps</th>
                    </tr>
                </thead>
                <tbody>
                    {participants.map((player) => (
                        <tr key={player.key}>
                            <td>
                                {player.siteUserId ? (
                                    <Link to={`/players/${player.siteUserId}`} className={classes.playerLink}>
                                        {player.name}
                                    </Link>
                                ) : (
                                    player.name
                                )}
                            </td>
                            <td>{formatSeriesRecord(player)}</td>
                            <td>{player.played ? `${player.mapsWon}–${player.mapsLost}` : '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const formatGold = (value) => {
    if (value == null || Number.isNaN(Number(value))) {
        return '—';
    }
    const number = Number(value);
    const rounded = Math.abs(number) >= 10 ? number.toFixed(0) : number.toFixed(1);
    return `${number > 0 ? '+' : ''}${rounded}`;
};

const formatRate = (value) => {
    if (value == null || Number.isNaN(Number(value))) {
        return '—';
    }
    return `${Number(value).toFixed(1)}%`;
};

const StatisticsPanel = ({ tournament }) => {
    const mechanics = buildHubCupMechanics(tournament);

    return (
        <div className={classes.stack}>
            <TournamentMeta tournamentId={tournament?.id} pairs={tournament?.bracket?.playoffPairs || []} compact />
            <section>
                <h3 className={classes.sectionTitle}>Gold and flags</h3>
                {mechanics.maps === 0 ? (
                    <p className={classes.empty}>No reported maps on this cup yet.</p>
                ) : (
                    <div className={classes.summary}>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Avg gold trade</span>
                            <span className={classes.summaryValue}>{formatGold(mechanics.averageGold)}</span>
                        </div>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Red WR</span>
                            <span className={classes.summaryValue}>{formatRate(mechanics.redWinRate)}</span>
                        </div>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Blue WR</span>
                            <span className={classes.summaryValue}>{formatRate(mechanics.blueWinRate)}</span>
                        </div>
                        <div className={classes.summaryCard}>
                            <span className={classes.summaryLabel}>Maps</span>
                            <span className={classes.summaryValue}>{mechanics.colorMaps || mechanics.maps}</span>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};

const RestartsPanel = ({ tournament }) => {
    const { cup, players } = buildHubRestartStats(tournament);

    if (cup.maps === 0) {
        return <p className={classes.empty}>No restart data on this cup yet. It appears after maps are reported.</p>;
    }

    return (
        <div className={classes.stack}>
            <div className={classes.summary}>
                <div className={classes.summaryCard}>
                    <span className={classes.summaryLabel}>Avg coefficient</span>
                    <span className={classes.summaryValue}>{cup.averageCoefficient}</span>
                </div>
                <div className={classes.summaryCard}>
                    <span className={classes.summaryLabel}>No restart</span>
                    <span className={classes.summaryValue}>
                        {cup.mapsNone} · {cup.percentNone}%
                    </span>
                </div>
                <div className={classes.summaryCard}>
                    <span className={classes.summaryLabel}>111 x1</span>
                    <span className={classes.summaryValue}>
                        {cup.maps111x1} · {cup.percent111x1}%
                    </span>
                </div>
                <div className={classes.summaryCard}>
                    <span className={classes.summaryLabel}>111 x2</span>
                    <span className={classes.summaryValue}>
                        {cup.maps111x2} · {cup.percent111x2}%
                    </span>
                </div>
                <div className={classes.summaryCard}>
                    <span className={classes.summaryLabel}>112</span>
                    <span className={classes.summaryValue}>
                        {cup.maps112} · {cup.percent112}%
                    </span>
                </div>
            </div>
            <div className={classes.tableWrap}>
                <table className={classes.table}>
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Avg</th>
                            <th>Maps</th>
                            <th>111</th>
                            <th>112</th>
                        </tr>
                    </thead>
                    <tbody>
                        {players.map((player) => (
                            <tr key={player.key}>
                                <td>
                                    {player.siteUserId ? (
                                        <Link to={`/players/${player.siteUserId}`} className={classes.playerLink}>
                                            {player.name}
                                        </Link>
                                    ) : (
                                        player.name
                                    )}
                                </td>
                                <td>{player.averageCoefficient}</td>
                                <td>{player.maps}</td>
                                <td>{player.total111}</td>
                                <td>{player.total112}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const renderTabPanel = (tabId, tournament, children, summaryItems) => {
    if (tabId === DEFAULT_TOURNAMENT_HUB_TAB) {
        return (
            <>
                {summaryItems.length > 0 && (
                    <div className={classes.summary}>
                        {summaryItems.map((item) => (
                            <div key={item.label} className={classes.summaryCard}>
                                <span className={classes.summaryLabel}>{item.label}</span>
                                <span className={classes.summaryValue}>{item.value}</span>
                            </div>
                        ))}
                    </div>
                )}
                {children}
            </>
        );
    }

    if (tabId === 'matches') {
        return <MatchesPanel tournament={tournament} />;
    }

    if (tabId === 'participants') {
        return <ParticipantsPanel tournament={tournament} />;
    }

    if (tabId === 'statistics') {
        return <StatisticsPanel tournament={tournament} />;
    }

    if (tabId === 'restarts') {
        return <RestartsPanel tournament={tournament} />;
    }

    return null;
};

const TournamentHub = ({ tournament, activeTab = DEFAULT_TOURNAMENT_HUB_TAB, onTabChange, children }) => {
    const tabId = TOURNAMENT_HUB_TABS.some((tab) => tab.id === activeTab) ? activeTab : DEFAULT_TOURNAMENT_HUB_TAB;
    const summaryItems = buildTournamentHubSummary(tournament);

    return (
        <div className={classes.hub}>
            <div className={classes.tabList} role="tablist" aria-label="Cup sections">
                {TOURNAMENT_HUB_TABS.map((tab) => {
                    const selected = tab.id === tabId;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            id={`cup-hub-tab-${tab.id}`}
                            aria-selected={selected}
                            aria-controls={`cup-hub-panel-${tab.id}`}
                            className={`${classes.tab} ${selected ? classes.tabActive : ''}`}
                            onClick={() => onTabChange?.(tab.id)}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {TOURNAMENT_HUB_TABS.map((tab) => {
                const selected = tab.id === tabId;
                const keepMounted = tab.id === DEFAULT_TOURNAMENT_HUB_TAB;
                return (
                    <div
                        key={tab.id}
                        id={`cup-hub-panel-${tab.id}`}
                        role="tabpanel"
                        aria-labelledby={`cup-hub-tab-${tab.id}`}
                        hidden={!selected}
                        className={classes.panel}
                    >
                        {keepMounted || selected ? renderTabPanel(tab.id, tournament, children, summaryItems) : null}
                    </div>
                );
            })}
        </div>
    );
};

export default TournamentHub;
