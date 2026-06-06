import { useContext, useEffect, useState } from 'react';
import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import { authFetch } from '../../api/authFetch';
import AuthContext from '../../store/auth-context';
import classes from './LobbyNicknameField.module.css';

const LobbyNicknameField = ({ userId, nickname, onSaved, className = '', inputClassName = '' }) => {
    const authCtx = useContext(AuthContext);
    const [value, setValue] = useState(nickname || '');
    const [status, setStatus] = useState('idle');

    useEffect(() => {
        setValue(nickname || '');
    }, [nickname]);

    const saveNickname = async () => {
        const trimmed = value.trim();
        const current = (nickname || '').trim();

        if (!userId) {
            return;
        }

        if (!trimmed || trimmed === current) {
            setValue(current);
            return;
        }

        if (trimmed.length < 2) {
            authCtx.setNotificationShown(true, 'Lobby nickname must be at least 2 characters.', 'error', 4);
            setValue(current);
            return;
        }

        setStatus('saving');

        try {
            const response = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
            const users = await response.json();
            const taken = Object.entries(users || {}).some(
                ([id, user]) => id !== userId && user?.enteredNickname?.toLowerCase() === trimmed.toLowerCase()
            );

            if (taken) {
                authCtx.setNotificationShown(true, 'This lobby nickname is already taken.', 'error', 5);
                setValue(current);
                setStatus('idle');
                return;
            }

            await authFetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enteredNickname: trimmed })
            });

            authCtx.updateUserNickName(trimmed);
            onSaved?.(trimmed);
            setStatus('saved');
            authCtx.setNotificationShown(true, 'Lobby nickname saved.', 'success', 3);
            window.setTimeout(() => setStatus('idle'), 2000);
        } catch (error) {
            console.error('Failed to save lobby nickname:', error);
            setValue(current);
            setStatus('idle');
            authCtx.setNotificationShown(true, 'Failed to save lobby nickname.', 'error', 5);
        }
    };

    return (
        <div className={`${classes.field} ${className}`.trim()}>
            <label htmlFor="lobby-nickname" className={classes.label}>
                Lobby nickname
            </label>
            <input
                id="lobby-nickname"
                type="text"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onBlur={saveNickname}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.currentTarget.blur();
                    }
                }}
                className={`${classes.input} ${inputClassName}`.trim()}
                autoComplete="off"
                spellCheck={false}
                maxLength={32}
            />
            <span className={classes.hint}>
                {status === 'saving'
                    ? 'Saving…'
                    : status === 'saved'
                      ? 'Saved.'
                      : 'Must match your in-game Heroes III lobby name. Saves when you leave the field.'}
            </span>
        </div>
    );
};

export default LobbyNicknameField;
