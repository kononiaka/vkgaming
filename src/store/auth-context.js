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
    setNotificationShown: () => {},
    setNotificationMessage: () => {}
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
    let userNickName;

    if (tokenData) {
        initToken = tokenData.token;
        userNickName = tokenData.nickNameValue;
    }
    const [token, setToken] = useState(initToken);
    const userIsLoggedIn = !!token;
    const [notificationShown, setNotificationShown] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationStatus, setNotificationStatus] = useState('');

    const logoutHandler = useCallback(() => {
        setToken(null);
        localStorage.removeItem('item');
        localStorage.removeItem('expirationTime');

        if (logoutTimer) {
            clearTimeout(logoutTimer);
        }
    }, []);

    const loginHandler = (tokenId, expirationTime, userName) => {
        setToken(tokenId);
        localStorage.setItem('token', tokenId);
        localStorage.setItem('expirationTime', expirationTime);
        localStorage.setItem('userName', userName);

        const remainingTime = calculateRemainingTime(expirationTime);

        logoutTimer = setTimeout(logoutHandler, remainingTime);
    };

    useEffect(() => {
        if (tokenData) {
            logoutTimer = setTimeout(logoutHandler, tokenData.duration);
        }
    }, [tokenData, logoutHandler]);

    const setNotificationShownHandler = (value, message, status) => {
        setNotificationMessage(message);
        setNotificationShown(value);
        setNotificationStatus(status);
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
        setNotificationShown: setNotificationShownHandler
    };

    return <AuthContext.Provider value={contextValue}>{props.children}</AuthContext.Provider>;
};

export default AuthContext;
