import React, { useCallback, useEffect, useState } from 'react';

const AuthContext = React.createContext({
    token: '',
    isLogged: false,
    score: null,
    login: (token) => {},
    logout: () => {},
    notificationShown: false,
    message: '',
    notificationStatus: '',
    countdown: 0,
    setNotificationShown: () => {},
    setNotificationMessage: () => {},
    isAdmin: false,
    setIsAdmin: () => {}
});

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

    const fetchAdminStatusByNickname = useCallback(async (nickname) => {
        if (!nickname) {
            setIsAdmin(false);
            localStorage.setItem('isAdmin', 'false');
            return;
        }

        try {
            const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
            const users = await response.json();

            let matchedUser = null;
            if (users) {
                matchedUser = Object.values(users).find((userData) => userData.enteredNickname === nickname);
            }

            const adminValue = matchedUser?.isAdmin === true;
            setIsAdmin(adminValue);
            localStorage.setItem('isAdmin', adminValue ? 'true' : 'false');
        } catch (error) {
            console.error('Error fetching admin status:', error);
            setIsAdmin(false);
            localStorage.setItem('isAdmin', 'false');
        }
    }, []);

    const logoutHandler = useCallback(() => {
        setToken(null);
        setUserNickName('');
        setIsAdmin(false);
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        localStorage.removeItem('expirationTime');
        localStorage.removeItem('isAdmin');

        if (logoutTimer) {
            clearTimeout(logoutTimer);
        }
    }, []);

    const loginHandler = (tokenId, expirationTime, userName) => {
        setToken(tokenId);
        setUserNickName(userName);
        localStorage.setItem('token', tokenId);
        localStorage.setItem('expirationTime', expirationTime);
        localStorage.setItem('userName', userName);
        fetchAdminStatusByNickname(userName);

        const remainingTime = calculateRemainingTime(expirationTime);

        logoutTimer = setTimeout(logoutHandler, remainingTime);
    };

    useEffect(() => {
        if (tokenData) {
            logoutTimer = setTimeout(logoutHandler, tokenData.duration);
        }
    }, [tokenData, logoutHandler]);

    useEffect(() => {
        if (userIsLoggedIn && userNickName) {
            fetchAdminStatusByNickname(userNickName);
        }
    }, [userIsLoggedIn, userNickName, fetchAdminStatusByNickname]);

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
