import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLiveTournamentPrizePools } from '../../utils/prizePoolData';
import AddTournamentContext from '../../store/add-tournament-context';
import classes from './PrizePoolPanel.module.css';

const PrizePoolPanel = ({ compact = false, className = '', showSupportButton = true, showNote = true }) => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const { openAddTournament, isAddTournamentDisabled, addTournamentHint } = useContext(AddTournamentContext);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            try {
                const pools = await fetchLiveTournamentPrizePools();
                if (!cancelled) {
                    setEntries(pools);
                }
            } catch (error) {
                console.error('Failed to load prize pools:', error);
                if (!cancelled) {
                    setEntries([]);
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
    }, []);

    const rootClass = [classes.panel, compact ? classes.compact : '', className].filter(Boolean).join(' ');
    const showAddTournamentButton = showSupportButton && !loading && entries.length === 0;

    return (
        <section className={rootClass} aria-label="Live tournament prize pools">
            <div className={classes.panelHeader}>
                <h2 className={classes.title}>Prize pool</h2>
                {showSupportButton ? (
                    <div className={classes.headerActions}>
                        {showAddTournamentButton && (
                            <button
                                type="button"
                                className={classes.supportBtn}
                                onClick={openAddTournament}
                                disabled={isAddTournamentDisabled}
                                title={addTournamentHint}
                            >
                                Add tournament
                            </button>
                        )}
                        <Link to="/support" className={classes.supportBtn}>
                            Support
                        </Link>
                    </div>
                ) : null}
            </div>

            {loading ? (
                <p className={classes.loading}>Loading prize pools…</p>
            ) : entries.length === 0 ? (
                <p className={classes.empty}>
                    No open tournaments right now. When registration opens or a cup goes live, prize pools appear here.
                </p>
            ) : (
                <div className={classes.list}>
                    {entries.map((entry) => (
                        <article key={entry.id} className={classes.item}>
                            <div className={classes.itemHeader}>
                                <h3 className={classes.itemName}>
                                    <Link to={entry.tournamentLink} className={classes.itemLink}>
                                        Prize pool {entry.name}
                                    </Link>
                                </h3>
                                <span className={classes.statusBadge}>{entry.statusLabel}</span>
                            </div>
                            <div className={classes.progressTrack} aria-hidden="true">
                                <div className={classes.progressFill} style={{ width: `${entry.progressPct}%` }} />
                                <span className={classes.progressLabel}>Collected {entry.collectedLabel}</span>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {showNote ? <p className={classes.note}>90% of every donation goes to active cup prize pools.</p> : null}
        </section>
    );
};

export default PrizePoolPanel;
