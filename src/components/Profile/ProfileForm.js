import { useRef, useContext } from 'react';
import AuthContext from '../../store/auth-context';
import { useNavigate } from 'react-router-dom';

import classes from './ProfileForm.module.css';

const ProfileForm = () => {
  const newPasswordInsertedRef = useRef();
  const authCtx = useContext(AuthContext);

  const navigate = useNavigate();

  const submitHandler = (event) => {
    event.preventDefault();
    const newPasswordValue = newPasswordInsertedRef.current.value;

    fetch('https://identitytoolkit.googleapis.com/v1/accounts:update?key=AIzaSyD0B7Cgft2m58MjUWhIzjykJwkvnXN1O2k', {
      method: "POST",
      body: JSON.stringify({
        idToken: authCtx.token,
        password: newPasswordValue,
        returnSecureToken: false
      }),
      headers: {
        "Content-Type": "application/json"
      }
    }).then(res => {
      if (res.ok) {
        navigate.replace('/');
        return res.json();
      } else {
        return res.json().then(data => {
          console.log(data.error);
          let errorMessage = "Custom error";
          if (data && data.error && data.error.message) {
            errorMessage = data.error.message;
          }
          throw new Error(errorMessage);
        });
      }
    }).catch(err => {
      alert(err.message);
    });


  };
  return (
    <form className={classes.form} onSubmit={submitHandler}>
      <div className={classes.control}>
        <label htmlFor='new-password'>New Password</label>
        <input type='password' id='new-password' ref={newPasswordInsertedRef} />
      </div>
      <div className={classes.action}>
        <button>Change Password</button>
      </div>
    </form>
  );
};

export default ProfileForm;
