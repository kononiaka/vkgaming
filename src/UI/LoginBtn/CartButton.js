import { Link } from 'react-router-dom';
import AuthContext from '../../store/auth-context';
import { useContext, useEffect, useState } from 'react';
import StarsComponent from '../../components/Stars/Stars';
import { FIREBASE_DATABASE_URL } from '../../config/firebase';

import classes from './CartButton.module.css';

const CartButton = () => {
    const authCtx = useContext(AuthContext);
    const isLogged = authCtx.isLogged;
    const [userStats, setUserStats] = useState({ stars: 0, rating: 0 });

    useEffect(() => {
        if (isLogged) {
            const fetchUserStats = async () => {
                try {
                    const userNickName = localStorage.getItem('userName');
                    const response = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
                    if (!response.ok) return;
                    const data = await response.json();

                    const user = Object.values(data).find((u) => u.enteredNickname === userNickName);
                    if (user) {
                        const rating = user.ratings
                            ? Number(
                                  user.ratings
                                      .split(',')
                                      .map((r) => r.trim())
                                      .filter(Boolean)
                                      .pop()
                              ).toFixed(2)
                            : 0;
                        setUserStats({
                            stars: user.stars || 0,
                            rating: rating
                        });
                    }
                } catch (error) {
                    console.error('Error fetching user stats:', error);
                }
            };
            fetchUserStats();
        }
    }, [isLogged]);

    const logoutHandler = () => {
        authCtx.logout();
    };

    if (!isLogged) {
        return (
            <Link to="/auth" className={classes.button}>
                <span>Login</span>
            </Link>
        );
    }

    return (
        <div className={classes.buttonGroup}>
            <div className={`${classes.statBox} ${classes.starsBox}`}>
                <StarsComponent stars={userStats.stars} />
                <span className={classes.tooltip}>Rating: {userStats.rating}</span>
            </div>
            <Link className={classes.textButton} to="/profile">
                Profile
            </Link>
            <button type="button" className={classes.textButton} onClick={logoutHandler}>
                Logout
            </button>
        </div>
    );
};

export default CartButton;
