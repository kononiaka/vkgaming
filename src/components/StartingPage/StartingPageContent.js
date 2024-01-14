import { useContext } from 'react';

import AuthContext from '../../store/auth-context';
import classes from './StartingPageContent.module.css';

const StartingPageContent = () => {
    const authCtx = useContext(AuthContext);
    let { userNickName, isLogged, notificationShown } = authCtx;

    if (userNickName === 'undefined') {
        userNickName = localStorage.getItem('userName');
    }

    let greeting = '';
    if (isLogged && notificationShown) {
        greeting = `Welcome on Board, ${userNickName} to VKGaming!`;
    } else if (isLogged && !notificationShown) {
        greeting = `Welcome back, ${userNickName} to VKGaming!`;
    } else {
        greeting = `Welcome to VKGaming!`;
    }

    return (
        <section className={classes.starting}>
            <h1>{greeting}</h1>
        </section>
    );
};

export default StartingPageContent;
