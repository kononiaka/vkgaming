// import { useDispatch, useSelector } from 'react-redux';

import classes from './CartButton.module.css';
// import { uiActions } from './../../store/ui-slice';


const CartButton = (props) => {
  // const totalQuantity = useSelector(state => state.cart.totalQuantity);

  // const dispatch = useDispatch();

  const toggleHandler = () => {
    // dispatch(uiActions.toggleCart());
  };

  return (
    <>
      <button className={classes.button} onClick={toggleHandler}>
        <span>Login</span>
      </button>
    </>
  );
};

export default CartButton;
