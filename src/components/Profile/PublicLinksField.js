import { useContext, useEffect, useState } from 'react';
import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import { authFetch } from '../../api/authFetch';
import AuthContext from '../../store/auth-context';
import { PUBLIC_LINK_FIELDS } from '../../utils/publicLinks';
import classes from './PublicLinksField.module.css';

const PublicLinksField = ({ userId, links, onSaved }) => {
    const authCtx = useContext(AuthContext);
    const safeLinks = links && typeof links === 'object' ? links : {};
    const [values, setValues] = useState({
        telegram: safeLinks.telegram || '',
        twitch: safeLinks.twitch || '',
        youtube: safeLinks.youtube || ''
    });
    const [savingKey, setSavingKey] = useState(null);
    const [savedKey, setSavedKey] = useState(null);

    useEffect(() => {
        const nextLinks = links && typeof links === 'object' ? links : {};
        setValues({
            telegram: nextLinks.telegram || '',
            twitch: nextLinks.twitch || '',
            youtube: nextLinks.youtube || ''
        });
    }, [links?.telegram, links?.twitch, links?.youtube]);

    const saveField = async (key) => {
        if (!userId) {
            return;
        }

        const trimmed = values[key].trim();
        const current = String(safeLinks[key] || '').trim();

        if (trimmed === current) {
            setValues((prev) => ({ ...prev, [key]: current }));
            return;
        }

        setSavingKey(key);

        try {
            await authFetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: trimmed || null })
            });

            onSaved?.({ [key]: trimmed || null });
            setSavedKey(key);
            authCtx.setNotificationShown(
                true,
                `${PUBLIC_LINK_FIELDS.find((field) => field.key === key)?.label || 'Link'} saved.`,
                'success',
                3
            );
            window.setTimeout(() => setSavedKey(null), 2000);
        } catch (error) {
            console.error('Failed to save public link:', error);
            setValues((prev) => ({ ...prev, [key]: current }));
            authCtx.setNotificationShown(true, 'Failed to save public link.', 'error', 5);
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <div className={classes.root}>
            {PUBLIC_LINK_FIELDS.map((field) => (
                <div key={field.key} className={classes.field}>
                    <label htmlFor={`public-link-${field.key}`} className={classes.label}>
                        {field.label}
                    </label>
                    <input
                        id={`public-link-${field.key}`}
                        type="text"
                        value={values[field.key]}
                        onChange={(event) =>
                            setValues((prev) => ({
                                ...prev,
                                [field.key]: event.target.value
                            }))
                        }
                        onBlur={() => saveField(field.key)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.currentTarget.blur();
                            }
                        }}
                        className={classes.input}
                        placeholder={field.placeholder}
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <span className={classes.hint}>
                        {savingKey === field.key
                            ? 'Saving…'
                            : savedKey === field.key
                              ? 'Saved.'
                              : 'Shown on your public profile. Saves when you leave the field.'}
                    </span>
                </div>
            ))}
        </div>
    );
};

export default PublicLinksField;
