import React, { Fragment, useContext, useState, useEffect } from 'react';
import ModalHelp from '../UI/ModalHelp/modalHelp';
import ModalAddGame from '../UI/modalAddGame/modalAddGame';
import ModalAddTournament from '../UI/modalAddTournament/ModalAddTournament';
import ModalDonate from '../UI/modalDonate/modalDonate';
import Notification from '../components/Notification/Notification';
import DonatorsBar from '../components/DonatorsBar/DonatorsBar';
import GrafBanner from '../components/graf_banner/graf_banner';
import GrafHelp from '../components/graf_help/graf_help';

import AuthContext from '../store/auth-context';
import Container from './Container';
import classes from './Layout.module.css';
import MainHeader from './MainHeader';

const Layout = (props) => {
    const [showGraf, setShowGraf] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showDonate, setShowDonate] = useState(false);
    const [showAddGame, showSetAddGame] = useState(false);
    const [showAddTournament, showSetAddTournament] = useState(false);

    const authCtx = useContext(AuthContext);
    const [userCoins, setUserCoins] = useState(null);
    const [isAddTournamentDisabled, setIsAddTournamentDisabled] = useState(true);

    useEffect(() => {
        const checkUserCoins = async () => {
            if (!authCtx.userNickName) return;
            try {
                const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
                const data = await response.json();
                const user = Object.values(data).find((u) => u.enteredNickname === authCtx.userNickName);
                const coins = user && user.coins ? user.coins : 0;
                setUserCoins(coins);
                setIsAddTournamentDisabled(coins < 5);
            } catch (e) {
                setIsAddTournamentDisabled(true);
            }
        };
        checkUserCoins();
    }, [authCtx.userNickName]);

    const helpHandler = () => {
        setShowHelp(true);
    };

    const handleGrafClick = () => {
        setShowGraf(true);
    };

    const helpCloseHandler = () => {
        setShowGraf(false);
        setShowHelp(false);
        setShowDonate(false);
        showSetAddGame(false);
        showSetAddTournament(false);
    };

    const donateHandler = () => {
        setShowDonate(true);
    };

    const handleAddGame = () => {
        showSetAddGame(true);
    };

    const handleAddTournament = async () => {
        if (!authCtx.userNickName) return;
        try {
            const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
            const data = await response.json();
            const user = Object.values(data).find((u) => u.enteredNickname === authCtx.userNickName);
            const coins = user && user.coins ? user.coins : 0;
            setUserCoins(coins);
            setIsAddTournamentDisabled(coins < 5);

            if (coins < 5) {
                authCtx.setNotificationShown(
                    true,
                    `You need at least 5 coins to add a tournament. You have ${coins}.`,
                    'error',
                    5
                );

                console.log(`You need at least 5 coins to add a tournament. You have ${coins}.`);

                <Notification />;

                return; // Prevent opening the modal if not enough coins
            }
            showSetAddTournament(true);
        } catch (e) {
            setIsAddTournamentDisabled(true);
            authCtx.setNotificationShown(true, 'Unable to check your coins. Please try again later.', 'error', 5);
        }
    };

    const handleAddTournamentHover = async () => {
        if (!authCtx.userNickName) return;
        try {
            const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
            const data = await response.json();
            const user = Object.values(data).find((u) => u.enteredNickname === authCtx.userNickName);
            const coins = user && user.coins ? user.coins : 0;
            setUserCoins(coins);
            setIsAddTournamentDisabled(coins < 5);
        } catch (e) {
            setIsAddTournamentDisabled(true);
        }
    };

    // console.log('authCtx', JSON.stringify(authCtx));
    return (
        <Fragment>
            <MainHeader />
            <Container>{props.children}</Container>
            <GrafBanner handleGrafClick={handleGrafClick} onClose={helpCloseHandler}></GrafBanner>
            {showGraf && <GrafHelp onClose={helpCloseHandler} graf />}

            <div className={classes['add-game']} onClick={handleAddGame}>
                <div className={classes['add-game-icon']}></div>
                <span className={classes['tooltip']}>Add Game</span>
            </div>
            <div
                className={`${classes['add-tournament']} ${isAddTournamentDisabled ? classes['disabled'] : ''}`}
                onClick={!isAddTournamentDisabled ? handleAddTournament : undefined}
                onMouseEnter={handleAddTournamentHover}
            >
                <div className={classes['add-tournament-icon']}></div>
                <span className={classes['tooltip']}>
                    {isAddTournamentDisabled ? `Need ${5 - (userCoins ?? 0)} more coins` : 'Add Tournament'}
                </span>
            </div>
            <div className={classes['help-ico']} onClick={helpHandler}>
                <div className={classes['help-icon']}></div>
                <span className={classes['tooltip']}>Need Help?</span>
            </div>
            <div className={classes['donate-ico']} onClick={donateHandler}>
                <div className={classes['donate-coin']}></div>
                <span className={classes['tooltip-right']}>Donate</span>
            </div>
            {/* TODO tooltips */}
            {showHelp && <ModalHelp onClose={helpCloseHandler} />}
            {showDonate && <ModalDonate onClose={helpCloseHandler} donate />}
            {showAddGame && <ModalAddGame onClose={helpCloseHandler} addGame />}
            {showAddTournament && <ModalAddTournament onClose={helpCloseHandler} addTournament />}

            <Notification />
            <DonatorsBar />
        </Fragment>
    );
};

export default Layout;
