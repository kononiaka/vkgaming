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
      <Link to='/'>
        <div className={classes.logo}>
          <img src={logo} alt="Logo" />
        </div>
      </Link>
      <nav>
        <nav >
          <ul className={classes.navLink}>
            <li><a href="/aa">Games</a></li>
            <li><a href="/aa">Videos</a></li>
            <li><a href="/aa">Players</a></li>
            <li><a href="/aa">Leaderboard</a></li>
            <li><a href="/aa">Tournaments</a></li>
            <li><CartButton /></li>
          </ul>
        </nav>
      </nav>
    </header>
  );
};

export default MainHeader;
