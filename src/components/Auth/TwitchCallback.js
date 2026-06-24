import { FIREBASE_DATABASE_URL, FIREBASE_FUNCTIONS_BASE } from '../../config/firebase';
import { authFetch } from '../../api/authFetch';
import { useContext, useEffect, useRef } from 'react';
import AuthContext from '../../store/auth-context';
import { getAppHashUrl, getTwitchRedirectUri } from '../../utils/appBasePath';
import classes from './TwitchCallback.module.css';

const TWITCH_AUTH_FUNCTION_URL = `${FIREBASE_FUNCTIONS_BASE}/twitchAuth`;
const FIREBASE_API_KEY = process.env.REACT_APP_FIREBASE_API_KEY;

const signInWithCustomTokenInBrowser = async (customToken) => {
    const signInRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: customToken, returnSecureToken: true })
        }
    );

    if (!signInRes.ok) {
        const errData = await signInRes.json().catch(() => ({}));
        throw new Error(errData?.error?.message || 'Firebase sign-in failed');
    }

    return signInRes.json();
};

const TwitchCallback = () => {
    const authCtx = useContext(AuthContext);
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current) {
            return;
        }
        handled.current = true;

        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');

        if (error) {
            const message = `Twitch login cancelled: ${error}`;
            sessionStorage.setItem('auth_error_message', message);
            authCtx.setNotificationShown(true, message, 'error', 5);
            window.location.href = getAppHashUrl('/auth');
            return;
        }

        if (!code) {
            const message = 'Twitch login failed: missing code.';
            sessionStorage.setItem('auth_error_message', message);
            authCtx.setNotificationShown(true, message, 'error', 5);
            window.location.href = getAppHashUrl('/auth');
            return;
        }

        const savedState = sessionStorage.getItem('twitch_oauth_state');
        sessionStorage.removeItem('twitch_oauth_state');
        if (!savedState || savedState !== state) {
            const message = 'Twitch login failed: invalid state.';
            sessionStorage.setItem('auth_error_message', message);
            authCtx.setNotificationShown(true, message, 'error', 5);
            window.location.href = getAppHashUrl('/auth');
            return;
        }

        const redirectUri = getTwitchRedirectUri();

        const doAuth = async () => {
            try {
                const fnRes = await fetch(TWITCH_AUTH_FUNCTION_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: { code, redirectUri } })
                });

                if (!fnRes.ok) {
                    const errData = await fnRes.json().catch(() => ({}));
                    const msg = errData?.error?.message || 'Cloud Function error';
                    throw new Error(msg);
                }

                const { result } = await fnRes.json();
                const { idToken, refreshToken, localId, displayName, dbUserId, customToken } = result;

                let sessionIdToken = idToken;
                let sessionLocalId = localId;
                let sessionRefreshToken = refreshToken;

                if ((!sessionIdToken || !sessionLocalId) && customToken) {
                    const signInData = await signInWithCustomTokenInBrowser(customToken);
                    sessionIdToken = signInData.idToken;
                    sessionLocalId = signInData.localId;
                    sessionRefreshToken = signInData.refreshToken;
                }

                if (!sessionIdToken || !sessionLocalId) {
                    throw new Error('Twitch auth response missing session tokens');
                }

                authCtx.login(sessionIdToken, displayName, sessionLocalId, sessionRefreshToken);

                if (dbUserId) {
                    try {
                        const userSnap = await fetch(`${FIREBASE_DATABASE_URL}/users/${dbUserId}.json`);
                        const userData = await userSnap.json();
                        const today = new Date().toISOString().slice(0, 10);
                        if (userData && userData.lastLoginDate !== today) {
                            await authFetch(`${FIREBASE_DATABASE_URL}/users/${dbUserId}.json`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ lastLoginDate: today })
                            });
                        }
                    } catch (dailyErr) {
                        console.error('Daily login reward error:', dailyErr);
                    }
                }

                window.location.href = getAppHashUrl('/');
            } catch (err) {
                console.error('Twitch OAuth error:', err);
                const message = `Twitch login failed: ${err.message}`;
                sessionStorage.setItem('auth_error_message', message);
                authCtx.setNotificationShown(true, message, 'error', 5);
                window.location.href = getAppHashUrl('/auth');
            }
        };

        doAuth();
    }, [authCtx]);

    return (
        <div className={classes.page}>
            <div className={classes.card} role="status" aria-live="polite">
                <div className={classes.spinner} aria-hidden="true" />
                <p className={classes.title}>Signing you in with Twitch...</p>
                <p className={classes.hint}>Please keep this tab open while we finish connecting your account.</p>
            </div>
        </div>
    );
};

export default TwitchCallback;
