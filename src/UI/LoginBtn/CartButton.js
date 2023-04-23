// import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import classes from './CartButton.module.css';
// import { uiActions } from './../../store/ui-slice';


const CartButton = (props) => {
  // const totalQuantity = useSelector(state => state.cart.totalQuantity);

  // const dispatch = useDispatch();

  const toggleHandler = () => {
    // dispatch(uiActions.toggleCart());
  };

  return (
    <Link to='/auth' className={classes.button} onClick={toggleHandler}>
      <span>Login</span>
    </Link>
  );
};

export default CartButton;
