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

import classes from './App.module.css';


function App() {
  const [showGraf, setShowGraf] = useState(false);

  const handleGrafClick = () => {
    setShowGraf(true);
  };

  const helpCloseHandler = () => {
    setShowGraf(false);
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
      </Layout>
    </div>
  );
}

export default App;
