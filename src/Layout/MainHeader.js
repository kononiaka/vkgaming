import React from 'react';
import CartButton from '../UI/LoginBtn/CartButton';
// import { useContext } from 'react';
import { Link } from 'react-router-dom';

import logo from '../image/logo.png';
// import AuthContext from '../store/auth-context';

import classes from './MainHeader.module.css';

const MainHeader = (props) => (
    // const authCtx = useContext(AuthContext);
    // const isLogged = authCtx.isLogged;

    // const logoutHandler = () => {
    //   authCtx.logout();
    // };
    <header className={classes.header}>
        <div>
            <Link to="/">
                <div className={classes.logo} style={{ width: '300px', height: '45px' }}>
                    <img src={logo} alt="Logo" style={{ height: '100%' }} />
                </div>
            </Link>
            <div className={classes['logo-credo']}>Play with us!</div>
        </div>
        <ul className={classes.navLink}>
            <li className={classes['navLink-item']}>
                <Link to="/games" className={classes['navLink-link']}>
                    Games
                </Link>
                <div className={classes['navLink-dropdown']}>
                    <Link to="/games/homm3" className={classes['navLink-dropdown-item']}>
                        Heroes of Might & Magic III
                    </Link>
                    <div className={classes['navLink-dropdown-statistic']}>
                        <Link to="/games/homm3/statistics" className={classes['navLink-dropdown-statistic-item']}>
                            Statistics
                        </Link>
                    </div>
                    {/* <Link to='/games/swos' className={classes['navLink-dropdown-item']}>Sensible World of Soccer</Link> */}
                    <Link to="/games/civ_vi" className={classes['navLink-dropdown-item']}>
                        Civilization VI
                    </Link>
                </div>
            </li>
            <li className={classes['navLink-item']}>
                <Link to="/videos" className={classes['navLink-link']}>
                    Videos
                </Link>
            </li>
            <li className={classes['navLink-item']}>
                <Link to="/players" className={classes['navLink-link']}>
                    Players
                </Link>
            </li>
            {/* <Link to='/players' className={classes['navLink-link']}>Players</Link> */}
            <li className={classes['navLink-item']}>
                <Link to="leaderboard" className={classes['navLink-link']}>
                    Leaderboard
                </Link>
            </li>
            <li className={classes['navLink-item']}>
                <Link to="/tournaments" className={classes['navLink-link']}>
                    Tournaments
                </Link>
                <div className={classes['navLink-dropdown']}>
                    <Link to="/tournaments/homm3" className={classes['navLink-dropdown-item']}>
                        Heroes of Might & Magic III
                    </Link>
                    <Link to="/tournaments/civ_vi" className={classes['navLink-dropdown-item']}>
                        Civilization VI
                    </Link>
                    {/* <Link to="/tournaments/cs_go" className={classes['navLink-dropdown-item']}>
                        Counter-Strike
                    </Link> */}
                </div>
            </li>
            <ul className={classes['navLink-item-btn']}>
                <li className={classes['navLink-link']}>
                    <CartButton />
                </li>
            </ul>
        </ul>
    </header>
);

export default MainHeader;
