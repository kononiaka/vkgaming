import { useContext, useEffect } from 'react';

import AuthContext from '../../store/auth-context';
import { getTwitchRedirectUri } from '../../utils/appBasePath';

import classes from './AuthForm.module.css';

const TWITCH_CLIENT_ID = process.env.REACT_APP_TWITCH_CLIENT_ID;

const AuthForm = () => {
    const authCtx = useContext(AuthContext);

    useEffect(() => {
        const pendingAuthError = sessionStorage.getItem('auth_error_message');
        if (pendingAuthError) {
            authCtx.setNotificationShown(true, pendingAuthError, 'error', 7);
            sessionStorage.removeItem('auth_error_message');
        }
    }, [authCtx]);

    const handleTwitchLogin = () => {
        if (!TWITCH_CLIENT_ID) {
            authCtx.setNotificationShown(true, 'Twitch login is not configured.', 'error', 5);
            return;
        }
        const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        sessionStorage.setItem('twitch_oauth_state', state);

        const redirectUri = getTwitchRedirectUri();
        const scope = 'user:read:email';
        const params = new URLSearchParams({
            client_id: TWITCH_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope,
            state
        });
        window.location.href = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
    };

    return (
        <section className={classes.auth}>
            <header className={classes.header}>
                <h1 className={classes.title}>Player login</h1>
                <p className={classes.subtitle}>
                    Konoplay is for streamers. Sign in with your Twitch account to register for cups and link your
                    channel.
                </p>
            </header>

            <div className={classes.primaryAction}>
                <button type="button" className={classes.twitchBtn} onClick={handleTwitchLogin}>
                    <svg className={classes.twitchIcon} viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                    </svg>
                    Continue with Twitch
                </button>
                <p className={classes.hint}>New players are created automatically on first Twitch sign-in.</p>
            </div>
        </section>
    );
};

export default AuthForm;
