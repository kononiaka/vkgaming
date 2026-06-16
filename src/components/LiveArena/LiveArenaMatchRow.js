import { Link } from 'react-router-dom';
import CountryFlag from '../Country/CountryFlag';
import StarsComponent from '../Stars/Stars';
import { formatMatchSchedule } from '../tournaments/homm3/matchScheduleUtils';
import { getTournamentMatchLink } from '../../utils/tournamentBracketNavigation';
import { getTwitchWatchUrl } from '../../utils/twitchUtils';
import classes from './LiveArenaPage.module.css';

const LiveArenaMatchRow = ({ match, liveLogins = new Set(), showWatch = true }) => {
    const bracketLink = getTournamentMatchLink(match);
    const streamLogin = match.streamLogin || match.team1TwitchLogin || match.team2TwitchLogin;
    const watchUrl = getTwitchWatchUrl(streamLogin);
    const isOnAir = Boolean(streamLogin && liveLogins.has(streamLogin));
    const isMapLive = match.variant === 'live';
    const scheduleLabel = formatMatchSchedule(match.scheduledAt || match.tournamentDate) || 'Time TBD';

    return (
        <article className={`${classes.matchRow} ${isOnAir || isMapLive ? classes.matchRowLive : ''}`}>
            <div className={classes.matchRowMeta}>
                {(isOnAir || isMapLive) && <span className={classes.onAirBadge}>ON AIR</span>}
                <span className={classes.matchTournament}>{match.tournamentName}</span>
                <span className={classes.matchStage}>{match.stageLabel}</span>
            </div>

            <div className={classes.matchRowPlayers}>
                <div className={classes.matchPlayer}>
                    <CountryFlag code={match.team1CountryCode} size={16} />
                    <span className={classes.matchPlayerName}>{match.team1}</span>
                    {match.team1Stars > 0 && <StarsComponent stars={match.team1Stars} />}
                </div>
                <span className={classes.matchVs}>vs</span>
                <div className={classes.matchPlayer}>
                    {match.team2Stars > 0 && <StarsComponent stars={match.team2Stars} />}
                    <span className={classes.matchPlayerName}>{match.team2}</span>
                    <CountryFlag code={match.team2CountryCode} size={16} />
                </div>
            </div>

            <div className={classes.matchRowActions}>
                <span className={classes.matchSchedule}>{scheduleLabel}</span>
                <div className={classes.matchButtons}>
                    {showWatch && watchUrl && (
                        <a
                            href={watchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${classes.watchBtn} ${isOnAir ? classes.watchBtnLive : ''}`}
                        >
                            Watch
                        </a>
                    )}
                    <Link to={bracketLink} className={classes.bracketBtn}>
                        Bracket
                    </Link>
                </div>
            </div>
        </article>
    );
};

export default LiveArenaMatchRow;
