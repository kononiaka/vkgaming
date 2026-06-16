import { Link } from 'react-router-dom';
import classes from './PlayerTournamentsSection.module.css';

const PlayerTournamentsSection = ({
    tournaments = [],
    title = 'Tournaments attended',
    emptyMessage = 'No tournaments yet.',
    className = ''
}) => (
    <section className={`${classes.section} ${className}`.trim()}>
        <h2 className={classes.title}>{title}</h2>
        {tournaments.length === 0 ? (
            <p className={classes.empty}>{emptyMessage}</p>
        ) : (
            <ul className={classes.list}>
                {tournaments.map((tournament) => (
                    <li key={tournament.id}>
                        <Link to={tournament.link} className={classes.card}>
                            <div className={classes.cardHeader}>
                                <span
                                    className={`${classes.status} ${
                                        tournament.status === 'Started!'
                                            ? classes.statusLive
                                            : String(tournament.status || '').includes('Finished')
                                              ? classes.statusFinished
                                              : classes.statusOpen
                                    }`}
                                >
                                    {tournament.statusLabel}
                                </span>
                                {tournament.isPrivate ? <span className={classes.privateTag}>Private</span> : null}
                            </div>
                            <h3 className={classes.name}>{tournament.name}</h3>
                            <div className={classes.metaRow}>
                                {tournament.typeLabel ? (
                                    <span className={classes.meta}>{tournament.typeLabel}</span>
                                ) : null}
                                {tournament.date ? <span className={classes.meta}>{tournament.date}</span> : null}
                            </div>
                            {tournament.prizePoolLabel ? (
                                <p className={classes.prizePool}>{tournament.prizePoolLabel}</p>
                            ) : null}
                            {tournament.resultLabel ? <p className={classes.result}>{tournament.resultLabel}</p> : null}
                        </Link>
                    </li>
                ))}
            </ul>
        )}
    </section>
);

export default PlayerTournamentsSection;
