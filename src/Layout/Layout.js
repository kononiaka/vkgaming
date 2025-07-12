import React, { Fragment, useContext, useState } from 'react';
import ModalHelp from '../UI/ModalHelp/modalHelp';
import ModalAddGame from '../UI/modalAddGame/modalAddGame';
import ModalAddTournament from '../UI/modalAddTournament/ModalAddTournament';
import ModalDonate from '../UI/modalDonate/modalDonate';
import Notification from '../components/Notification/Notification';
import GrafBanner from '../components/graf_banner/graf_banner';
import GrafHelp from '../components/graf_help/graf_help';
import donate_ico from '../image/donation.png';
import help_ico from '../image/help_icon.png';
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
    const [isAddTournamentDisabled, setIsAddTournamentDisabled] = useState(false);

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

            <button className={classes['add-game']} onClick={handleAddGame}>
                +
            </button>
            <button
                className={classes['add-tournament']}
                onClick={handleAddTournament}
                onMouseEnter={handleAddTournamentHover}
                title={
                    isAddTournamentDisabled
                        ? `You need at least 5 coins to add a tournament. You have ${userCoins ?? 0}.`
                        : ''
                }
            >
                +
            </button>
            <img className={classes['help-ico']} src={help_ico} alt="help-ico" onClick={helpHandler} />
            <img className={classes['donate-ico']} src={donate_ico} alt="donate-ico" onClick={donateHandler} />
            {/* TODO tooltips */}
            {showHelp && <ModalHelp onClose={helpCloseHandler} />}
            {showDonate && <ModalDonate onClose={helpCloseHandler} donate />}
            {showAddGame && <ModalAddGame onClose={helpCloseHandler} addGame />}
            {showAddTournament && <ModalAddTournament onClose={helpCloseHandler} addTournament />}

            <Notification />
        </Fragment>
    );
};

export default Layout;
