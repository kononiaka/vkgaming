import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import AuthContext from '../../store/auth-context';
import classes from './StartingPageContent.module.css';

const StartingPageContent = () => {
    const authCtx = useContext(AuthContext);
    let { userNickName, isLogged, notificationShown } = authCtx;
    const [activeTournaments, setActiveTournaments] = useState([]);
    const [liveGames, setLiveGames] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');

    if (userNickName === 'undefined') {
        userNickName = localStorage.getItem('userName');
    }

    let greeting = '';
    if (isLogged && notificationShown) {
        greeting = `Welcome on Board, ${userNickName} to konoplay!`;
    } else if (isLogged && !notificationShown) {
        greeting = `Welcome back, ${userNickName} to konoplay!`;
    } else {
        greeting = `Welcome to konoplay!`;
    }

    useEffect(() => {
        const fetchActiveTournaments = async () => {
            try {
                const response = await fetch(
                    'https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3.json'
                );
                const data = await response.json();
                if (response.ok && data) {
                    const tournamentList = Object.keys(data)
                        .map((key) => {
                            const tournament = data[key];
                            return tournament ? { id: key, ...tournament } : null;
                        })
                        .filter(Boolean)
                        .filter(
                            (t) =>
                                t.status === 'Registration' ||
                                t.status === 'Registration Started' ||
                                t.status === 'Started!'
                        )
                        .sort((a, b) => {
                            const statusOrder = {
                                'Registration Started': 1,
                                Registration: 1,
                                'Started!': 2,
                                'Tournament Finished': 3
                            };
                            return (statusOrder[a.status] || 999) - (statusOrder[b.status] || 999);
                        });
                    setActiveTournaments(tournamentList);

                    // Extract live games from started tournaments
                    const games = [];
                    Object.keys(data).forEach((tournamentId) => {
                        const tournament = data[tournamentId];
                        if (
                            tournament &&
                            tournament.status === 'Started!' &&
                            tournament.bracket &&
                            tournament.bracket.playoffPairs
                        ) {
                            tournament.bracket.playoffPairs.forEach((stage, stageIndex) => {
                                if (Array.isArray(stage)) {
                                    stage.forEach((pair) => {
                                        // Check if pair has games with castles selected but no winner
                                        if (pair.games && Array.isArray(pair.games)) {
                                            pair.games.forEach((game) => {
                                                if (game.castle1 && game.castle2 && !game.castleWinner) {
                                                    games.push({
                                                        tournamentId,
                                                        tournamentName: tournament.name,
                                                        team1: pair.team1,
                                                        team2: pair.team2,
                                                        score1: pair.score1 || 0,
                                                        score2: pair.score2 || 0,
                                                        type: pair.type,
                                                        stageIndex,
                                                        castle1: game.castle1,
                                                        castle2: game.castle2
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                    setLiveGames(games);
                }
            } catch (error) {
                console.error('Error fetching tournaments:', error);
            }
        };
        fetchActiveTournaments();
    }, []);

    // Check if tournament has live games (castles selected but no winner)
    const hasLiveGames = (tournament) => {
        if (!tournament.bracket || !tournament.bracket.playoffPairs) {
            return false;
        }

        return tournament.bracket.playoffPairs.some((stage) =>
            stage.some((pair) => {
                if (pair.games && Array.isArray(pair.games)) {
                    return pair.games.some((game) => game.castle1 && game.castle2 && !game.castleWinner);
                }
                return false;
            })
        );
    };

    const filteredTournaments = activeTournaments.filter((tournament) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'registration')
            return tournament.status === 'Registration' || tournament.status === 'Registration Started';
        if (statusFilter === 'started') return tournament.status === 'Started!';
        if (statusFilter === 'finished') return tournament.status === 'Tournament Finished';
        if (statusFilter === 'live') return hasLiveGames(tournament);
        return true;
    });

    return (
        <section className={classes.starting}>
            <h1>{greeting}</h1>
            {activeTournaments.length > 0 && (
                <div className={classes.tournamentsSection}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1rem'
                        }}
                    >
                        <h2>Active Tournaments</h2>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.1), rgba(255, 215, 0, 0.05))',
                                border: '2px solid #00ffff',
                                borderRadius: '8px',
                                color: '#00ffff',
                                fontSize: '0.9rem',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="all">All Tournaments</option>
                            <option value="registration">📝 Registration Open</option>
                            <option value="started">🎮 In Progress</option>
                            <option value="live">🔴 Live Games</option>
                            <option value="finished">🏆 Finished</option>
                        </select>
                    </div>
                    <div className={classes.tournamentsList}>
                        {filteredTournaments.map((tournament) => (
                            <Link
                                key={tournament.id}
                                to={`/tournaments/homm3/${tournament.id}`}
                                className={classes.tournamentCard}
                            >
                                <div className={classes.tournamentStatus}>
                                    {tournament.status === 'Registration' ||
                                    tournament.status === 'Registration Started'
                                        ? '📝 Registration Open'
                                        : '🎮 In Progress'}
                                </div>
                                <div className={classes.tournamentName}>{tournament.name}</div>
                                <div className={classes.tournamentDetails}>
                                    {tournament.players
                                        ? Object.values(tournament.players).filter((p) => p !== null).length
                                        : 0}
                                    /{tournament.maxPlayers} Players
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
            {liveGames.length > 0 && (
                <div className={classes.tournamentsSection}>
                    <h2>🔴 Live Games</h2>
                    <div className={classes.tournamentsList}>
                        {liveGames.map((game, index) => (
                            <Link
                                key={index}
                                to={`/tournaments/homm3/${game.tournamentId}`}
                                className={classes.liveGameCard}
                            >
                                <div className={classes.liveIndicator}>● LIVE</div>
                                <div className={classes.tournamentName}>{game.tournamentName}</div>
                                <div className={classes.matchup}>
                                    <div className={classes.player}>
                                        <span className={classes.playerName}>{game.team1}</span>
                                        <span className={classes.score}>{game.score1}</span>
                                    </div>
                                    <div className={classes.vs}>VS</div>
                                    <div className={classes.player}>
                                        <span className={classes.score}>{game.score2}</span>
                                        <span className={classes.playerName}>{game.team2}</span>
                                    </div>
                                </div>
                                <div className={classes.gameType}>
                                    {game.type === 'bo-3' ? 'Best of 3' : 'Best of 1'}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};

export default StartingPageContent;
