import { Link } from 'react-router-dom';
import CountryFlag from '../Country/CountryFlag';
import { HeadToHeadStatsButton, HeadToHeadStatsPortal } from '../HeadToHead/HeadToHeadStatsButton';
import StarsComponent from '../Stars/Stars';
import { useHeadToHeadStats } from '../../hooks/useHeadToHeadStats';
import konoplayCrest from '../../image/konoplay-crest.png';
import { buildMatchBannerLabel } from '../../utils/matchFixtureLabels';
import { getTwitchWatchUrl } from '../../utils/twitchUtils';
import { formatMatchSchedule } from '../tournaments/homm3/matchScheduleUtils';
import classes from './MatchAnnouncementCard.module.css';

const TWITCH_ICON_PATH =
    'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z';

const YOUTUBE_ICON_PATH =
    'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z';

const formatAnnounceTime = (iso) => formatMatchSchedule(iso) || 'TBD';

const formatSeriesLabel = (seriesType) => {
    if (seriesType === 'bo-5') {
        return 'BO5';
    }
    if (seriesType === 'bo-3') {
        return 'BO3';
    }
    return 'BO1';
};

const stopCardNav = (event) => {
    event.preventDefault();
    event.stopPropagation();
};

const openExternal = (event, url) => {
    stopCardNav(event);
    if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
};

const PlayerStreamBadges = ({ twitchLogin, youtubeUrl, playerName }) => {
    const twitchUrl = getTwitchWatchUrl(twitchLogin);
    if (!twitchUrl && !youtubeUrl) {
        return null;
    }

    return (
        <div className={classes.streamBadges}>
            {twitchUrl ? (
                <button
                    type="button"
                    className={`${classes.streamBadge} ${classes.streamBadgeTwitch}`}
                    aria-label={`${playerName} on Twitch`}
                    title={`${playerName} on Twitch`}
                    onClick={(event) => openExternal(event, twitchUrl)}
                >
                    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
                        <path d={TWITCH_ICON_PATH} fill="currentColor" />
                    </svg>
                </button>
            ) : null}
            {youtubeUrl ? (
                <button
                    type="button"
                    className={`${classes.streamBadge} ${classes.streamBadgeYoutube}`}
                    aria-label={`${playerName} on YouTube`}
                    title={`${playerName} on YouTube`}
                    onClick={(event) => openExternal(event, youtubeUrl)}
                >
                    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
                        <path d={YOUTUBE_ICON_PATH} fill="currentColor" />
                    </svg>
                </button>
            ) : null}
        </div>
    );
};

const PlayerPortrait = ({ avatar, name, stars = 0 }) => {
    const portrait = avatar ? (
        <img src={avatar} alt={name} className={classes.portraitImage} />
    ) : (
        <div className={classes.portraitFallback} aria-hidden="true">
            {String(name || '?')
                .charAt(0)
                .toUpperCase()}
        </div>
    );

    return (
        <div className={classes.portraitWrap}>
            {portrait}
            {stars > 0 && (
                <div className={classes.starsOnPortrait}>
                    <StarsComponent stars={stars} />
                </div>
            )}
        </div>
    );
};

