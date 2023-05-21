import { useState, useRef, useContext } from 'react';

import AuthContext from '../../store/auth-context';
import { useNavigate } from 'react-router-dom';
import { addScoreToUser } from '../../api/api';

import classes from './AuthForm.module.css';

const AuthForm = () => {
  const emailRef = useRef();
  const passwordRef = useRef();
  const nicknameRef = useRef();
  const authCtx = useContext(AuthContext);
  const login = authCtx.login;

  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const switchAuthModeHandler = () => {
    setIsLogin((prevState) => !prevState);
  };

  const addUserHandler = async (user) => {
    try {
      const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json', {
        method: 'POST',
        body: JSON.stringify(user),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      await addScoreToUser(data.name, 1);
      authCtx.notificationShown = true;
      authCtx.setNotificationShown(true);
    } catch (error) {
      console.error(error);
    }
  };

  const lookForNickname = async (email) => {
    const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json', {
      method: 'GET',
    });

    const data = await response.json();

    const userObj = Object.values(data).find(obj => obj.enteredEmail === email);
    const nickNameVal = userObj.enteredNickname;
    localStorage.setItem("userName", nickNameVal);

    return nickNameVal;
  };

  const submitFormHandler = (event) => {
    event.preventDefault();

    const enteredEmail = emailRef.current.value;
    const enteredPassword = passwordRef.current.value;
    let enteredNickname;
    if (!isLogin) {
      enteredNickname = nicknameRef.current.value;
    }
    setIsLoading(true);

    let url;
    if (isLogin) {
      //LOGIN
      url = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyD0B7Cgft2m58MjUWhIzjykJwkvnXN1O2k';
    } else {
      //SIGNUP
      url = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyD0B7Cgft2m58MjUWhIzjykJwkvnXN1O2k';
    }
    fetch(url, {
      method: "POST",
      body: JSON.stringify({
        email: enteredEmail,
        password: enteredPassword,
        returnSecureToken: true
      }),
      headers: {
        'Content-Type': "application/json"
      }
    }).then(async (res) => {
      if (isLogin) {
        enteredNickname = await lookForNickname(enteredEmail);
      }
      setIsLoading(false);
      if (res.ok) {
        if (!isLogin) {
          let user = { enteredNickname, enteredEmail };
          addUserHandler(user);
        }
        return res.json();
      } else {
        return res.json().then((data) => {
          let errorMessage = "Authentification error";

          if (data && data.error && data.error.message) {
            errorMessage = data.error.message;
          }
          throw new Error(errorMessage);
        });
      }
    }).then((data) => {
      const expirationTime = new Date(new Date().getTime() + (+data.expiresIn * 1000));
      login(data.idToken, expirationTime.toISOString(), enteredNickname);
      navigate('/');
    }).catch(err => {
      alert(err.message);
    });
  };
  return (
    <section className={classes.auth}>
      <h1>{isLogin ? 'Login' : 'Sign Up'}</h1>
      <form onSubmit={submitFormHandler}>
        {!isLogin ?
          <div className={classes.control}>
            <label htmlFor='nickname' >Your Nickname</label>
            <input type='name' id='nickname' ref={nicknameRef} required />
          </div>
          : null}
        <div className={classes.control}>
          <label htmlFor='email' >Your Email</label>
          <input type='email' id='email' ref={emailRef} required />
        </div>
        <div className={classes.control}>
          <label htmlFor='password'>Your Password</label>
          <input type='password' id='password' ref={passwordRef} required />
        </div>
        <div className={classes.actions}>
          {!isLoading && <button>{isLogin ? 'Login' : 'Create Account'}</button>}
          {isLoading && <p>Loading...</p>}
          <button
            type='button'
            className={classes.toggle}
            onClick={switchAuthModeHandler}
          >
            {isLogin ? 'Create new account' : 'Login with existing account'}
          </button>
        </div>
      </form>
    </section>
  );
};

export default AuthForm;
