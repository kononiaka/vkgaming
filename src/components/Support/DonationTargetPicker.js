import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadDonationTargetTournamentIds, saveDonationTargetTournamentIds } from '../../api/donationTargets';
import { getFirebaseUid } from '../../api/authFetch';
import { fetchDonatableTournamentPools, resolveDonationTargetIds } from '../../utils/prizePoolData';
import classes from './DonationTargetPicker.module.css';

const DonationTargetPicker = ({ selectedIds, onSelectionChange, isLogged = false }) => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);

    const applySelection = useCallback(
        (nextIds) => {
            onSelectionChange(nextIds);
        },
        [onSelectionChange]
    );

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            try {
                const pools = await fetchDonatableTournamentPools();
                if (cancelled) {
                    return;
                }

                setEntries(pools);
                const donatableIds = pools.map((entry) => entry.id);
                const firebaseUid = getFirebaseUid();
                const savedIds = isLogged && firebaseUid ? await loadDonationTargetTournamentIds(firebaseUid) : null;
                const resolved = resolveDonationTargetIds(savedIds, donatableIds);
                applySelection(resolved);
            } catch (error) {
                console.error('Failed to load donatable prize pools:', error);
                if (!cancelled) {
                    setEntries([]);
                    applySelection([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [applySelection, isLogged]);

    const persistSelection = async (nextIds) => {
        const firebaseUid = getFirebaseUid();
        if (!isLogged || !firebaseUid) {
            return;
        }

        try {
            await saveDonationTargetTournamentIds(firebaseUid, nextIds);
        } catch (error) {
            console.error('Failed to save donation targets:', error);
        }
    };

    const toggleTournament = (tournamentId) => {
        const nextIds = selectedIds.includes(tournamentId)
            ? selectedIds.filter((id) => id !== tournamentId)
            : [...selectedIds, tournamentId];
        applySelection(nextIds);
        persistSelection(nextIds);
    };

    const selectAll = () => {
        const nextIds = entries.map((entry) => entry.id);
        applySelection(nextIds);
        persistSelection(nextIds);
    };

    const clearAll = () => {
        applySelection([]);
        persistSelection([]);
    };

    return (
        <section className={classes.panel} aria-label="Choose cups to support">
            <div className={classes.panelHeader}>
                <div>
                    <h2 className={classes.title}>Choose cups to support</h2>
                    <p className={classes.subtitle}>90% of your donation is split equally among the selected cups.</p>
                </div>
                {entries.length > 0 ? (
                    <div className={classes.bulkActions}>
                        <button type="button" className={classes.bulkBtn} onClick={selectAll}>
                            Select all
                        </button>
                        <button type="button" className={classes.bulkBtn} onClick={clearAll}>
                            Clear
                        </button>
                    </div>
                ) : null}
            </div>

            {loading ? (
                <p className={classes.loading}>Loading tournaments…</p>
            ) : entries.length === 0 ? (
                <p className={classes.empty}>
                    No funded cups are accepting community donations right now. Hosts must seed a prize pool first.
                </p>
            ) : (
                <div className={classes.list}>
                    {entries.map((entry) => {
                        const checked = selectedIds.includes(entry.id);

                        return (
                            <label key={entry.id} className={`${classes.item} ${checked ? classes.itemSelected : ''}`}>
                                <input
                                    type="checkbox"
                                    className={classes.checkbox}
                                    checked={checked}
                                    onChange={() => toggleTournament(entry.id)}
                                />
                                <span className={classes.itemBody}>
                                    <span className={classes.itemHeader}>
                                        <span className={classes.itemName}>
                                            <Link
                                                to={entry.tournamentLink}
                                                className={classes.itemLink}
                                                onClick={(event) => event.stopPropagation()}
                                            >
                                                {entry.name}
                                            </Link>
                                        </span>
                                        <span className={classes.statusBadge}>{entry.statusLabel}</span>
                                    </span>
                                    <span className={classes.progressTrack} aria-hidden="true">
                                        <span
                                            className={classes.progressFill}
                                            style={{ width: `${entry.progressPct}%` }}
                                        />
                                        <span className={classes.progressLabel}>Collected {entry.collectedLabel}</span>
                                    </span>
                                </span>
                            </label>
                        );
                    })}
                </div>
            )}

            {!loading && entries.length > 0 && selectedIds.length === 0 ? (
                <p className={classes.warning}>Select at least one cup before donating.</p>
            ) : null}
        </section>
    );
};

export default DonationTargetPicker;
