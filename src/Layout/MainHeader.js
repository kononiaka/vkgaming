import CartButton from '../UI/LoginBtn/CartButton';
import { useContext } from 'react';
import { Link } from 'react-router-dom';

import logo from '../image/logo.png';
import AuthContext from '../store/auth-context';

import classes from './MainHeader.module.css';

const MainHeader = (props) => {
  const authCtx = useContext(AuthContext);
  const isLogged = authCtx.isLogged;

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
            <li><a href="/#">Games</a></li>
            <li><a href="/#">Videos</a></li>
            <li><a href="/#">Players</a></li>
            <li><a href="/#">Leaderboard</a></li>
            <li><a href="/#">Contact</a></li>
            {isLogged &&
              <li>
                <Link to='/profile'>Profile</Link>
              </li>
            }
            <li><CartButton /></li>
          </ul>
        </nav>
      </nav>
    </header>
  );
};

export default MainHeader;
