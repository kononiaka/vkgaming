import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    HeadToHeadStatsButton,
    HeadToHeadStatsPortal
} from '../HeadToHead/HeadToHeadStatsButton';
import TwitchEmbed from '../LiveArena/TwitchEmbed';
import { fetchTwitchLiveLogins } from '../../api/twitchStreams';
import { useHeadToHeadStats } from '../../hooks/useHeadToHeadStats';
import { fetchMatchCenterMatch } from '../../utils/matchCenterData';
import { parseMatchCenterParams } from '../../utils/matchCenterRoute';
import { getTournamentMatchLink } from '../../utils/tournamentBracketNavigation';
import { extractTwitchLogin, getTwitchWatchUrl } from '../../utils/twitchUtils';
import classes from './MatchCenterPage.module.css';

const VIEW_MODES = {
    TEAM1: 'team1',
    TEAM2: 'team2',
    MULTI: 'multistream'
};

const StreamPanel = ({ playerName, twitchLogin, isLive }) => {
    const channelUrl = getTwitchWatchUrl(twitchLogin);

    return (
        <div className={classes.streamPanel}>
            <div className={classes.streamPanelHeader}>
                <div className={classes.streamPanelMeta}>
                    <span className={classes.twitchTag}>Twitch</span>
                    <span className={classes.streamPlayerName}>{playerName}</span>
                    <span className={`${classes.streamStatus} ${isLive ? classes.streamStatusLive : ''}`}>
                        {isLive ? 'Live' : 'Offline'}
                    </span>
                </div>
                {channelUrl && (
                    <a
                        href={channelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={classes.channelLink}
                    >
                        Twitch channel
                    </a>
                )}
            </div>
            <div className={classes.streamPanelBody}>
                {twitchLogin ? (
                    <TwitchEmbed channel={twitchLogin} title={`${playerName} stream`} />
                ) : (
                    <div className={classes.streamPlaceholder}>
                        <p className={classes.streamPlaceholderTitle}>No Twitch linked</p>
                        <p className={classes.streamPlaceholderText}>
                            This player has not linked a Twitch account yet.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

const MatchCenterPage = () => {
    const params = useParams();
    const { tournamentId, stageIndex, pairIndex } = parseMatchCenterParams(
        params.tournamentId,
        params.stageIndex,
        params.pairIndex
    );
    const stageRef = useRef(null);

    const [match, setMatch] = useState(null);
    const [liveLogins, setLiveLogins] = useState(new Set());
    const [viewMode, setViewMode] = useState(VIEW_MODES.MULTI);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const {
        stats,
        loading: statsLoading,
        open: statsOpen,
        showHeadToHeadStats,
        closeHeadToHeadStats
    } = useHeadToHeadStats();

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setNotFound(false);

            try {
                const result = await fetchMatchCenterMatch(tournamentId, stageIndex, pairIndex);
                if (cancelled) {
                    return;
                }

                if (!result?.match) {
                    setMatch(null);
                    setNotFound(true);
                    return;
                }

                setMatch(result.match);

                const logins = [
                    result.match.commentatorStreamLogin,
                    result.match.streamLogin,
                    result.match.team1TwitchLogin,
                    result.match.team2TwitchLogin
                ];
                const liveSet = await fetchTwitchLiveLogins(logins);
                if (!cancelled) {
                    setLiveLogins(liveSet);
                }
            } catch (error) {
                console.error('Failed to load match center:', error);
                if (!cancelled) {
                    setNotFound(true);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();
        const interval = setInterval(load, 120000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [tournamentId, stageIndex, pairIndex]);

    const team1Login = extractTwitchLogin(match?.team1TwitchLogin);
    const team2Login = extractTwitchLogin(match?.team2TwitchLogin);
    const team1Live = Boolean(team1Login && liveLogins.has(team1Login));
    const team2Live = Boolean(team2Login && liveLogins.has(team2Login));
    const bracketLink = match ? getTournamentMatchLink(match) : '/tournaments/homm3?status=started';

    const tabs = useMemo(
        () => [
            { id: VIEW_MODES.TEAM1, label: match ? `Only ${match.team1}` : 'Player 1' },
            { id: VIEW_MODES.TEAM2, label: match ? `Only ${match.team2}` : 'Player 2' },
            { id: VIEW_MODES.MULTI, label: 'Multistream' }
        ],
        [match]
    );

    const enterFullscreen = useCallback(() => {
        const node = stageRef.current;
        if (!node) {
            return;
        }

        if (node.requestFullscreen) {
            node.requestFullscreen();
        } else if (node.webkitRequestFullscreen) {
            node.webkitRequestFullscreen();
        }
    }, []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
                return;
            }

            if (event.key === '1') {
                setViewMode(VIEW_MODES.TEAM1);
            } else if (event.key === '2') {
                setViewMode(VIEW_MODES.TEAM2);
            } else if (event.key === '3') {
                setViewMode(VIEW_MODES.MULTI);
            } else if (event.key.toLowerCase() === 'f') {
                event.preventDefault();
                enterFullscreen();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enterFullscreen]);

    if (loading) {
        return (
            <section className={classes.page}>
                <p className={classes.loading}>Loading match center…</p>
            </section>
        );
    }

    if (notFound || !match) {
        return (
            <section className={classes.page}>
                <p className={classes.empty}>Match not found.</p>
                <Link to="/live" className={classes.backLink}>
                    Back to Live Arena
                </Link>
            </section>
        );
    }

    return (
        <section className={classes.page}>
            <header className={classes.header}>
                <div>
                    <p className={classes.eyebrow}>Match center</p>
                    <h1 className={classes.title}>
                        {match.team1} <span className={classes.vs}>vs</span> {match.team2}
                    </h1>
                    <p className={classes.subtitle}>
                        {match.tournamentName} · {match.stageLabel}
                        {match.variant === 'live' ? ` · ${match.score1}:${match.score2}` : ''}
                    </p>
                </div>
                <div className={classes.headerActions}>
                    <HeadToHeadStatsButton
                        team1={match.team1}
                        team2={match.team2}
                        onShow={showHeadToHeadStats}
                        variant="text"
                    />
                    <Link to={bracketLink} className={classes.bracketLink}>
                        Match page
                    </Link>
                    <Link to="/live" className={classes.backLink}>
                        Live Arena
                    </Link>
                </div>
            </header>

            <div className={classes.controls}>
                <div className={classes.controlsLeft}>
                    <span className={classes.controlsLabel}>Watch</span>
                    <div className={classes.tabs} role="tablist" aria-label="Stream view">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={viewMode === tab.id}
                                className={`${classes.tab} ${viewMode === tab.id ? classes.tabActive : ''}`}
                                onClick={() => setViewMode(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
                <button type="button" className={classes.fullscreenBtn} onClick={enterFullscreen}>
                    Fullscreen
                </button>
            </div>

            <div className={classes.helpBox}>
                <p className={classes.helpTitle}>How to use fullscreen mode</p>
                <p className={classes.helpText}>
                    Choose multistream to watch both players side by side, then press Fullscreen. Hotkeys:{' '}
                    <strong>1</strong> player 1 only, <strong>2</strong> player 2 only, <strong>3</strong>{' '}
                    multistream, <strong>F</strong> fullscreen.
                </p>
            </div>

            <div
                ref={stageRef}
                className={`${classes.streamStage} ${
                    viewMode === VIEW_MODES.MULTI ? classes.streamStageMulti : classes.streamStageSingle
                }`}
            >
                {(viewMode === VIEW_MODES.TEAM1 || viewMode === VIEW_MODES.MULTI) && (
                    <StreamPanel
                        playerName={match.team1}
                        twitchLogin={team1Login}
                        isLive={team1Live}
                    />
                )}
                {(viewMode === VIEW_MODES.TEAM2 || viewMode === VIEW_MODES.MULTI) && (
                    <StreamPanel
                        playerName={match.team2}
                        twitchLogin={team2Login}
                        isLive={team2Live}
                    />
                )}
            </div>

            <HeadToHeadStatsPortal
                stats={stats}
                loading={statsLoading}
                open={statsOpen}
                onClose={closeHeadToHeadStats}
            />
        </section>
    );
};

export default MatchCenterPage;
