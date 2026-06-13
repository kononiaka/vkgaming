import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLiveTournamentPrizePools } from '../../utils/prizePoolData';
import classes from './PrizePoolPanel.module.css';

const PrizePoolPanel = ({ compact = false, className = '' }) => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <section className={rootClass} aria-label="Live tournament prize pools">
            <div className={classes.header}>
                <h2 className={classes.title}>Prize pool</h2>
                <Link to="/support" className={classes.supportBtn}>
                    Support
                </Link>
            </div>

            {loading ? (
                <p className={classes.loading}>Loading prize pools…</p>
            ) : entries.length === 0 ? (
                <p className={classes.empty}>
                    No open cups right now. When a funded cup is in registration or live, community donations (90%)
                    are added here automatically.
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
                            </div>
                            <div className={classes.amountRow}>
                                <span className={classes.amountLabel}>{entry.collectedLabel} prize pool</span>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <p className={classes.note}>90% of every donation goes to active cup prize pools.</p>
        </section>
    );
};

export default PrizePoolPanel;
