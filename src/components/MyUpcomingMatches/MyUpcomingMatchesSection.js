import MatchAnnouncementCard from '../MatchAnnouncement/MatchAnnouncementCard';
import { getCastleImage } from '../../utils/castleImages';
import { getTournamentMatchLink } from '../../utils/tournamentBracketNavigation';
import classes from './MyUpcomingMatchesSection.module.css';

const MyUpcomingMatchesSection = ({
    matches = [],
    title = 'My upcoming matches',
    className = ''
}) => {
    if (!matches.length) {
        return null;
    }

    return (
        <section className={`${classes.section} ${className}`.trim()}>
            <h2 className={classes.title}>{title}</h2>
            <div className={classes.list}>
                {matches.map((match, index) => (
                    <MatchAnnouncementCard
                        key={`${match.tournamentId}-${match.stageIndex}-${match.pairIndex}-${index}`}
                        to={getTournamentMatchLink(match)}
                        team1={match.team1}
                        team2={match.team2}
                        team1Avatar={match.team1Avatar}
                        team2Avatar={match.team2Avatar}
                        team1CountryCode={match.team1CountryCode}
                        team2CountryCode={match.team2CountryCode}
                        score1={match.score1}
                        score2={match.score2}
                        tournamentName={match.tournamentName}
                        stageLabel={match.stageLabel}
                        tournamentDate={match.tournamentDate}
                        variant={match.variant || 'upcoming'}
                        statusLabel={match.statusLabel || 'Upcoming'}
                        type={match.type}
                        castle1Image={getCastleImage(match.castle1)}
                        castle2Image={getCastleImage(match.castle2)}
                        gameNumber={match.gameNumber}
                        team1Stars={match.team1Stars}
                        team2Stars={match.team2Stars}
                        compact
                    />
                ))}
            </div>
        </section>
    );
};

export default MyUpcomingMatchesSection;
