import React, { useContext } from 'react';

import CartButton from '../UI/LoginBtn/CartButton';

import { Link } from 'react-router-dom';

import AuthContext from '../store/auth-context';



import logo from '../image/konoplay-logo-new-invert.png';



import classes from './MainHeader.module.css';



const MainHeader = () => {

    const authCtx = useContext(AuthContext);



    return (

        <header className={classes.header}>

            <div>

                <Link to="/">

                    <div className={classes.logo}>

                        <img src={logo} alt="Logo" />

                    </div>

                </Link>

                <div className={classes['logo-credo']}>Play with us!</div>

            </div>

            <ul className={classes.navLink}>

                <li className={classes['navLink-item']}>

                    <Link to="/tournaments/homm3" className={classes['navLink-link']}>

                        Tournaments

                    </Link>

                    <div className={classes['navLink-dropdown']}>

                        <Link to="/tournaments/homm3" className={classes['navLink-dropdown-item']}>

                            Heroes of Might & Magic III

                        </Link>

                        <Link to="/games/homm3" className={classes['navLink-dropdown-item']}>

                            Match log

                        </Link>

                        <Link to="/games/homm3/statistics" className={classes['navLink-dropdown-item']}>

                            Statistics

                        </Link>

                    </div>

                </li>

                <li className={classes['navLink-item']}>

                    <Link to="/leaderboard" className={classes['navLink-link']}>

                        Leaderboard

                    </Link>

                </li>

                <li className={classes['navLink-item']}>

                    <Link to="/players" className={classes['navLink-link']}>

                        Players

                    </Link>

                </li>

                <li className={classes['navLink-item']}>

                    <Link to="/rules" className={classes['navLink-link']}>

                        Rules

                    </Link>

                </li>

                <li className={classes['navLink-item']}>

                    <Link to="/support" className={classes['navLink-link']}>

                        Support

                    </Link>

                </li>

                <li className={classes['navLink-item']}>

                    <Link to="/help" className={classes['navLink-link']}>

                        Help

                    </Link>

                </li>

                <ul className={classes['navLink-item-btn']}>

                    {authCtx.isLogged && authCtx.userNickName && (

                        <li className={classes['navLink-nickname']}>

                            <span className={classes.nicknameText}>{authCtx.userNickName}</span>

                        </li>

                    )}

                    <li className={classes['navLink-link']}>

                        <CartButton />

                    </li>

                </ul>

            </ul>

        </header>

    );

};



export default MainHeader;

