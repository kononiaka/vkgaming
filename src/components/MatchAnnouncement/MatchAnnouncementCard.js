import { Link } from 'react-router-dom';
import CountryFlag from '../Country/CountryFlag';
import StarsComponent from '../Stars/Stars';
import konoplayLogo from '../../image/konoplay-logo-new-invert.png';
import classes from './MatchAnnouncementCard.module.css';

const formatAnnounceDate = (iso, fallbackLabel) => {
    if (!iso) {
        return fallbackLabel;
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return fallbackLabel;
    }

    return date
        .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
        .toUpperCase();
};

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

const formatSeriesLabel = (type) => {
    if (type === 'bo-5') {
        return 'BO5';
    }
    if (type === 'bo-3') {
        return 'BO3';
    }
    return 'BO1';
};

const PlayerPortrait = ({ avatar, name, stars = 0 }) => {
    const portrait = avatar ? (
        <img src={avatar} alt={name} className={classes.portraitImage} />
    ) : (
        <div className={classes.portraitFallback} aria-hidden="true">
            {String(name || '?').charAt(0).toUpperCase()}
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
    team2Prediction = null
}) => {
    const castlesSelected = Boolean(castle1Image && castle2Image);
    const showMapBackground = variant === 'live' && castlesSelected;

    const dateLabel =
        variant === 'live'
            ? `GAME ${gameNumber || 1} · ${(stageLabel || 'IN PROGRESS').toUpperCase()}`
            : formatAnnounceDate(tournamentDate, (statusLabel || 'UPCOMING').toUpperCase());

    const timeLabel = variant === 'live' ? 'LIVE · 0 : 0' : formatAnnounceTime(tournamentDate);
    const showPrediction = team1Prediction != null && team2Prediction != null;

    const caption = `Heroes 3 PvP | ${team1} vs ${team2} | ${tournamentName}`;
    const isUpcoming = variant === 'upcoming';

    const renderLivePlayerSide = (side) => {
        if (side === 'left') {
            return (
                <div className={classes.playerSide}>
                    <PlayerPortrait avatar={team1Avatar} name={team1} stars={team1Stars} />
                    <div className={classes.playerPanel}>
                        <CountryFlag code={team1CountryCode} size={18} />
                        <span className={classes.playerName}>{team1}</span>
                    </div>
                </div>
            );
        }

        return (
            <div className={`${classes.playerSide} ${classes.playerSideRight}`}>
                <div className={classes.playerPanel}>
                    <span className={classes.playerName}>{team2}</span>
                    <CountryFlag code={team2CountryCode} size={18} />
                </div>
                <PlayerPortrait avatar={team2Avatar} name={team2} stars={team2Stars} />
            </div>
        );
    };

    const renderUpcomingPlayerSide = (side) => {
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
                    {isLeft && <CountryFlag code={countryCode} size={16} />}
                    <span className={classes.playerNameUnder}>{name}</span>
                    {!isLeft && <CountryFlag code={countryCode} size={16} />}
                </div>
            </div>
        );
    };

    return (
        <Link
            to={to}
            className={`${classes.card} ${featured ? classes.featured : ''} ${isUpcoming ? classes.upcoming : ''} ${showMapBackground ? classes.withMap : classes.plain}`}
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
                {variant === 'live' && <div className={classes.liveBadge}>LIVE</div>}

                <div className={classes.connector} aria-hidden="true" />

                <div className={classes.dateBadge}>{dateLabel}</div>

                <div className={classes.matchRow}>
                    {isUpcoming ? renderUpcomingPlayerSide('left') : renderLivePlayerSide('left')}

                    <div className={classes.centerBadge}>
                        <div className={classes.centerDiamond}>
                            <img src={konoplayLogo} alt="" className={classes.centerLogo} />
                        </div>
                        {showPrediction && (
                            <div className={classes.predictionEmbed} aria-label={`Win prediction ${team1Prediction}% to ${team2Prediction}%`}>
                                <span className={classes.predictionPct}>{team1Prediction}%</span>
                                <span className={classes.predictionLabel}>win odds</span>
                                <span className={classes.predictionPct}>{team2Prediction}%</span>
                            </div>
                        )}
                        <div className={classes.centerMeta}>
                            <span className={classes.centerTournament}>{tournamentName}</span>
                            <span className={classes.centerStage}>{stageLabel}</span>
                            <span className={classes.centerFormat}>{formatSeriesLabel(type)}</span>
                        </div>
                    </div>

                    {isUpcoming ? renderUpcomingPlayerSide('right') : renderLivePlayerSide('right')}
                </div>

                <div
                    className={`${classes.dateBadge} ${classes.timeBadge} ${variant === 'live' ? classes.timeBadgeLive : ''}`}
                >
                    {timeLabel}
                </div>

                <p className={classes.caption}>{caption}</p>
            </div>
        </Link>
    );
};

export default MatchAnnouncementCard;
