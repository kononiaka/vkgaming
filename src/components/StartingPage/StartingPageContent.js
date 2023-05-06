import { useContext } from 'react';

import AuthContext from '../../store/auth-context';
import classes from './StartingPageContent.module.css';

const StartingPageContent = () => {
  const authCtx = useContext(AuthContext);
  let { userNickName, isLogged } = authCtx;
  console.log('StartingPageContent userNickName', userNickName);

  if (userNickName === 'undefined') {
    userNickName = localStorage.getItem("userName");
  }

  return (
    <section className={classes.starting}>
      <h1>{`Welcome ${isLogged ? `on Board, ${userNickName}` : 'to VKGaming'}!`}</h1>
    </section>
  );
};

export default StartingPageContent;;
