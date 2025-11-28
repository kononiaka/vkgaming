import { useContext, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import { addCoinsToUser } from '../../api/api';
import AuthContext from '../../store/auth-context';

import classes from './AuthForm.module.css';

const AuthForm = () => {
    const emailRef = useRef();
    const passwordRef = useRef();
    const nicknameRef = useRef();
    const authCtx = useContext(AuthContext);
    const login = authCtx.login;

    const navigate = useNavigate();

    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const switchAuthModeHandler = () => {
        setIsLogin((prevState) => !prevState);
    };

    const addUserHandler = async (user) => {
        try {
            const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json', {
                method: 'POST',
                body: JSON.stringify(user),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            await addCoinsToUser(data.name, 1);
            authCtx.setNotificationShown(true, 'Congrats! You received 1 score point for the registration!', 'success');
        } catch (error) {
            console.error(error);
        }
    };

    const checkForExistingName = async (nickname) => {
        const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json', {
            method: 'GET'
        });
        const data = await response.json();

        const userObj = Object.values(data).find((obj) => obj.enteredNickname === nickname);

        if (userObj) {
            return false;
        }
        return true;
    };

    const lookForNickname = async (email) => {
        const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json', {
            method: 'GET'
        });

        const data = await response.json();

        const userObj = Object.values(data).find((obj) => obj.enteredEmail === email);
        const nickNameVal = userObj.enteredNickname;
        localStorage.setItem('userName', nickNameVal);

        return nickNameVal;
    };

    const submitFormHandler = async (event) => {
        event.preventDefault();

        const enteredEmail = emailRef.current.value.toLowerCase().trim();
        const enteredPassword = passwordRef.current.value;
        let enteredNickname;
        if (!isLogin) {
            enteredNickname = nicknameRef.current.value;
            let exists = await checkForExistingName(enteredNickname);
            if (!exists) {
                authCtx.setNotificationShown(
                    true,
                    'Oops! This nickname was already been taken. Choose another one!',
                    'warning'
                );
                return false;
            }
        }
        setIsLoading(true);

        let url;
        if (isLogin) {
            //LOGIN
            url =
                'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyD0B7Cgft2m58MjUWhIzjykJwkvnXN1O2k';
        } else {
            //SIGNUP
            url =
                'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyD0B7Cgft2m58MjUWhIzjykJwkvnXN1O2k';
        }
        fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                email: enteredEmail,
                password: enteredPassword,
                returnSecureToken: true
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(async (res) => {
                if (isLogin) {
                    enteredNickname = await lookForNickname(enteredEmail);
                }
                setIsLoading(false);
                if (res.ok) {
                    if (!isLogin) {
                        let user = {
                            enteredNickname,
                            enteredEmail,
                            gamesPlayed: {
                                heroes3: {
                                    loses: 0,
                                    wins: 0
                                }
                            },
                            prizes: [],
                            ratings: 0,
                            coins: 0,
                            stars: 0.5,
                            avatar: null,
                            totalPrize: 0,
                            score: 0
                        };
                        addUserHandler(user);
                    }
                    return res.json();
                } else {
                    return res.json().then((data) => {
                        let errorMessage = 'Authentification error';

                        if (data && data.error && data.error.message) {
                            errorMessage = data.error.message;
                        }
                        throw new Error(errorMessage);
                    });
                }
            })
            .then(async (data) => {
                const expirationTime = new Date(new Date().getTime() + +data.expiresIn * 1000);
                login(data.idToken, expirationTime.toISOString(), enteredNickname);
                // --- Daily login reward logic START ---
                if (isLogin) {
                    // Fetch all users to find the userId by nickname
                    const usersRes = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
                    const usersData = await usersRes.json();

                    if (!usersData) {
                        console.error('No users data found');
                        return;
                    }

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
                            // Update lastLoginDate and add coin
                            await fetch(
                                `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`,
                                {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ lastLoginDate: today })
                                }
                            );
                            await addCoinsToUser(userId, 1);
                            authCtx.setNotificationShown(
                                true,
                                'Congrats! You received 1 coin for your first login today!',
                                'success',
                                5
                            );
                        }
                    }
                }
                // --- Daily login reward logic END ---
                navigate('/');
            })
            .catch((err) => {
                let friendlyMessage = 'An error occurred during authentication.';

                if (err.message.includes('EMAIL_NOT_FOUND')) {
                    friendlyMessage = 'No account found with this email address.';
                } else if (err.message.includes('INVALID_PASSWORD')) {
                    friendlyMessage = 'Incorrect password. Please try again.';
                } else if (err.message.includes('INVALID_LOGIN_CREDENTIALS')) {
                    friendlyMessage = 'Invalid email or password. Please try again.';
                } else if (err.message.includes('EMAIL_EXISTS')) {
                    friendlyMessage = 'This email is already registered. Please login instead.';
                } else if (err.message.includes('TOO_MANY_ATTEMPTS')) {
                    friendlyMessage = 'Too many failed attempts. Please try again later.';
                } else if (err.message.includes('USER_DISABLED')) {
                    friendlyMessage = 'This account has been disabled.';
                } else {
                    friendlyMessage = err.message;
                }

                authCtx.setNotificationShown(true, friendlyMessage, 'error', 5);
                setIsLoading(false);
            });
    };
    return (
        <section className={classes.auth}>
            <h1 className={classes.header}>{isLogin ? '🔑 Login' : '✨ Sign Up'}</h1>
            <form onSubmit={submitFormHandler} className={classes.form}>
                {!isLogin ? (
                    <div className={classes.control}>
                        <label htmlFor="nickname">🎮 Your Nickname</label>
                        <input type="name" id="nickname" ref={nicknameRef} required placeholder="Enter your nickname" />
                    </div>
                ) : null}
                <div className={classes.control}>
                    <label htmlFor="email">📧 Your Email</label>
                    <input type="email" id="email" ref={emailRef} required placeholder="Enter your email" />
                </div>
                <div className={classes.control}>
                    <label htmlFor="password">🔒 Your Password</label>
                    <input type="password" id="password" ref={passwordRef} required placeholder="Enter your password" />
                </div>
                <div className={classes.actions}>
                    {!isLoading && (
                        <button className={classes.submitBtn}>{isLogin ? '🚀 Login' : '✨ Create Account'}</button>
                    )}
                    {isLoading && <p className={classes.loading}>⏳ Loading...</p>}
                    <button type="button" className={classes.toggle} onClick={switchAuthModeHandler}>
                        {isLogin ? '🆕 Create new account' : '🔙 Login with existing account'}
                    </button>
                </div>
            </form>
        </section>
    );
};

export default AuthForm;
