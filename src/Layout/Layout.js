import { FIREBASE_DATABASE_URL } from '../config/firebase';
import React, { Fragment, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ModalAddGame from '../UI/modalAddGame/modalAddGame';
import ModalAddTournament from '../UI/modalAddTournament/ModalAddTournament';
import Notification from '../components/Notification/Notification';
import DonatorsBar from '../components/DonatorsBar/DonatorsBar';

import AuthContext from '../store/auth-context';
import AddGameContext from '../store/add-game-context';
import AddTournamentContext from '../store/add-tournament-context';
import classes from './Layout.module.css';
import MainHeader from './MainHeader';

const Layout = (props) => {
    const [showAddGame, showSetAddGame] = useState(false);
    const [showAddTournament, showSetAddTournament] = useState(false);
    const [addTournamentCoinSnapshot, setAddTournamentCoinSnapshot] = useState(null);

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
        setAddTournamentCoinSnapshot(null);
    };

    const handleAddGame = () => {
        showSetAddGame(true);
    };

    const handleAddTournament = useCallback(async () => {
        if (!authCtx.userNickName) return;
        if (authCtx.isAdmin) {
            setIsAddTournamentDisabled(false);
            setAddTournamentCoinSnapshot(null);
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
                    `You need at least 5 coins for a prize pool. You have ${coins}.`,
                    'error',
                    5
                );

                return;
            }
            setAddTournamentCoinSnapshot(coins);
            showSetAddTournament(true);
        } catch (e) {
            setIsAddTournamentDisabled(true);
            authCtx.setNotificationShown(true, 'Unable to check your coins. Please try again later.', 'error', 5);
        }
    }, [authCtx.isAdmin, authCtx.setNotificationShown, authCtx.userNickName]);

    const handleAddTournamentHover = useCallback(async () => {
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
    }, [authCtx.isAdmin, authCtx.userNickName]);

    const addTournamentHint = authCtx.isAdmin
        ? 'Create a new tournament (admin)'
        : isAddTournamentDisabled
          ? `Need ${Math.max(0, 5 - (userCoins ?? 0))} more coins for prize pool`
          : 'Create a tournament — prize pool comes from your coins';

    const addTournamentValue = useMemo(
        () => ({
            openAddTournament: handleAddTournament,
            refreshAddTournamentState: handleAddTournamentHover,
            isAddTournamentDisabled,
            addTournamentHint,
            userCoins
        }),
        [
            addTournamentHint,
            handleAddTournament,
            handleAddTournamentHover,
            isAddTournamentDisabled,
            userCoins
        ]
    );

    const addGameValue = {
        openAddGame: handleAddGame
    };

    return (
        <AddGameContext.Provider value={addGameValue}>
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

            {showAddGame && <ModalAddGame onClose={handleModalClose} addGame />}
            {showAddTournament && (
                <ModalAddTournament
                    onClose={handleModalClose}
                    addTournament
                    initialCoinBalance={addTournamentCoinSnapshot}
                />
            )}

            <Notification />
        </Fragment>
        </AddTournamentContext.Provider>
        </AddGameContext.Provider>
    );
};

export default Layout;
