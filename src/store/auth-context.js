import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { authFetch, getAuthToken } from '../api/authFetch';
import { refreshFirebaseAuthToken } from '../api/firebaseAuth';
import React, { useCallback, useEffect, useRef, useState } from 'react';

const SESSION_DURATION_MS = 6 * 60 * 60 * 1000;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

const AuthContext = React.createContext({
    token: '',
    isLogged: false,
    login: (_token) => {},
    logout: () => {},
    updateUserNickName: () => {},
    notificationShown: false,
    message: '',
    notificationStatus: '',
    countdown: 0,
    setNotificationShown: () => {},
    setNotificationMessage: () => {},
    isAdmin: false,
    setIsAdmin: () => {}
});

const getFirebaseUidFromToken = (token) => {
    if (!token) {
        return null;
    }

    try {
        const payload = token.split('.')[1];
        if (!payload) {
            return null;
        }

        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(atob(normalized));
        return decoded.user_id || decoded.sub || null;
    } catch (error) {
        return null;
    }
};

const resolveFirebaseUid = (explicitUid, token) =>
    explicitUid || localStorage.getItem('firebaseUid') || getFirebaseUidFromToken(token);

const calculateRemainingTime = (expirationTime) => {
    const currentTime = new Date().getTime();
    const adjExperationTime = new Date(expirationTime).getTime();
    const remainingTime = adjExperationTime - currentTime;
    return remainingTime;
};

const getTokenExpiryMs = (token) => {
    if (!token) {
        return null;
    }

    try {
        const payload = token.split('.')[1];
        if (!payload) {
            return null;
        }

        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(atob(normalized));
        return decoded.exp ? decoded.exp * 1000 : null;
    } catch {
        return null;
    }
};

const clearStoredSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('expirationTime');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('firebaseUid');
    localStorage.removeItem('refreshToken');
};

const retrieveInitToken = () => {
    const initToken = localStorage.getItem('token');
    const initExpirationTime = localStorage.getItem('expirationTime');
    const nickNameValue = localStorage.getItem('userName');

    if (!initToken || !initExpirationTime) {
        return null;
    }

    const remainingTime = calculateRemainingTime(initExpirationTime);

    if (remainingTime <= 0) {
        clearStoredSession();
        return null;
    }

    return {
        token: initToken,
        duration: remainingTime,
        nickNameValue: nickNameValue
    };
};

let logoutTimer;

