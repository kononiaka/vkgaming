import { FIREBASE_DATABASE_URL } from '../config/firebase';
import React, { Fragment, useContext, useState, useEffect } from 'react';
import ModalAddGame from '../UI/modalAddGame/modalAddGame';
import ModalAddTournament from '../UI/modalAddTournament/ModalAddTournament';
import Notification from '../components/Notification/Notification';
import DonatorsBar from '../components/DonatorsBar/DonatorsBar';

import AuthContext from '../store/auth-context';
import AddTournamentContext from '../store/add-tournament-context';
import classes from './Layout.module.css';
import MainHeader from './MainHeader';

const Layout = (props) => {
    const [showAddGame, showSetAddGame] = useState(false);
    const [showAddTournament, showSetAddTournament] = useState(false);

    const authCtx = useContext(AuthContext);
    const [userCoins, setUserCoins] = useState(null);
    const [isAddTournamentDisabled, setIsAddTournamentDisabled] = useState(true);

    useEffect(() => {
        const checkUserCoins = async () => {
            if (!authCtx.userNickName) return;
            if (authCtx.isAdmin) {
                setUserCoins(null);
                setIsAddTournamentDisabled(false);
                return;
            }
            try {
                const response = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
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
    }, [authCtx.userNickName, authCtx.isAdmin]);

    const handleModalClose = () => {
        showSetAddGame(false);
        showSetAddTournament(false);
    };

    const handleAddGame = () => {
        showSetAddGame(true);
    };

    const handleAddTournament = async () => {
        if (!authCtx.userNickName) return;
        if (authCtx.isAdmin) {
            setIsAddTournamentDisabled(false);
            showSetAddTournament(true);
            return;
        }
        try {
            const response = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
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

                return;
            }
            showSetAddTournament(true);
        } catch (e) {
            setIsAddTournamentDisabled(true);
            authCtx.setNotificationShown(true, 'Unable to check your coins. Please try again later.', 'error', 5);
        }
    };

    const handleAddTournamentHover = async () => {
        if (!authCtx.userNickName) return;
        if (authCtx.isAdmin) {
            setUserCoins(null);
            setIsAddTournamentDisabled(false);
            return;
        }
        try {
            const response = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
            const data = await response.json();
            const user = Object.values(data).find((u) => u.enteredNickname === authCtx.userNickName);
            const coins = user && user.coins ? user.coins : 0;
            setUserCoins(coins);
            setIsAddTournamentDisabled(coins < 5);
        } catch (e) {
            setIsAddTournamentDisabled(true);
        }
    };

    const addTournamentHint = authCtx.isAdmin
        ? 'Create a new tournament (admin)'
        : isAddTournamentDisabled
          ? `Need ${Math.max(0, 5 - (userCoins ?? 0))} more coins`
          : 'Create a new tournament (5 coins)';

    const addTournamentValue = {
        openAddTournament: handleAddTournament,
        refreshAddTournamentState: handleAddTournamentHover,
        isAddTournamentDisabled,
        addTournamentHint,
        userCoins
    };

    return (
        <AddTournamentContext.Provider value={addTournamentValue}>
        <Fragment>
            <DonatorsBar />
            <MainHeader />
            <main className={classes.mainContent}>{props.children}</main>
            <footer className={classes.siteFooter}>
                Site by{' '}
                <a
                    href="https://www.facebook.com/groups/grafwebstudio"
                    target="_blank"
                    rel="noreferrer"
                >
                    Graf Studio
                </a>
            </footer>

            <div
                className={classes['add-game']}
                onClick={handleAddGame}
                style={{ display: authCtx.isAdmin ? 'flex' : 'none' }}
            >
                <div className={classes['add-game-icon']}></div>
                <span className={classes['tooltip']}>Add Game</span>
            </div>
            {/* TODO tooltips */}
            {showAddGame && <ModalAddGame onClose={handleModalClose} addGame />}
            {showAddTournament && <ModalAddTournament onClose={handleModalClose} addTournament />}

            <Notification />
        </Fragment>
        </AddTournamentContext.Provider>
    );
};

export default Layout;
