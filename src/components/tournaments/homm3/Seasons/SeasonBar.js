import { useState } from 'react';
import {
    countCupsInSeason,
    nextAvailableSeasonId,
    seasonDisplayName,
    suggestSeasonName
} from '../../../../utils/seasonData';
import classes from './SeasonBar.module.css';

const SeasonBar = ({ seasons, tournaments, selectedId, onSelect, canCreate, onCreate, loadError }) => {
    const [open, setOpen] = useState(false);
    const [seasonId, setSeasonId] = useState('');
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    if ((!seasons || seasons.length === 0) && !canCreate) {
        return null;
    }

    const openForm = () => {
        const id = nextAvailableSeasonId((seasons || []).map((season) => season.id));
        setSeasonId(id);
        setName(suggestSeasonName(id));
        setError('');
        setOpen(true);
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            const created = await onCreate({ seasonId, name });
            setOpen(false);
            if (created?.id) {
                onSelect(created.id);
            }
        } catch (createError) {
            setError(createError.message || 'Could not create the season.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className={classes.bar} aria-label="Seasons">
            <div className={classes.pills}>
                <button
                    type="button"
                    className={`${classes.pill} ${!selectedId ? classes.pillActive : ''}`}
                    onClick={() => onSelect('')}
                >
                    All cups
                </button>
                {(seasons || []).map((season) => {
                    const count = countCupsInSeason(tournaments, season.id);
                    return (
                        <button
                            key={season.id}
                            type="button"
                            className={`${classes.pill} ${selectedId === season.id ? classes.pillActive : ''}`}
                            onClick={() => onSelect(season.id)}
                        >
                            {seasonDisplayName(season)}
                            <span className={classes.count}>{count}</span>
                        </button>
                    );
                })}
                {canCreate && !open ? (
                    <button type="button" className={classes.createBtn} onClick={openForm}>
                        New season
                    </button>
                ) : null}
            </div>
            {open ? (
                <form className={classes.form} onSubmit={handleCreate}>
                    <label className={classes.field}>
                        Name
                        <input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="2026 Season 2"
                            aria-label="Season name"
                            autoComplete="off"
                            required
                        />
                    </label>
                    <div className={classes.formActions}>
                        <button type="submit" className={classes.createBtn} disabled={saving}>
                            {saving ? 'Saving…' : 'Create season'}
                        </button>
                        <button type="button" className={classes.pill} onClick={() => setOpen(false)} disabled={saving}>
                            Cancel
                        </button>
                    </div>
                    <p className={classes.hint}>Cups join this season from their card.</p>
                    {error ? <p className={classes.error}>{error}</p> : null}
                </form>
            ) : null}
            {loadError ? <p className={classes.error}>{loadError}</p> : null}
        </section>
    );
};

export default SeasonBar;
