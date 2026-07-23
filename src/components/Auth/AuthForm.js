import { useContext, useEffect } from 'react';

import AuthContext from '../../store/auth-context';
import {
    DEFAULT_PRODUCTION_SITE,
    getTwitchRedirectUri,
    getYouTubeRedirectUri
} from '../../utils/appBasePath';

import classes from './AuthForm.module.css';

const TWITCH_CLIENT_ID = process.env.REACT_APP_TWITCH_CLIENT_ID;
const YOUTUBE_OAUTH_CLIENT_ID = process.env.REACT_APP_YOUTUBE_OAUTH_CLIENT_ID;

const isLocalDevHost = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    const { hostname } = window.location;
    return hostname === 'localhost' || hostname === '127.0.0.1';
};

const AuthForm = () => {
    const authCtx = useContext(AuthContext);
    const onLocalDev = isLocalDevHost();
    const productionLoginUrl = `${DEFAULT_PRODUCTION_SITE}/#/auth`;

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

    const handleYouTubeLogin = () => {
        if (!YOUTUBE_OAUTH_CLIENT_ID) {
            authCtx.setNotificationShown(true, 'YouTube login is not configured.', 'error', 5);
            return;
        }
        const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        sessionStorage.setItem('youtube_oauth_state', state);

        const redirectUri = getYouTubeRedirectUri();
        const scope = [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/youtube.readonly'
        ].join(' ');
        const params = new URLSearchParams({
            client_id: YOUTUBE_OAUTH_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope,
            state,
            access_type: 'online',
            include_granted_scopes: 'true',
            // Force consent so YouTube readonly scope is actually granted (not just Google profile).
            prompt: 'consent select_account'
        });
        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    };

    return (
        <section className={classes.auth}>
            <header className={classes.header}>
                <h1 className={classes.title}>Player login</h1>
                <p className={classes.subtitle}>
                    Konoplay is for streamers. Sign in with Twitch or YouTube to register for cups and link your
                    channel. Use the same provider each time — accounts are not shared across Twitch and YouTube.
                </p>
            </header>

            {onLocalDev && (
                <p className={classes.localDevWarning} role="alert">
                    You are on <strong>{window.location.origin}</strong>, not production. Local login uses a different
                    OAuth callback and will fail unless dev URIs are registered. For live login, open{' '}
                    <a href={productionLoginUrl}>{DEFAULT_PRODUCTION_SITE}/#/auth</a>.
                </p>
            )}

            <div className={classes.primaryAction}>
                <button type="button" className={classes.twitchBtn} onClick={handleTwitchLogin}>
                    <svg className={classes.twitchIcon} viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                    </svg>
                    Continue with Twitch
                </button>
                <button type="button" className={classes.youtubeBtn} onClick={handleYouTubeLogin}>
                    <svg className={classes.youtubeIcon} viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                    Continue with YouTube
                </button>
                <p className={classes.hint}>New players are created automatically on first sign-in.</p>
            </div>
        </section>
    );
};

export default AuthForm;
