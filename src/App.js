import React from 'react';

import { Navigate, Route, Routes } from 'react-router-dom';

import Layout from './Layout/Layout';

import { useContext } from 'react';
import Heroes3Games from './components/Games/Heroes3/Heroes3';
import Heroes3Stats from './components/Games/Heroes3/Stats/Heroes3Stats';
import Leaderboard from './components/Leaderboard/Leaderboard';
import Players from './components/Players/Players';
import UserProfile from './components/Profile/UserProfile';
import TournamentList from './components/tournaments/homm3/Tournaments';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import NotFound from './pages/NotFound';
import AuthContext from './store/auth-context';

import classes from './App.module.css';

function App() {
    const authCtx = useContext(AuthContext);

    return (
        <div className={classes.main}>
            <Layout>
                <Routes>
                    <Route path="/games/homm3" element={<Heroes3Games />} />
                    <Route path="/tournaments/homm3" element={<TournamentList />} />
                    {/* <Route path="/tournaments/homm3" element={<Heroes3Games />} /> */}
                    <Route path="/games/homm3/statistics" element={<Heroes3Stats />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    {/* <Route path="/players" element={<Players />} /> */}
                    <Route path="/players/:id" element={<Players />} />
                    <Route path="/" element={<HomePage />} />
                    {!authCtx.isLogged && <Route path="/auth" element={<AuthPage />} />}
                    <Route path="/profile" element={authCtx.isLogged ? <UserProfile /> : <Navigate to="/auth" />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Layout>
        </div>
    );
}

export default App;
