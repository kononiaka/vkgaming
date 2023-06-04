import React, { useContext, useEffect, useState } from 'react';
import { lookForUserId } from '../../../api/api';
import AuthContext from '../../../store/auth-context';
import classes from './Tournaments.module.css';

const TournamentList = () => {
    const [tournaments, setTournaments] = useState([]);
    const [tournamentId, setTournamentId] = useState([]);
    const authCtx = useContext(AuthContext);
    let { userNickName } = authCtx;

    useEffect(() => {
        const fetchTournaments = async () => {
            try {
                const response = await fetch(
                    'https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3.json'
                );
                const data = await response.json();

                if (response.ok) {
                    const tournamentList = Object.keys(data)
                        .map((key) => {
                            const tournament = data[key];
                            if (tournament) {
                                setTournamentId(tournament.id);
                            }
                            return tournament ? { id: key, ...tournament } : null;
                        })
                        .filter(Boolean);

                    setTournaments(tournamentList);
                } else {
                    console.error('Failed to fetch tournaments:', data);
                }
            } catch (error) {
                console.error('Error fetching tournaments:', error);
            }
        };

        fetchTournaments();
    }, []);

    const formatPlayerName = (player) => player.name;

    const checkRegisterUser = (currentUser, players) => {
        Object.values(players)
            .filter((player) => player !== null) // Filter out null values
            .map((player) => {
                if (player.name === currentUser) {
                    console.log('true');
                    return true;
                } else {
                    console.log('false');
                    return false;
                }
            });
    };
    const addUserTournament = async (tourId, nickname) => {
        const user = await lookForUserId(nickname, 'full');

        console.log('user', user);
        console.log('tourId', tourId);

        const response = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tourId}/players/.json`,
            {
                method: 'POST',
                body: JSON.stringify(user),
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    };

    // TournamentBracket();
    // checkRegisterUser(authCtx);

    const tournamentList =
        tournaments.length > 0 ? (
            <ul>
                {tournaments.map((tournament) => {
                    console.log('tournament', tournament);
                    // console.log('players in tournament ?', 'players' in tournament);

                    return (
                        <li key={tournament.id} className={classes.bracket}>
                            <h3>{tournament.name}</h3>
                            <p>Status: {tournament.status}</p>
                            <p>
                                Players registered:
                                {'players' in tournament &&
                                    Object.values(tournament.players).filter((player) => player !== null).length}
                            </p>
                            <p>Max players: {tournament.maxPlayers}</p>
                            <h4>Players:</h4>
                            {'players' in tournament &&
                            Object.keys(tournament.players).length < tournament.maxPlayers ? (
                                checkRegisterUser(userNickName, tournament.players) ? (
                                    <p>You are registered!</p>
                                ) : (
                                    <button onClick={() => addUserTournament(tournamentId, userNickName)}>
                                        Register
                                    </button>
                                )
                            ) : (
                                <p>Registration finished!</p>
                            )}
                            {'players' in tournament ? (
                                <ul>
                                    {Object.values(tournament.players)
                                        .filter((player) => player !== null)
                                        .map((player) => (
                                            <li key={player.name}>{formatPlayerName(player)}</li>
                                        ))}
                                </ul>
                            ) : (
                                <>
                                    <p>No players registered.</p>
                                    <button onClick={() => addUserTournament(tournamentId, userNickName)}>
                                        Register
                                    </button>
                                </>
                            )}
                        </li>
                    );
                })}
            </ul>
        ) : (
            <ul>No current tournaments</ul>
        );

    return (
        <div>
            {/* <h2>Finished Tournaments</h2> */}
            <h2>Current Tournaments</h2>
            {/* <h2>Future Tournaments</h2> */}
            {tournamentList}
        </div>
    );
};

export default TournamentList;
