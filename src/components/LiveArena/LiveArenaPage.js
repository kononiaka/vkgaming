import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MatchAnnouncementCard from '../MatchAnnouncement/MatchAnnouncementCard';
import { fetchTwitchLiveLogins } from '../../api/twitchStreams';
import { fetchMatchCenterMatches } from '../../utils/matchCenterData';
import { getTournamentMatchLink } from '../../utils/tournamentBracketNavigation';
import { getTwitchWatchUrl, pickMatchStreamLogin } from '../../utils/twitchUtils';
import PrizePoolPanel from '../PrizePoolPanel/PrizePoolPanel';
import TwitchEmbed from './TwitchEmbed';
import LiveArenaMatchRow from './LiveArenaMatchRow';
import classes from './LiveArenaPage.module.css';
import castleImg from '../../image/castles/castle.jpeg';
import rampartImg from '../../image/castles/rampart.jpeg';
import towerImg from '../../image/castles/tower.jpeg';
import infernoImg from '../../image/castles/inferno.jpeg';
import necropolisImg from '../../image/castles/necropolis.jpeg';
import dungeonImg from '../../image/castles/dungeon.jpeg';
import strongholdImg from '../../image/castles/stronghold.jpeg';
import fortressImg from '../../image/castles/fortress.jpeg';
import confluxImg from '../../image/castles/conflux.jpeg';
import coveImg from '../../image/castles/cove.jpeg';
import factoryImg from '../../image/castles/factory.jpeg';
import kronverkImg from '../../image/castles/kronverk.jpeg';

