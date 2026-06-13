import React, { Fragment, useCallback, useContext, useMemo, useState } from 'react';

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

    const authCtx = useContext(AuthContext);
    const isAddTournamentDisabled = !authCtx.userNickName;

    const handleModalClose = () => {
        showSetAddGame(false);
        showSetAddTournament(false);
    };

    const handleAddGame = () => {
        showSetAddGame(true);
    };

    const handleAddTournament = useCallback(() => {
        if (!authCtx.userNickName) {
            authCtx.setNotificationShown(true, 'Log in to create a tournament.', 'warning', 4);
            return;
        }
        showSetAddTournament(true);
    }, [authCtx.setNotificationShown, authCtx.userNickName]);

    const addTournamentHint = authCtx.isAdmin
        ? 'Create a new tournament (admin)'
        : 'Create a tournament — prize pool funded by donations';

    const addTournamentValue = useMemo(
        () => ({
            openAddTournament: handleAddTournament,
            isAddTournamentDisabled,
            addTournamentHint
        }),
        [addTournamentHint, handleAddTournament, isAddTournamentDisabled]
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
                        <ModalAddTournament onClose={handleModalClose} addTournament />
                    )}

                    <Notification />
                </Fragment>
            </AddTournamentContext.Provider>
        </AddGameContext.Provider>
    );
};

export default Layout;
