import React, { useState, useEffect, useCallback } from 'react';

const AuthContext = React.createContext({
    token: '',
    isLogged: false,
    login: (token) => { },
    logout: () => { }
});


const calculateRemainingTime = (expirationTime) => {
    const currentTime = new Date().getTime();
    const adjExperationTime = new Date(expirationTime).getTime();

    const remainingTime = adjExperationTime - currentTime;

    return remainingTime;
};

const retrieveInitToken = () => {
    const initToken = localStorage.getItem("token");
    const initExpirationTime = localStorage.getItem("expirationTime");
    const nickNameValue = localStorage.getItem("userName");

    const remainingTime = calculateRemainingTime(initExpirationTime);

    if (remainingTime <= 3600) {
        localStorage.removeItem("token");
        localStorage.removeItem("expirationTime");
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

    console.log('tokenData', tokenData);

    let initToken;
    let userNickName;

    if (tokenData) {
        initToken = tokenData.token;
        userNickName = tokenData.nickNameValue;
    }
    const [token, setToken] = useState(initToken);
    const userIsLoggedIn = !!token;


    const logoutHandler = useCallback(() => {
        setToken(null);
        localStorage.removeItem("item");
        localStorage.removeItem("expirationTime");

        if (logoutTimer) {
            clearTimeout(logoutTimer);
        }
    }, []);

    const loginHandler = (token, expirationTime, userName) => {
        setToken(token);
        localStorage.setItem("token", token);
        localStorage.setItem("expirationTime", expirationTime);
        localStorage.setItem("userName", userName);

        const remainingTime = calculateRemainingTime(expirationTime);

        logoutTimer = setTimeout(logoutHandler, remainingTime);
    };

    useEffect(() => {
        if (tokenData) {
            // console.log(tokenData.duration);
            logoutTimer = setTimeout(logoutHandler, tokenData.duration);
        }
    }, [tokenData, logoutHandler]);

    const contextValue = {
        token: token,
        isLogged: userIsLoggedIn,
        login: loginHandler,
        logout: logoutHandler,
        userNickName: userNickName
    };

    return <AuthContext.Provider value={contextValue}>{props.children}</AuthContext.Provider>;
};

export default AuthContext;