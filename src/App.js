import React from 'react';

import { Navigate, Route, Routes } from 'react-router-dom';

import Layout from './Layout/Layout';

import { useContext } from 'react';
import Heroes3Games from './components/Games/Heroes3/Heroes3';
import Heroes3Stats from './components/Games/Heroes3/Stats/Heroes3Stats';
import Leaderboard from './components/Leaderboard/Leaderboard';
import Players from './components/Players/Players';
import PlayersList from './components/Players/PlayersList';
import UserProfile from './components/Profile/UserProfile';
import TournamentList from './components/tournaments/homm3/Tournaments';
import TwitchCallback from './components/Auth/TwitchCallback';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import NotFound from './pages/NotFound';
import SupportPage from './pages/SupportPage';
import HelpPage from './pages/HelpPage';
import RulesPage from './pages/RulesPage';
import LiveArenaPage from './pages/LiveArenaPage';
import MatchCenterPage from './pages/MatchCenterPage';
import AuthContext from './store/auth-context';
import { isTwitchCallbackPath } from './utils/appBasePath';

import classes from './App.module.css';

function App() {
    const authCtx = useContext(AuthContext);
    const isTwitchCallback = isTwitchCallbackPath(window.location.pathname);

    if (isTwitchCallback) {
        return <TwitchCallback />;
    }

    return (
        <div className={classes.main}>
            <Layout>
                <Routes>
                    <Route path="/games/homm3" element={<Heroes3Games />} />
                    <Route path="/tournaments/homm3" element={<TournamentList />} />
                    <Route path="/tournaments/homm3/:tournamentId" element={<TournamentList />} />
                    <Route path="/videos" element={<Navigate to="/tournaments/homm3" replace />} />
                    <Route path="/games/homm3/statistics" element={<Heroes3Stats />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/support" element={<SupportPage />} />
                    <Route path="/help" element={<HelpPage />} />
                    <Route path="/rules" element={<RulesPage />} />
                    <Route path="/players" element={<PlayersList />} />
                    <Route path="/players/:id" element={<Players />} />
                    <Route path="/" element={<HomePage />} />
                    <Route
                        path="/live/match/:tournamentId/:stageIndex/:pairIndex"
                        element={<MatchCenterPage />}
                    />
                    <Route path="/live" element={<LiveArenaPage />} />
                    <Route path="/auth/twitch/callback" element={<TwitchCallback />} />
                    {!authCtx.isLogged && <Route path="/auth" element={<AuthPage />} />}
                    <Route path="/profile" element={authCtx.isLogged ? <UserProfile /> : <Navigate to="/auth" />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Layout>
        </div>
    );
}

export default App;
