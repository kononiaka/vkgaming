import { FIREBASE_DATABASE_URL, FIREBASE_FUNCTIONS_BASE } from '../../config/firebase';
import { authFetch } from '../../api/authFetch';
import { useContext, useEffect, useRef } from 'react';
import AuthContext from '../../store/auth-context';
import { getAppHashUrl, getTwitchRedirectUri } from '../../utils/appBasePath';

const TWITCH_AUTH_FUNCTION_URL = `${FIREBASE_FUNCTIONS_BASE}/twitchAuth`;
const FIREBASE_API_KEY = process.env.REACT_APP_FIREBASE_API_KEY;

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

        // CSRF — verify state matches what we stored before redirect
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
                // 1. Call Cloud Function to exchange code → Firebase custom token
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
                const { customToken, displayName, dbUserId } = result;

                // 2. Sign in to Firebase with the custom token (REST API)
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

                const signInData = await signInRes.json();

                // 3. Store login in auth context (localId = Firebase auth uid, e.g. twitch:12345)
                authCtx.login(signInData.idToken, displayName, signInData.localId, signInData.refreshToken);

                // 4. Track daily login date
                if (dbUserId) {
                    try {
                        const userSnap = await fetch(
                            `${FIREBASE_DATABASE_URL}/users/${dbUserId}.json`
                        );
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
        <div
            style={{
                textAlign: 'center',
                marginTop: '5rem',
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-body)',
                fontSize: '1rem'
            }}
        >
            Signing you in with Twitch...
        </div>
    );
};

export default TwitchCallback;
