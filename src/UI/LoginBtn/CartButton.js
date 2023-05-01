// import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import AuthContext from '../../store/auth-context';
import { useContext } from 'react';

import classes from './CartButton.module.css';
// import { uiActions } from './../../store/ui-slice';


const CartButton = (props) => {
  const authCtx = useContext(AuthContext);
  const isLogged = authCtx.isLogged;

  const logoutHandler = () => {
    authCtx.logout();
  };

  const toggleHandler = () => { };

  const content = !isLogged ?
    <Link to='/auth' className={classes.button} onClick={toggleHandler}>
      <span>Login</span>
    </Link> :
    <Link className={classes.button} onClick={logoutHandler}>Logout</Link>;

  return (
    content
  );
};

export default CartButton;
