import React from 'react';
import CartButton from '../UI/LoginBtn/CartButton';
// import { useContext } from 'react';
import { Link } from 'react-router-dom';

import logo from '../image/logo.png';
// import AuthContext from '../store/auth-context';

import classes from './MainHeader.module.css';

const MainHeader = (props) => {
  // const authCtx = useContext(AuthContext);
  // const isLogged = authCtx.isLogged;

  // const logoutHandler = () => {
  //   authCtx.logout();
  // };
  return (
    <header className={classes.header}>
      <div>
        <Link to='/'>
          <div className={classes.logo} style={{ width: '300px', height: '45px' }}>
            <img src={logo} alt="Logo" style={{ height: '100%' }} />
          </div>
        </Link>
        <div className={classes["logo-credo"]}>Play with us!</div>
      </div>
      <ul className={classes.navLink}>
        <li className={classes['navLink-item']}>
          <Link to='/games' className={classes['navLink-link']}>Games</Link>
          <ul className={classes['navLink-dropdown']}>
            <Link to='/games/homm3' className={classes['navLink-dropdown-item']}>Heroes of Might & Magic III</Link>
            <Link to='/games/swos' className={classes['navLink-dropdown-item']}>Sensible World of Soccer</Link>
          </ul>
        </li>
        <li className={classes['navLink-item']}>
          <Link to='/videos' className={classes['navLink-link']}>Videos</Link>
        </li>
        {/* <Link to='/players' className={classes['navLink-link']}>Players</Link> */}
        <li className={classes['navLink-item']}>
          <Link to='leaderboard' className={classes['navLink-link']}>Leaderboard</Link>
        </li>
        <li className={classes['navLink-item']}>
          <Link to='/tournaments' className={classes['navLink-link']}>Tournaments</Link>
        </li>
        <li className={classes['navLink-item-btn']}>
          <li className={classes['navLink-link']}><CartButton /></li>
        </li>
      </ul>
    </header>
  );
};

export default MainHeader;
