// import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import AuthContext from '../../store/auth-context';
import { useContext, useEffect, useState } from 'react';
import StarsComponent from '../../components/Stars/Stars';

import classes from './CartButton.module.css';
// import { uiActions } from './../../store/ui-slice';

const CartButton = (props) => {
    const authCtx = useContext(AuthContext);
    const isLogged = authCtx.isLogged;
    const [userStats, setUserStats] = useState({ coins: 0, stars: 0, rating: 0 });

    useEffect(() => {
        if (isLogged) {
            const fetchUserStats = async () => {
                try {
                    const userNickName = localStorage.getItem('userName');
                    const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
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
                            coins: user.coins || 0,
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

    const toggleHandler = () => {};

    const btnContent = !isLogged ? (
        <Link to="/auth" className={classes.button} onClick={toggleHandler}>
            <span>Login</span>
        </Link>
    ) : (
        <div className={classes.buttonGroup}>
            <div className={classes.statBox}>
                <span className={classes.coinIcon}></span>
                <span className={classes.statValue}>{userStats.coins}</span>
                <span className={classes.tooltip}>Coins</span>
            </div>
            <div className={`${classes.statBox} ${classes.starsBox}`}>
                <StarsComponent stars={userStats.stars} />
                <span className={classes.tooltip}>Rating: {userStats.rating}</span>
            </div>
            <Link className={classes.iconButton} to="/profile" title="Profile">
                <span className={classes.icon}>👤</span>
                <span className={classes.tooltip}>Profile</span>
            </Link>
            <Link className={classes.iconButton} onClick={logoutHandler} title="Logout">
                <span className={classes.icon}>🚪</span>
                <span className={classes.tooltip}>Logout</span>
            </Link>
        </div>
    );

    return btnContent;
};

export default CartButton;
