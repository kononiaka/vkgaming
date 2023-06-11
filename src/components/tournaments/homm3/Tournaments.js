import React, { useContext, useEffect, useState } from 'react';
import { lookForUserId } from '../../../api/api';
import AuthContext from '../../../store/auth-context';
import classes from './Tournaments.module.css';
import { TournamentBracket, renderPlayerList } from './tournamentsBracket';

const TournamentList = () => {
    const [tournaments, setTournaments] = useState([]);
    const [tournamentId, setTournamentId] = useState([]);
    const [showDetails, setShowDetails] = useState(false);
    const authCtx = useContext(AuthContext);
    let { userNickName, isLogged } = authCtx;

    console.log('isLogged', isLogged);

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
                        return tournament ? { id: key, ...tournament } : null;
                    })
                    .filter(Boolean);
                setTournaments(tournamentList);
                // Update tournament ID outside the map function
                if (tournamentList.length > 0) {
                    setTournamentId(tournamentList[0].id);
                }
            } else {
                console.error('Failed to fetch tournaments:', data);
            }
        } catch (error) {
            console.error('Error fetching tournaments:', error);
        }
    };

    useEffect(() => {
        fetchTournaments();
    }, []);

    const checkRegisterUser = (currentUser, players) => {
        const registeredPlayers = Object.values(players).filter((player) => player !== null);
        return registeredPlayers.some((player) => player.name === currentUser);
    };

    const addUserTournament = async (tourId, nickname) => {
        const user = await lookForUserId(nickname, 'full');

        // console.log('user', user);
        // console.log('tourId', tourId);

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

        if (response.ok) {
            // Reload the page if the response is successful
            window.location.reload();
        }
    };

    const showDetailsHandler = () => {
        setShowDetails((prevState) => !prevState);
    };

    let currentPlayers;
    const tournamentList =
        tournaments.length > 0 ? (
            <ul>
                {tournaments.map((tournament) => {
                    // maxPlayers = tournament.maxPlayers;
                    currentPlayers = tournament.players;
                    // console.log('tournament', tournament);
                    // console.log('players in tournament ?', 'players' in tournament);
                    return (
                        <li key={tournament.id} className={classes.bracket}>
                            <h3>{tournament.name}</h3>
                            <p>Status: {tournament.status}</p>
                            <p>
                                Players registered:&nbsp;
                                {'players' in tournament &&
                                    Object.values(tournament.players).filter((player) => player !== null).length}
                            </p>
                            <p>Max players: {tournament.maxPlayers}</p>

                            <button onClick={() => showDetailsHandler()}>View details</button>
                            {'players' in tournament &&
                            Object.keys(tournament.players).length < tournament.maxPlayers ? (
                                checkRegisterUser(userNickName, tournament.players) ? (
                                    <div>
                                        {/* TODO make a toggle */}
                                        <p>You are already registered!</p>
                                    </div>
                                ) : (
                                    isLogged && (
                                        <button onClick={() => addUserTournament(tournamentId, userNickName)}>
                                            Register
                                        </button>
                                    )
                                )
                            ) : (
                                <p>Registration finished!</p>
                            )}
                            {'players' in tournament ? (
                                showDetails && renderPlayerList(tournament.players)
                            ) : (
                                <>
                                    <p>No players registered.</p>
                                    {isLogged && (
                                        <button onClick={() => addUserTournament(tournamentId, userNickName)}>
                                            Register
                                        </button>
                                    )}
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
            {showDetails && (
                <TournamentBracket maxPlayers={currentPlayers} tournamentId={tournamentId}></TournamentBracket>
            )}
        </div>
    );
};

export default TournamentList;
