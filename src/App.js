import React from "react";

import { Routes, Route, Navigate } from 'react-router-dom';

import Layout from './Layout/Layout';

import HomePage from './pages/HomePage';
import UserProfile from './components/Profile/UserProfile';
import Leaderboard from './components/Leaderboard/Leaderboard';
import { useContext } from 'react';
import AuthPage from './pages/AuthPage';
import AuthContext from './store/auth-context';
import NotFound from './pages/NotFound';


import classes from './App.module.css';


function App(props) {
  const authCtx = useContext(AuthContext);

  return (
    <div className={classes.main}>
      <Layout>
        <Routes>
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/" element={<HomePage />} />
          {!authCtx.isLogged && (
            <Route path="/auth" element={<AuthPage />} />
          )}
          <Route path="/profile" element={authCtx.isLogged ? <UserProfile /> : <Navigate to="/auth" />} />
          <Route path='*' element={<NotFound />} />
        </Routes>
      </Layout>
    </div>
  );
}

export default App;
