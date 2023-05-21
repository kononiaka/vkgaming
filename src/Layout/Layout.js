import { Fragment, useContext } from 'react';
import React, { useState } from "react";
import MainHeader from './MainHeader';
import Container from './Container';
import GrafBanner from "../components/graf_banner/graf_banner";
import GrafHelp from "../components/graf_help/graf_help";
import ModalHelp from '../UI/ModalHelp/modalHelp';
import ModalDonate from '../UI/modalDonate/modalDonate';
import Notification from '../components/Notification/Notification';
import AuthContext from '../store/auth-context';

import help_ico from '../image/help_icon.png';
import donate_ico from '../image/donation.png';
import classes from './Layout.module.css';
import ModalAddGame from '../UI/modalAddGame/modalAddGame';

const Layout = (props) => {
  const [showGraf, setShowGraf] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [showAddGame, showSetAddGame] = useState(false);

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
  };

  const donateHandler = () => {
    setShowDonate(true);
  };

  const handleAddGame = () => {
    showSetAddGame(true);
  };


  return (
    <Fragment>
      <MainHeader />
      {authCtx.notificationShown && <Notification message="Congrats! You recieved 1 score point for the registration!" type="success" />}
      <Container>
        {props.children}
      </Container>
      <GrafBanner handleGrafClick={handleGrafClick} onClose={helpCloseHandler}></GrafBanner >
      {showGraf && <GrafHelp onClose={helpCloseHandler} graf />}

      <button className={classes["add-game"]} onClick={handleAddGame}>+</button>
      <img className={classes["help-ico"]} src={help_ico} alt="help-ico" onClick={helpHandler} />
      <img className={classes["donate-ico"]} src={donate_ico} alt="donate-ico" onClick={donateHandler} />
      {/* TODO tooltips */}
      {showHelp && <ModalHelp onClose={helpCloseHandler} />}
      {showDonate && <ModalDonate onClose={helpCloseHandler} donate />}
      {showAddGame && <ModalAddGame onClose={helpCloseHandler} addGame />}
    </Fragment>
  );
};

export default Layout;
