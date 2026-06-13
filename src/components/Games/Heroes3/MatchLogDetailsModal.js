import { Link } from 'react-router-dom';
import {
    buildMatchLogMapRows,
    formatMatchLogDate,
    resolveMatchLogRecordingLinks
} from '../../../utils/matchLogDetails';
import { getTournamentProfileLink } from '../../../utils/playerTournaments';
import { getTwitchRecordingEmbedUrl } from '../../../utils/twitchUtils';
import classes from './MatchLogDetailsModal.module.css';

const MatchLogDetailsModal = ({ game, bracketContext = null, usersData = {}, onClose }) => {
    if (!game) {
        return null;
    }

    const mapRows = buildMatchLogMapRows(game);
    const recordingLinks = resolveMatchLogRecordingLinks(game, bracketContext, usersData);
    const embedLink = recordingLinks.find((link) => link.isRecording);
    const embedUrl = embedLink ? getTwitchRecordingEmbedUrl(embedLink.url) : null;
    const tournamentLink =
        bracketContext?.tournamentId && bracketContext?.tournament?.status
            ? getTournamentProfileLink(bracketContext.tournamentId, bracketContext.tournament.status)
            : null;

    return (
        <div className={classes.backdrop} onClick={onClose}>
            <div
                className={classes.popup}
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="match-log-details-title"
            >
                <button type="button" className={classes.closeButton} onClick={onClose} aria-label="Close details">
                    ×
                </button>

                <div className={classes.header}>
                    <h3 id="match-log-details-title" className={classes.title}>
                        {game.opponent1} vs {game.opponent2}
                    </h3>
                    <p className={classes.subtitle}>
                        {game.tournamentName || 'Tournament match'}
                        {game.stage || bracketContext?.stageLabel ? ` · ${game.stage || bracketContext.stageLabel}` : ''}
                    </p>
                </div>

                <div className={classes.body}>
                    <section className={classes.section}>
                        <h4 className={classes.sectionTitle}>Match summary</h4>
                        <dl className={classes.metaGrid}>
                            <div>
                                <dt>Date</dt>
                                <dd>{formatMatchLogDate(game.date)}</dd>
                            </div>
                            {game.gameType ? (
                                <div>
                                    <dt>Series</dt>
                                    <dd>{game.gameType}</dd>
                                </div>
                            ) : null}
                            {game.score ? (
                                <div>
                                    <dt>Score</dt>
                                    <dd>{game.score}</dd>
                                </div>
                            ) : null}
                            {game.winner ? (
                                <div>
                                    <dt>Winner</dt>
                                    <dd>{game.winner}</dd>
                                </div>
                            ) : null}
                        </dl>
                        {tournamentLink ? (
                            <Link to={tournamentLink} className={classes.tournamentLink}>
                                Open tournament bracket
                            </Link>
                        ) : null}
                    </section>

                    <section className={classes.section}>
                        <h4 className={classes.sectionTitle}>Maps</h4>
                        <div className={classes.mapList}>
                            {mapRows.map((mapRow) => (
                                <article key={mapRow.label} className={classes.mapCard}>
                                    <div className={classes.mapHeader}>
                                        <span className={classes.mapLabel}>{mapRow.label}</span>
                                        {mapRow.winner ? (
                                            <span className={classes.mapWinner}>{mapRow.winner}</span>
                                        ) : null}
                                    </div>
                                    <div className={classes.mapMatchup}>
                                        <span>{game.opponent1}</span>
                                        <span className={classes.mapCastle}>{mapRow.castle1 || '—'}</span>
                                        <span className={classes.mapVs}>vs</span>
                                        <span className={classes.mapCastle}>{mapRow.castle2 || '—'}</span>
                                        <span>{game.opponent2}</span>
                                    </div>
                                    {(mapRow.gold1 != null || mapRow.gold2 != null) && (
                                        <p className={classes.mapMeta}>
                                            Gold: {mapRow.gold1 ?? 0} / {mapRow.gold2 ?? 0}
                                        </p>
                                    )}
                                    {mapRow.restarts ? (
                                        <p className={classes.mapMeta}>Restarts: {mapRow.restarts}</p>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    </section>

                    {recordingLinks.length > 0 ? (
                        <section className={classes.section}>
                            <h4 className={classes.sectionTitle}>Twitch</h4>
                            {embedUrl ? (
                                <div className={classes.embedWrap}>
                                    <iframe
                                        src={embedUrl}
                                        title="Twitch recording"
                                        className={classes.embedFrame}
                                        allowFullScreen
                                    />
                                </div>
                            ) : null}
                            <div className={classes.linkList}>
                                {recordingLinks.map((link) => (
                                    <a
                                        key={`${link.label}-${link.url}`}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={classes.recordingLink}
                                    >
                                        {link.label}
                                    </a>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default MatchLogDetailsModal;
