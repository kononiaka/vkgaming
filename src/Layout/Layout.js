import { Fragment } from 'react';
import React, { useState } from "react";
import MainHeader from './MainHeader';
import Container from './Container';
import GrafBanner from "../components/graf_banner/graf_banner";
import GrafHelp from "../components/graf_help/graf_help";
import ModalHelp from '../UI/ModalHelp/modalHelp';

import help_ico from '../image/help_icon.png';
import classes from './Layout.module.css';

const Layout = (props) => {
  const [showGraf, setShowGraf] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const helpHandler = () => {
    setShowHelp(true);
    console.log(showHelp);
  };

  const handleGrafClick = () => {
    setShowGraf(true);
  };

  const helpCloseHandler = () => {
    setShowGraf(false);
    setShowHelp(false);
  };

  return (
    <Fragment>
      <MainHeader />
      <Container>
        {props.children}
      </Container>
      <GrafBanner handleGrafClick={handleGrafClick} onClose={helpCloseHandler}></GrafBanner >
      {showGraf && <GrafHelp onClose={helpCloseHandler} graf />}
      <div>
        <img className={classes["help-ico"]} src={help_ico} alt="help-ico" onClick={helpHandler} />
      </div>
      {showHelp && <ModalHelp onClose={helpCloseHandler} />}
    </Fragment>
  );
};

export default Layout;
