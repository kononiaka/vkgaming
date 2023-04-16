import CartButton from '../UI/LoginBtn/CartButton';
import logo from '../image/logo.png';

import classes from './MainHeader.module.css';

const MainHeader = (props) => {
  return (
    <header className={classes.header}>
      <div className={classes.logo}>
        <img src={logo} alt="Logo" />
      </div>
      <nav>
        <nav >
          <ul className={classes.navLink}>
            <li><a href="#">Home</a></li>
            <li><a href="#">Games</a></li>
            <li><a href="#">Players</a></li>
            <li><a href="#">About Us</a></li>
            <li><a href="#">Contact</a></li>
          </ul>
        </nav>
      </nav>
      <CartButton />
    </header>
  );
};

export default MainHeader;
