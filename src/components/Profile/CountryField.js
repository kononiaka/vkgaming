import { useContext, useEffect, useState } from 'react';
import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import { authFetch } from '../../api/authFetch';
import AuthContext from '../../store/auth-context';
import { COUNTRY_OPTIONS } from '../../utils/country';
import CountryFlag from '../Country/CountryFlag';
import classes from './CountryField.module.css';

const AUTO_VALUE = '__auto__';

const CountryField = ({ userId, countryCode, countryCodeSource, onSaved, className = '' }) => {
    const authCtx = useContext(AuthContext);
    const [value, setValue] = useState(AUTO_VALUE);
    const [status, setStatus] = useState('idle');

    useEffect(() => {
        if (countryCodeSource === 'manual' && countryCode) {
            setValue(countryCode);
            return;
        }

        setValue(AUTO_VALUE);
    }, [countryCode, countryCodeSource]);

    const saveCountry = async (nextValue) => {
        if (!userId) {
            return;
        }

        setStatus('saving');

        try {
            const now = new Date().toISOString();

            if (nextValue === AUTO_VALUE) {
                await authFetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        countryCodeSource: 'ip',
                        countryCodeUpdatedAt: now
                    })
                });

                onSaved?.({
                    countryCode,
                    countryCodeSource: 'ip'
                });
                authCtx.setNotificationShown(
                    true,
                    'Country set to auto-detect on login. Your flag updates next time you sign in.',
                    'success',
                    4
                );
            } else {
                await authFetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        countryCode: nextValue,
                        countryCodeSource: 'manual',
                        countryCodeUpdatedAt: now
                    })
                });

                onSaved?.({
                    countryCode: nextValue,
                    countryCodeSource: 'manual'
                });
                authCtx.setNotificationShown(true, 'Country flag saved.', 'success', 3);
            }

            setStatus('saved');
            window.setTimeout(() => setStatus('idle'), 2000);
        } catch (error) {
            console.error('Failed to save country:', error);
            setStatus('idle');
            authCtx.setNotificationShown(true, 'Failed to save country.', 'error', 5);
        }
    };

    const handleChange = (event) => {
        const nextValue = event.target.value;
        setValue(nextValue);
        saveCountry(nextValue);
    };

    const displayCode = countryCodeSource === 'manual' ? countryCode : countryCode;

    return (
        <div className={`${classes.field} ${className}`.trim()}>
            <label htmlFor="profile-country" className={classes.label}>
                Country flag
            </label>
            <div className={classes.controlRow}>
                <select
                    id="profile-country"
                    value={value}
                    onChange={handleChange}
                    disabled={status === 'saving'}
                    className={classes.select}
                >
                    <option value={AUTO_VALUE}>Auto-detect from login location</option>
                    {COUNTRY_OPTIONS.map((country) => (
                        <option key={country.code} value={country.code}>
                            {country.name}
                        </option>
                    ))}
                </select>
                {displayCode && <CountryFlag code={displayCode} />}
            </div>
            <span className={classes.hint}>
                {status === 'saving'
                    ? 'Saving…'
                    : status === 'saved'
                      ? 'Saved.'
                      : countryCodeSource === 'manual'
                        ? 'Manual country — shown on your profile and player lists.'
                        : 'Detected from your IP when you sign in with Twitch. Change it here if it is wrong.'}
            </span>
        </div>
    );
};

export default CountryField;
