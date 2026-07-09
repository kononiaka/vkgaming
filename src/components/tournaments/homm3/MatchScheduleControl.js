import { useEffect, useId, useState } from 'react';
import { formatMatchSchedule, fromDatetimeLocalValue, toDatetimeLocalValue } from './matchScheduleUtils';
import classes from './MatchScheduleControl.module.css';

const MatchScheduleControl = ({
    scheduledAt = null,
    scheduledBy = null,
    canEdit = false,
    onSave,
    compact = false,
    showMissingHint = false,
    emptyLabel = null
}) => {
    const inputId = useId();
    const [value, setValue] = useState(() => toDatetimeLocalValue(scheduledAt));
    const [saving, setSaving] = useState(false);

    const formatted = formatMatchSchedule(scheduledAt);

    useEffect(() => {
        setValue(toDatetimeLocalValue(scheduledAt));
    }, [scheduledAt]);

    const openPicker = (event) => {
        event.stopPropagation();
        const input = event.currentTarget;
        if (typeof input.showPicker === 'function') {
            try {
                input.showPicker();
            } catch {
                input.focus();
            }
        } else {
            input.focus();
        }
    };

    const handlePickerChange = async (event) => {
        event.stopPropagation();
        const nextValue = event.target.value;
        setValue(nextValue);

        if (!onSave) {
            return;
        }

        const iso = fromDatetimeLocalValue(nextValue);
        if (!iso) {
            return;
        }

        setSaving(true);
        try {
            await onSave(iso);
        } catch (error) {
            console.error('Failed to save match schedule:', error);
            window.alert('Could not save match time. Please try again.');
            setValue(toDatetimeLocalValue(scheduledAt));
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async (event) => {
        event.stopPropagation();
        if (!onSave || !window.confirm('Remove the scheduled match time?')) {
            return;
        }

        setSaving(true);
        try {
            await onSave(null);
            setValue('');
        } catch (error) {
            console.error('Failed to clear match schedule:', error);
            window.alert('Could not clear match time. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (!formatted && !canEdit && !showMissingHint && !emptyLabel) {
        return null;
    }

    const missingLabel = emptyLabel || (canEdit && showMissingHint ? 'Pick a start time' : null);

    return (
        <div
            className={`${classes.wrap} ${compact ? classes.compact : ''}`}
            onClick={(event) => event.stopPropagation()}
        >
            {formatted ? (
                <>
                    <span className={classes.timeLabel}>
                        Starts <strong>{formatted}</strong>
                    </span>
                    {scheduledBy && <span className={classes.timeMeta}>set by {scheduledBy}</span>}
                </>
            ) : (
                missingLabel && <span className={classes.missing}>{missingLabel}</span>
            )}
            {canEdit && (
                <div className={classes.editor}>
                    <input
                        id={inputId}
                        type="datetime-local"
                        className={classes.picker}
                        value={value}
                        onChange={handlePickerChange}
                        onClick={openPicker}
                        onFocus={openPicker}
                        step={900}
                        disabled={saving}
                    />
                    {formatted && (
                        <button
                            type="button"
                            className={`${classes.btn} ${classes.btnGhost}`}
                            onClick={handleClear}
                            disabled={saving}
                        >
                            Clear
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default MatchScheduleControl;
