import { Link } from 'react-router-dom';
import CountryFlag from '../Country/CountryFlag';
import {
    HeadToHeadStatsButton,
    HeadToHeadStatsPortal
} from '../HeadToHead/HeadToHeadStatsButton';
import StarsComponent from '../Stars/Stars';
import { useHeadToHeadStats } from '../../hooks/useHeadToHeadStats';
import konoplayLogo from '../../image/konoplay-logo-new-invert.png';
import { buildMatchBannerLabel } from '../../utils/matchFixtureLabels';
import classes from './MatchAnnouncementCard.module.css';

const formatAnnounceTime = (iso) => {
    if (!iso) {
        return 'TBD';
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return 'TBD';
    }

    return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

const formatSeriesLabel = (seriesType) => {
    if (seriesType === 'bo-5') {
        return 'BO5';
    }
    if (seriesType === 'bo-3') {
        return 'BO3';
    }
    return 'BO1';
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
    statusLabel = 'Upcoming',
    type = 'bo-3',
    featured = false,
    castle1Image = null,
    castle2Image = null,
    gameNumber = null,
    team1Stars = 0,
    team2Stars = 0,
    team1Prediction = null,
    team2Prediction = null,
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

        return (
            <div
                className={`${classes.playerSide} ${classes.playerSideUpcoming} ${isLeft ? '' : classes.playerSideRight}`}
            >
                <PlayerPortrait avatar={avatar} name={name} stars={stars} />
                <div className={classes.playerLabelUnder}>
                    {countryCode ? (
                        <span className={classes.playerFlag}>
                            <CountryFlag code={countryCode} size={18} />
                        </span>
                    ) : null}
                    <span className={classes.playerNameUnder}>{name}</span>
                </div>
            </div>
        );
    };

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
                    <HeadToHeadStatsButton
                        team1={team1}
                        team2={team2}
                        onShow={showHeadToHeadStats}
                    />
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

                    <div className={classes.dateBadge}>{dateLabel}</div>

                    <div className={classes.matchRow}>
                        {renderPlayerSide('left')}

                        <div className={classes.centerBadge}>
                            <div className={classes.centerDiamond}>
                                <img src={konoplayLogo} alt="" className={classes.centerLogo} />
                            </div>
                            {showPrediction && (
                                <div
                                    className={classes.predictionEmbed}
                                    aria-label={`Win prediction ${team1Prediction}% to ${team2Prediction}%`}
                                >
                                    <span className={classes.predictionPct}>{team1Prediction}%</span>
                                    <span className={classes.predictionLabel}>win odds</span>
                                    <span className={classes.predictionPct}>{team2Prediction}%</span>
                                </div>
                            )}
                        </div>

                        {renderPlayerSide('right')}
                    </div>

                    <div
                        className={`${classes.dateBadge} ${classes.timeBadge} ${variant === 'live' ? classes.timeBadgeLive : ''}`}
                    >
                        {timeLabel}
                    </div>

                    <p className={classes.caption}>
                        Heroes 3 · <span className={classes.captionSeries}>{formatSeriesLabel(type)}</span>
                    </p>
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
