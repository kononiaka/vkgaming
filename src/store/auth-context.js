import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { authFetch, getAuthToken } from '../api/authFetch';
import React, { useCallback, useEffect, useState } from 'react';

const AuthContext = React.createContext({
    token: '',
    isLogged: false,
    login: (token) => {},
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

const retrieveInitToken = () => {
    const initToken = localStorage.getItem('token');
    const initExpirationTime = localStorage.getItem('expirationTime');
    const nickNameValue = localStorage.getItem('userName');
    const remainingTime = calculateRemainingTime(initExpirationTime);

    if (remainingTime <= 3600) {
        localStorage.removeItem('token');
        localStorage.removeItem('expirationTime');
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

    const logoutHandler = useCallback(() => {
        setToken(null);
        setUserNickName('');
        setIsAdmin(false);
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        localStorage.removeItem('expirationTime');
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('firebaseUid');

        if (logoutTimer) {
            clearTimeout(logoutTimer);
        }
    }, []);

    const loginHandler = (tokenId, expirationTime, userName, firebaseUid = null) => {
        setToken(tokenId);
        setUserNickName(userName);
        localStorage.setItem('token', tokenId);
        localStorage.setItem('expirationTime', expirationTime);
        localStorage.setItem('userName', userName);
        if (firebaseUid) {
            localStorage.setItem('firebaseUid', firebaseUid);
        }
        fetchAdminStatus(userName, firebaseUid, tokenId);

        const remainingTime = calculateRemainingTime(expirationTime);

        logoutTimer = setTimeout(logoutHandler, remainingTime);
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