export const AuthContextProvider = (props) => {
    const tokenData = retrieveInitToken();

    let initToken;
    let initUserNickName;

    if (tokenData) {
        initToken = tokenData.token;
        initUserNickName = tokenData.nickNameValue;
    }
    const [token, setToken] = useState(initToken);
    const [userNickName, setUserNickName] = useState(initUserNickName || localStorage.getItem('userName') || '');
    const userIsLoggedIn = !!token;
    const [notificationShown, setNotificationShown] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationStatus, setNotificationStatus] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [isAdmin, setIsAdmin] = useState(localStorage.getItem('isAdmin') === 'true');

    const applyAdminStatus = useCallback((adminValue) => {
        setIsAdmin(adminValue);
        localStorage.setItem('isAdmin', adminValue ? 'true' : 'false');
    }, []);

    const fetchAdminStatus = useCallback(
        async (nickname, firebaseUid, authToken = getAuthToken()) => {
            const normalizedNickname = (nickname || '').trim().toLowerCase();
            const resolvedUid = resolveFirebaseUid(firebaseUid, authToken);

            if (resolvedUid) {
                localStorage.setItem('firebaseUid', resolvedUid);
            }

            if (resolvedUid) {
                try {
                    const metaResponse = await authFetch(
                        `${FIREBASE_DATABASE_URL}/meta/admins/${encodeURIComponent(resolvedUid)}.json`
                    );
                    if (metaResponse.ok) {
                        const isMetaAdmin = await metaResponse.json();
                        if (isMetaAdmin === true) {
                            applyAdminStatus(true);
                            return;
                        }
                    }
                } catch (error) {
                    console.error('Error fetching meta admin status:', error);
                }
            }

            if (!normalizedNickname) {
                applyAdminStatus(false);
                return;
            }

            try {
                const response = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
                const users = await response.json();

                const matchedUser = users
                    ? Object.values(users).find(
                          (userData) =>
                              String(userData?.enteredNickname || '')
                                  .trim()
                                  .toLowerCase() === normalizedNickname
                      )
                    : null;

                applyAdminStatus(matchedUser?.isAdmin === true);
            } catch (error) {
                console.error('Error fetching admin status:', error);
                applyAdminStatus(false);
            }
        },
        [applyAdminStatus]
    );

    const tokenRefreshTimerRef = useRef(null);

    const logoutHandler = useCallback(() => {
        setToken(null);
        setUserNickName('');
        setIsAdmin(false);
        clearStoredSession();

        if (logoutTimer) {
            clearTimeout(logoutTimer);
        }

        if (tokenRefreshTimerRef.current) {
            clearTimeout(tokenRefreshTimerRef.current);
            tokenRefreshTimerRef.current = null;
        }
    }, []);

    const refreshAuthToken = useCallback(async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            return false;
        }

        try {
            const data = await refreshFirebaseAuthToken(refreshToken);
            const newToken = data.idToken;
            if (!newToken) {
                return false;
            }

            setToken(newToken);
            localStorage.setItem('token', newToken);
            if (data.refreshToken) {
                localStorage.setItem('refreshToken', data.refreshToken);
            }

            return true;
        } catch (error) {
            const apiKey = process.env.REACT_APP_FIREBASE_API_KEY;
            if (!apiKey) {
                console.error('Error refreshing auth token:', error);
                return false;
            }

            try {
                const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: refreshToken
                    })
                });

                if (!response.ok) {
                    return false;
                }

                const data = await response.json();
                const newToken = data.id_token;
                if (!newToken) {
                    return false;
                }

                setToken(newToken);
                localStorage.setItem('token', newToken);
                if (data.refresh_token) {
                    localStorage.setItem('refreshToken', data.refresh_token);
                }

                return true;
            } catch (fallbackError) {
                console.error('Error refreshing auth token:', fallbackError);
                return false;
            }
        }
    }, []);

    const scheduleTokenRefresh = useCallback(
        (authToken) => {
            if (tokenRefreshTimerRef.current) {
                clearTimeout(tokenRefreshTimerRef.current);
                tokenRefreshTimerRef.current = null;
            }

            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken || !authToken) {
                return;
            }

            const expiryMs = getTokenExpiryMs(authToken);
            if (!expiryMs) {
                return;
            }

            const delay = Math.max(expiryMs - Date.now() - TOKEN_REFRESH_BUFFER_MS, 60 * 1000);
            tokenRefreshTimerRef.current = setTimeout(async () => {
                const refreshed = await refreshAuthToken();
                if (!refreshed) {
                    logoutHandler();
                }
            }, delay);
        },
        [refreshAuthToken, logoutHandler]
    );

    const loginHandler = (tokenId, userName, firebaseUid = null, refreshToken = null) => {
        const expirationTime = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

        setToken(tokenId);
        setUserNickName(userName);
        localStorage.setItem('token', tokenId);
        localStorage.setItem('expirationTime', expirationTime);
        localStorage.setItem('userName', userName);
        if (firebaseUid) {
            localStorage.setItem('firebaseUid', firebaseUid);
        }
        if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
        }
        fetchAdminStatus(userName, firebaseUid, tokenId);

        const remainingTime = calculateRemainingTime(expirationTime);

        if (logoutTimer) {
            clearTimeout(logoutTimer);
        }
        logoutTimer = setTimeout(logoutHandler, remainingTime);
        scheduleTokenRefresh(tokenId);
    };

    const updateUserNickNameHandler = useCallback(
        (userName) => {
            const trimmed = (userName || '').trim();
            setUserNickName(trimmed);
            localStorage.setItem('userName', trimmed);
            fetchAdminStatus(trimmed, null, token);
        },
        [fetchAdminStatus]
    );

    useEffect(() => {
        if (tokenData) {
            logoutTimer = setTimeout(logoutHandler, tokenData.duration);
        }
    }, [tokenData, logoutHandler]);

    useEffect(() => {
        if (!token) {
            return;
        }

        const refreshToken = localStorage.getItem('refreshToken');
        const expiryMs = getTokenExpiryMs(token);
        if (refreshToken && expiryMs && expiryMs - Date.now() < TOKEN_REFRESH_BUFFER_MS) {
            refreshAuthToken().then((refreshed) => {
                if (!refreshed) {
                    logoutHandler();
                }
            });
        }

        scheduleTokenRefresh(token);
    }, [token, scheduleTokenRefresh, refreshAuthToken, logoutHandler]);

    useEffect(() => {
        if (userIsLoggedIn && userNickName) {
            fetchAdminStatus(userNickName, null, token);
        }
    }, [userIsLoggedIn, userNickName, fetchAdminStatus]);

    // Enhanced notification handler with countdown
    const setNotificationShownHandler = (value, message, status, duration = 5) => {
        setNotificationMessage(message);
        setNotificationShown(value);
        setNotificationStatus(status);

        if (value) {
            setCountdown(duration);
            let seconds = duration;
            const interval = setInterval(() => {
                seconds -= 1;
                setCountdown(seconds);
                if (seconds <= 0) {
                    setNotificationShown(false);
                    clearInterval(interval);
                }
            }, 1000);
        } else {
            setCountdown(0);
        }
    };

    const contextValue = {
        token: token,
        isLogged: userIsLoggedIn,
        login: loginHandler,
        logout: logoutHandler,
        updateUserNickName: updateUserNickNameHandler,
        userNickName: userNickName,
        notificationShown: notificationShown,
        message: notificationMessage,
        status: notificationStatus,
        countdown: countdown,
        setNotificationShown: setNotificationShownHandler,
        isAdmin: isAdmin,
        setIsAdmin: setIsAdmin
    };

    return <AuthContext.Provider value={contextValue}>{props.children}</AuthContext.Provider>;
};

export default AuthContext;