const MatchAnnouncementCard = ({
    to,
    team1,
    team2,
    team1Avatar = null,
    team2Avatar = null,
    team1CountryCode = null,
    team2CountryCode = null,
    score1 = 0,
    score2 = 0,
    tournamentName,
    tournamentType = null,
    stageLabel,
    tournamentDate = null,
    variant = 'upcoming',
    statusLabel: _statusLabel = 'Upcoming',
    type = 'bo-3',
    featured = false,
    castle1Image = null,
    castle2Image = null,
    gameNumber: _gameNumber = null,
    team1Stars = 0,
    team2Stars = 0,
    team1Prediction = null,
    team2Prediction = null,
    team1TwitchLogin = null,
    team2TwitchLogin = null,
    team1YoutubeUrl = null,
    team2YoutubeUrl = null,
    matchCenterUrl = null,
    watchUrl = null,
    streamLive = false,
    compact = false,
    playoffPairs = []
}) => {
    const {
        stats,
        loading: statsLoading,
        open: statsOpen,
        showHeadToHeadStats,
        closeHeadToHeadStats
    } = useHeadToHeadStats({ playoffPairs });

    const castlesSelected = Boolean(castle1Image && castle2Image);
    const showMapBackground = variant === 'live' && castlesSelected;

    const bannerLabel = buildMatchBannerLabel({
        tournamentName,
        tournamentType,
        stageLabel
    }).toUpperCase();

    const dateLabel = bannerLabel;
    const timeLabel = variant === 'live' ? `${score1} : ${score2}` : formatAnnounceTime(tournamentDate);
    const showPrediction = team1Prediction != null && team2Prediction != null;

    const isUpcoming = variant === 'upcoming';

    const renderPlayerSide = (side) => {
        const isLeft = side === 'left';
        const name = isLeft ? team1 : team2;
        const avatar = isLeft ? team1Avatar : team2Avatar;
        const countryCode = isLeft ? team1CountryCode : team2CountryCode;
        const stars = isLeft ? team1Stars : team2Stars;
        const twitchLogin = isLeft ? team1TwitchLogin : team2TwitchLogin;
        const youtubeUrl = isLeft ? team1YoutubeUrl : team2YoutubeUrl;
        const hasStreamLinks = Boolean(getTwitchWatchUrl(twitchLogin) || youtubeUrl);

        return (
            <div className={`${classes.playerCol} ${isLeft ? classes.playerColLeft : classes.playerColRight}`}>
                <div
                    className={`${classes.portraitSlot} ${hasStreamLinks ? classes.portraitSlotWithStreams : ''}`}
                >
                    <PlayerStreamBadges
                        twitchLogin={twitchLogin}
                        youtubeUrl={youtubeUrl}
                        playerName={name}
                    />
                    <PlayerPortrait avatar={avatar} name={name} stars={stars} />
                </div>
                <div className={classes.playerMeta}>
                    {countryCode ? (
                        <span className={classes.playerFlag}>
                            <CountryFlag code={countryCode} size={18} />
                        </span>
                    ) : (
                        <span className={classes.playerFlagSpacer} aria-hidden="true" />
                    )}
                    <span className={classes.playerNameUnder}>{name}</span>
                </div>
            </div>
        );
    };

    const scoreClassName = `${classes.dateBadge} ${classes.timeBadge} ${variant === 'live' ? classes.timeBadgeLive : ''}`;

    const predictionBlock = showPrediction ? (
        <div
            className={classes.predictionEmbed}
            aria-label={`Win prediction ${team1Prediction}% to ${team2Prediction}%`}
        >
            <span className={classes.predictionPct}>{team1Prediction}%</span>
            <span className={classes.predictionLabel}>win odds</span>
            <span className={classes.predictionPct}>{team2Prediction}%</span>
        </div>
    ) : null;

    const watchControl = matchCenterUrl ? (
        <Link to={matchCenterUrl} className={`${classes.watchBtn} ${streamLive ? classes.watchBtnLive : ''}`}>
            {streamLive ? 'Watch live' : 'Watch'}
        </Link>
    ) : watchUrl ? (
        <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${classes.watchBtn} ${streamLive ? classes.watchBtnLive : ''}`}
        >
            {streamLive ? 'Watch live' : 'Watch'}
        </a>
    ) : null;

    return (
        <div className={`${classes.cardShell} ${featured ? classes.featured : ''}`}>
            <div className={classes.cardTopBar}>
                <div className={classes.cardTopBarLeft}>
                    <HeadToHeadStatsButton team1={team1} team2={team2} onShow={showHeadToHeadStats} />
                    {variant === 'live' && <div className={classes.liveBadge}>LIVE</div>}
                </div>
                {watchControl}
            </div>
            <Link
                to={to}
                className={`${classes.card} ${featured ? classes.featured : ''} ${isUpcoming ? classes.upcoming : ''} ${compact ? classes.compact : ''} ${showMapBackground ? classes.withMap : classes.plain}`}
            >
                {showMapBackground ? (
                    <>
                        <div
                            className={classes.backdropSplitLeft}
                            style={{ backgroundImage: `url(${castle1Image})` }}
                            aria-hidden="true"
                        />
                        <div
                            className={classes.backdropSplitRight}
                            style={{ backgroundImage: `url(${castle2Image})` }}
                            aria-hidden="true"
                        />
                        <div className={classes.overlay} aria-hidden="true" />
                    </>
                ) : (
                    <div className={classes.plainBackdrop} aria-hidden="true" />
                )}

                <div className={classes.frame}>
                    <div className={classes.connector} aria-hidden="true" />

                    <div className={`${classes.dateBadge} ${classes.tournamentBadge} ${classes.tournamentBadgeTop}`}>
                        {dateLabel}
                    </div>

                    <div className={classes.matchArena}>
                        {renderPlayerSide('left')}

                        <div className={classes.centerStack}>
                            <div className={classes.centerDiamond}>
                                <img src={konoplayCrest} alt="" className={classes.centerLogo} />
                            </div>
                            {predictionBlock}
                            <div className={classes.centerStackMobile}>
                                <div className={scoreClassName}>{timeLabel}</div>
                                <p className={classes.caption}>
                                    Heroes 3 · <span className={classes.captionSeries}>{formatSeriesLabel(type)}</span>
                                </p>
                            </div>
                        </div>

                        {renderPlayerSide('right')}
                    </div>

                    <div className={classes.matchFooterDesktop}>
                        <div className={scoreClassName}>{timeLabel}</div>
                        <p className={classes.caption}>
                            Heroes 3 · <span className={classes.captionSeries}>{formatSeriesLabel(type)}</span>
                        </p>
                    </div>

                    <div className={`${classes.dateBadge} ${classes.tournamentBadge} ${classes.tournamentBadgeBottom}`}>
                        {dateLabel}
                    </div>
                </div>
            </Link>
            <HeadToHeadStatsPortal
                stats={stats}
                loading={statsLoading}
                open={statsOpen}
                onClose={closeHeadToHeadStats}
            />
        </div>
    );
};

export default MatchAnnouncementCard;