const getCastleImage = (castleName) => {
    const normalizedName = String(castleName || '')
        .split('-')[0]
        .trim()
        .toLowerCase();

    const castleImageMap = {
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

    return castleImageMap[normalizedName] || null;
};

const LiveArenaPage = () => {
    const [liveGames, setLiveGames] = useState([]);
    const [upcomingMatches, setUpcomingMatches] = useState([]);
    const [liveLogins, setLiveLogins] = useState(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            try {
                const { liveGames: live, upcomingMatches: upcoming } = await fetchMatchCenterMatches();
                if (cancelled) {
                    return;
                }

                setLiveGames(live);
                setUpcomingMatches(upcoming);

                const logins = [...live, ...upcoming].flatMap((match) => [
                    match.commentatorStreamLogin,
                    match.streamLogin,
                    match.team1TwitchLogin,
                    match.team2TwitchLogin
                ]);
                const liveSet = await fetchTwitchLiveLogins(logins);
                if (!cancelled) {
                    setLiveLogins(liveSet);
                }
            } catch (error) {
                console.error('Failed to load Live Arena:', error);
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
    }, []);

    const featuredMatch = useMemo(() => {
        const onAirLive = liveGames.find((match) => {
            const login = pickMatchStreamLogin(match, liveLogins);
            return login && liveLogins.has(login);
        });
        if (onAirLive) {
            return onAirLive;
        }
        return liveGames[0] || null;
    }, [liveGames, liveLogins]);

    const featuredChannel = featuredMatch ? pickMatchStreamLogin(featuredMatch, liveLogins) : null;
    const broadcastMatches = useMemo(() => {
        const merged = [...liveGames, ...upcomingMatches];
        return merged.filter((match) => pickMatchStreamLogin(match, liveLogins));
    }, [liveGames, upcomingMatches, liveLogins]);

    const onAirMatches = useMemo(
        () =>
            broadcastMatches.filter((match) => {
                const login = pickMatchStreamLogin(match, liveLogins);
                return login && liveLogins.has(login);
            }),
        [broadcastMatches, liveLogins]
    );

    const getBracketLink = getTournamentMatchLink;

    return (
        <section className={classes.page}>
            <header className={classes.header}>
                <div>
                    <h1 className={classes.title}>Live Arena</h1>
                    <p className={classes.subtitle}>
                        Cup fixtures, live maps, and Twitch broadcasts — like h3 ladder match hub.
                    </p>
                </div>
                <Link to="/tournaments/homm3?status=started" className={classes.viewAllLink}>
                    All tournaments
                </Link>
            </header>

            {loading ? (
                <p className={classes.loading}>Loading fixtures and streams…</p>
            ) : (
                <>
                    <div className={classes.prizePoolRow}>
                        <PrizePoolPanel />
                    </div>

                    <div className={classes.featuredBlock}>
                        {featuredChannel ? (
                            <TwitchEmbed
                                channel={featuredChannel}
                                title={`${featuredMatch?.team1} vs ${featuredMatch?.team2}`}
                            />
                        ) : (
                            <div className={classes.embedPlaceholder}>
                                <p className={classes.embedPlaceholderTitle}>No Twitch broadcast detected</p>
                                <p className={classes.embedPlaceholderText}>
                                    When a registered player goes live on Twitch during a cup match, their stream
                                    appears here. Link your Twitch account via sign-in to enable Watch buttons.
                                </p>
                            </div>
                        )}

                        {featuredMatch && (
                            <div className={classes.featuredCardWrap}>
                                <MatchAnnouncementCard
                                    to={getBracketLink(featuredMatch)}
                                    team1={featuredMatch.team1}
                                    team2={featuredMatch.team2}
                                    team1Avatar={featuredMatch.team1Avatar}
                                    team2Avatar={featuredMatch.team2Avatar}
                                    team1CountryCode={featuredMatch.team1CountryCode}
                                    team2CountryCode={featuredMatch.team2CountryCode}
                                    score1={featuredMatch.score1}
                                    score2={featuredMatch.score2}
                                    tournamentName={featuredMatch.tournamentName}
                                    stageLabel={featuredMatch.stageLabel}
                                    tournamentDate={featuredMatch.scheduledAt || featuredMatch.tournamentDate}
                                    variant={featuredMatch.variant || 'live'}
                                    type={featuredMatch.type}
                                    featured
                                    compact
                                    gameNumber={featuredMatch.gameNumber}
                                    team1Stars={featuredMatch.team1Stars}
                                    team2Stars={featuredMatch.team2Stars}
                                    castle1Image={getCastleImage(featuredMatch.castle1)}
                                    castle2Image={getCastleImage(featuredMatch.castle2)}
                                    watchUrl={getTwitchWatchUrl(featuredChannel)}
                                    streamLive={Boolean(featuredChannel && liveLogins.has(featuredChannel))}
                                />
                            </div>
                        )}
                    </div>

                    <div className={classes.section}>
                        <h2 className={classes.sectionTitle}>On air now</h2>
                        {onAirMatches.length === 0 ? (
                            <p className={classes.empty}>
                                No Twitch streams online for current fixtures. Maps may still be live in bracket.
                            </p>
                        ) : (
                            <div className={classes.matchList}>
                                {onAirMatches.map((match) => (
                                    <LiveArenaMatchRow
                                        key={`on-air-${match.tournamentId}-${match.stageIndex}-${match.pairIndex}`}
                                        match={match}
                                        liveLogins={liveLogins}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={classes.section}>
                        <h2 className={classes.sectionTitle}>Live maps</h2>
                        {liveGames.length === 0 ? (
                            <p className={classes.empty}>No maps in progress right now.</p>
                        ) : (
                            <div className={classes.matchList}>
                                {liveGames.map((match) => (
                                    <LiveArenaMatchRow
                                        key={`live-map-${match.tournamentId}-${match.stageIndex}-${match.pairIndex}-${match.gameNumber || 0}`}
                                        match={match}
                                        liveLogins={liveLogins}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={classes.section}>
                        <h2 className={classes.sectionTitle}>Upcoming fixtures</h2>
                        {upcomingMatches.length === 0 ? (
                            <p className={classes.empty}>No scheduled bracket matches in active cups.</p>
                        ) : (
                            <div className={classes.matchList}>
                                {upcomingMatches.map((match) => (
                                    <LiveArenaMatchRow
                                        key={`upcoming-${match.tournamentId}-${match.stageIndex}-${match.pairIndex}`}
                                        match={match}
                                        liveLogins={liveLogins}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    );
};

export default LiveArenaPage;
