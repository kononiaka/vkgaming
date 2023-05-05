import React, { useState } from "react";

import { Routes, Route, Navigate } from 'react-router-dom';

import Layout from './Layout/Layout';
import GrafBanner from "./components/graf_banner/graf_banner";
import GrafHelp from "./components/graf_help/graf_help";
import HomePage from './pages/HomePage';
import UserProfile from './components/Profile/UserProfile';
import { useContext } from 'react';
import AuthPage from './pages/AuthPage';
import AuthContext from './store/auth-context';
import ModalHelp from './UI/ModalHelp/modalHelp';

import help_ico from './image/help_icon.png';

import classes from './App.module.css';


function App(props) {
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

  const authCtx = useContext(AuthContext);

  return (
    <div className={classes.main}>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          {!authCtx.isLogged && (
            <Route path="/auth" element={<AuthPage />} />
          )}
          <Route path="/profile" element={authCtx.isLogged ? <UserProfile /> : <Navigate to="/auth" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <GrafBanner handleGrafClick={handleGrafClick} onClose={helpCloseHandler}></GrafBanner >
        {showGraf && <GrafHelp onClose={helpCloseHandler} graf />}
        <div>
          <img className={classes["help-ico"]} src={help_ico} alt="help-ico" onClick={helpHandler} />
        </div>
        {showHelp && <ModalHelp onClose={helpCloseHandler} />}
      </Layout>
    </div>
  );
}

export default App;
