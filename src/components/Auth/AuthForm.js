import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import { useContext, useEffect, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import { addCoins } from '../../api/coinTransactions';
import AuthContext from '../../store/auth-context';
import { authFetch } from '../../api/authFetch';

import classes from './AuthForm.module.css';

const TWITCH_CLIENT_ID = process.env.REACT_APP_TWITCH_CLIENT_ID;

const AuthForm = () => {
    const emailRef = useRef();
    const passwordRef = useRef();
    const authCtx = useContext(AuthContext);
    const login = authCtx.login;

    const navigate = useNavigate();

    const [showLegacyLogin, setShowLegacyLogin] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const firebaseApiKey = process.env.REACT_APP_FIREBASE_API_KEY;

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

        const redirectUri = `${window.location.origin}/auth/twitch/callback`;
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

    const lookForNickname = async (email) => {
        const response = await fetch(`${FIREBASE_DATABASE_URL}/users.json`, {
            method: 'GET'
        });

        const data = await response.json();
        const userObj = Object.values(data).find((obj) => obj.enteredEmail === email);
        const nickNameVal = userObj.enteredNickname;
        localStorage.setItem('userName', nickNameVal);

        return nickNameVal;
    };

    const submitLegacyLoginHandler = async (event) => {
        event.preventDefault();

        const enteredEmail = emailRef.current.value.toLowerCase().trim();
        const enteredPassword = passwordRef.current.value;
        setIsLoading(true);

        try {
            const res = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        email: enteredEmail,
                        password: enteredPassword,
                        returnSecureToken: true
                    }),
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error?.message || 'Authentification error');
            }

            const data = await res.json();
            const enteredNickname = await lookForNickname(enteredEmail);
            const expirationTime = new Date(new Date().getTime() + +data.expiresIn * 1000);
            login(data.idToken, expirationTime.toISOString(), enteredNickname);

            const usersRes = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
            const usersData = await usersRes.json();

            if (usersData) {
                let userId = null;
                let userObj = null;
                for (const [id, user] of Object.entries(usersData)) {
                    if (user && user.enteredNickname === enteredNickname) {
                        userId = id;
                        userObj = user;
                        break;
                    }
                }
                if (userId && userObj) {
                    const today = new Date().toISOString().slice(0, 10);
                    if (userObj.lastLoginDate !== today) {
                        await authFetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ lastLoginDate: today })
                        });
                        await addCoins(userId, 1, 'daily_login', 'Daily login reward');
                        authCtx.setNotificationShown(
                            true,
                            'Congrats! You received 1 coin for your first login today!',
                            'success',
                            5
                        );
                    }
                }
            }

            navigate('/');
        } catch (err) {
            let friendlyMessage = 'An error occurred during authentication.';

            if (err.message.includes('EMAIL_NOT_FOUND')) {
                friendlyMessage = 'No account found with this email address.';
            } else if (err.message.includes('INVALID_PASSWORD')) {
                friendlyMessage = 'Incorrect password. Please try again.';
            } else if (err.message.includes('INVALID_LOGIN_CREDENTIALS')) {
                friendlyMessage = 'Invalid email or password. Please try again.';
            } else if (err.message.includes('TOO_MANY_ATTEMPTS')) {
                friendlyMessage = 'Too many failed attempts. Please try again later.';
            } else if (err.message.includes('USER_DISABLED')) {
                friendlyMessage = 'This account has been disabled.';
            } else {
                friendlyMessage = err.message;
            }

            authCtx.setNotificationShown(true, friendlyMessage, 'error', 5);
        } finally {
            setIsLoading(false);
        }
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

            <div className={classes.legacySection}>
                <button
                    type="button"
                    className={classes.legacyToggle}
                    onClick={() => setShowLegacyLogin((prev) => !prev)}
                    aria-expanded={showLegacyLogin}
                >
                    {showLegacyLogin ? 'Hide email login' : 'Have an existing email account?'}
                </button>

                {showLegacyLogin ? (
                    <form onSubmit={submitLegacyLoginHandler} className={classes.legacyForm}>
                        <div className={classes.control}>
                            <label htmlFor="email">Email</label>
                            <input type="email" id="email" ref={emailRef} required placeholder="your@email.com" />
                        </div>
                        <div className={classes.control}>
                            <label htmlFor="password">Password</label>
                            <input type="password" id="password" ref={passwordRef} required placeholder="Password" />
                        </div>
                        <div className={classes.actions}>
                            {!isLoading && (
                                <button type="submit" className={classes.legacyBtn}>
                                    Sign in with email
                                </button>
                            )}
                            {isLoading && <p className={classes.loading}>Signing in...</p>}
                        </div>
                    </form>
                ) : null}
            </div>
        </section>
    );
};

export default AuthForm;
