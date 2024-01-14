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
    const handleAddTournament = () => {
        showSetAddTournament(true);
    };

    // console.log('authCtx', JSON.stringify(authCtx));
    return (
        <Fragment>
            <MainHeader />
            {authCtx.notificationShown && <Notification message={authCtx.message} type={authCtx.status} />}
            <Container>{props.children}</Container>
            <GrafBanner handleGrafClick={handleGrafClick} onClose={helpCloseHandler}></GrafBanner>
            {showGraf && <GrafHelp onClose={helpCloseHandler} graf />}

            <button className={classes['add-game']} onClick={handleAddGame}>
                +
            </button>
            <button className={classes['add-tournament']} onClick={handleAddTournament}>
                +
            </button>
            <img className={classes['help-ico']} src={help_ico} alt="help-ico" onClick={helpHandler} />
            <img className={classes['donate-ico']} src={donate_ico} alt="donate-ico" onClick={donateHandler} />
            {/* TODO tooltips */}
            {showHelp && <ModalHelp onClose={helpCloseHandler} />}
            {showDonate && <ModalDonate onClose={helpCloseHandler} donate />}
            {showAddGame && <ModalAddGame onClose={helpCloseHandler} addGame />}
            {showAddTournament && <ModalAddTournament onClose={helpCloseHandler} addTournament />}
        </Fragment>
    );
};

export default Layout;
