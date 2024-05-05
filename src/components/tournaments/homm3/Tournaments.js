import React, { useContext, useEffect, useRef, useState } from 'react';
import { lookForUserId } from '../../../api/api';
import AuthContext from '../../../store/auth-context';
import classes from './Tournaments.module.css';
import { TournamentBracket, renderPlayerList } from './tournamentsBracket';

const TournamentList = () => {
    const [tournaments, setTournaments] = useState([]);
    const [tournamentId, setTournamentId] = useState([]);
    const [clickedId, setClickedId] = useState([]);
    const [tournamentStatus, setTournamentStatus] = useState('');
    const [tournamentWinner, setTournamentWinner] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    const [firstStagePairs, setFirstStagePairs] = useState([]);
    const authCtx = useContext(AuthContext);
    let { userNickName, isLogged } = authCtx;

    const nicknameRef = useRef();
    // console.log('nicknameRef', nicknameRef);

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
                    setFirstStagePairs(tournamentList[0].bracket.playoffPairs[0]);
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

        console.log('user', user);
        console.log('tourId', tourId);

        substituteTBDPlayer(user);

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

    const substituteTBDPlayer = async (user) => {
        // Find the index of the first occurrence of 'TBA' team in the array
        const index = firstStagePairs.findIndex((pair) => pair.team1 === 'TBA' || pair.team2 === 'TBA');

        if (index !== -1) {
            // If 'TBA' team is found, substitute it with the 'user' value
            if (firstStagePairs[index].team1 === 'TBA') {
                firstStagePairs[index].team1 = user.name;
            } else {
                firstStagePairs[index].team2 = user.name;
            }

            try {
                const response = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/playoffPairs/0.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify(firstStagePairs),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (response.ok) {
                    console.log('Pairs posted to Firebase successfully');

                    // retrieveWinnersFromDatabase();
                } else {
                    console.log('Failed to post pairs to Firebase');
                }
            } catch (e) {
                console.error(e.message);
            }
            // Log the updated firstStagePairs
            // console.log('firstStagePairs', firstStagePairs);
        } else {
            // If 'TBA' team is not found, handle the case (e.g., display a message)
            console.log('No TBD team found in firstStagePairs.');
        }
    };

    const showDetailsHandler = async (currentTournamentStatus, currentTournamentWinner, currentTournamentId) => {
        setClickedId(currentTournamentId);
        setShowDetails((prevState) => !prevState);
        setTournamentStatus(currentTournamentStatus);
        setTournamentWinner(currentTournamentWinner);
    };

    const handleUserToAdd = () => {
        console.log(nicknameRef.current.value);
    };

    let currentPlayers;
    const tournamentList =
        tournaments.length > 0 ? (
            <ul>
                {tournaments.map((tournament) => {
                    // console.log('tournament', tournament);
                    // maxPlayers = tournament.maxPlayers;
                    // console.log('Object.values(tournament.players)', Object.values(tournament.players));
                    // console.log('length 111', Object.values(tournament.players).length);
                    currentPlayers = tournament.players ? tournament.players : {};

                    return (
                        <li key={tournament.id} className={classes.bracket}>
                            <h3>{tournament.name}</h3>
                            <p>Status: {tournament.status}</p>
                            <p>
                                Players registered:&nbsp;
                                {'players' in tournament &&
                                    Object.values(tournament.players).filter(
                                        (player) =>
                                            player !== null && player.name !== undefined && player.name.trim() !== ''
                                    ).length}
                            </p>
                            <p>Max players: {tournament.maxPlayers}</p>
                            <button
                                onClick={() =>
                                    showDetailsHandler(
                                        tournament.status,
                                        tournament.winners['1st place'],
                                        tournament.id
                                    )
                                }
                            >
                                View details
                            </button>
                            {'players' in tournament &&
                            Object.keys(tournament.players).length < tournament.maxPlayers ? (
                                checkRegisterUser(userNickName, tournament.players) ? (
                                    <div>
                                        {/* TODO make a toggle */}
                                        <p>You are already registered!</p>
                                    </div>
                                ) : (
                                    isLogged && (
                                        <button
                                            onClick={() =>
                                                addUserTournament(tournament.id, userNickName, tournament.players)
                                            }
                                        >
                                            Register-1
                                        </button>
                                    )
                                )
                            ) : (
                                <p>{tournament.status}</p>
                            )}

                            {'players' in tournament ? (
                                showDetails && renderPlayerList(tournament.players)
                            ) : (
                                <>
                                    <p>No players registered.</p>
                                    {isLogged && +tournament.maxPlayers !== +Object.keys(tournament.players).length && (
                                        <button onClick={() => addUserTournament(tournament.id, userNickName)}>
                                            Register-2
                                        </button>
                                    )}
                                </>
                            )}
                            <p>Price Pull</p>
                            {tournament.status === 'Register' &&
                                tournament.maxPlayers === Object.keys(tournament.players).length && (
                                    <div>
                                        <label htmlFor="nickname">Player's Nickname</label>
                                        <input type="name" id="nickname" ref={nicknameRef} required />
                                        <button
                                            onClick={() => addUserTournament(tournament.id, nicknameRef.current.value)}
                                        >
                                            Add Player
                                        </button>
                                    </div>
                                )}
                            {/* {console.log(tournament)} */}
                            {Object.entries(tournament.pricePull).map(([place, prize]) => (
                                <div key={place}>{`${place}: ${prize}$`}</div>
                            ))}
                            {tournament.winner && <p>Winners</p>}
                            {/* {console.log(tournament.winner)} */}
                            {tournament.winner &&
                                Object.entries(tournament.winners).map(([place, winner]) => (
                                    <div key={place}>{`${place}: ${winner}`}</div>
                                ))}
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
            {/* {console.log('currentPlayers', currentPlayers)} */}
            {/* {console.log('currentPlayers length', currentPlayers.length)} */}
            {showDetails && (
                <TournamentBracket
                    maxPlayers={currentPlayers}
                    tournamentId={clickedId}
                    tournamentStatus={tournamentStatus}
                    tournamentWinner={tournamentWinner}
                ></TournamentBracket>
            )}
        </div>
    );
};

export default TournamentList;
