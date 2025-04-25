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
    let tournamentObj = null;

    // let tournamentName = null;
    let maxTournamnetPlayers = 0;

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

    const addUserTournament = async (tourId, nickname, tournamentPlayers, maxPlayers) => {
        const user = await lookForUserId(nickname, 'full');
        const userId = await lookForUserId(nickname);

        const userResponse = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`,
            {
                method: 'GET'
            }
        );

        const data = await userResponse.json();
        // console.log('data', JSON.stringify(data));

        let userStars = data.stars;

        const lastRating = parseFloat(data.ratings.split(',').pop().trim()).toFixed(2);
        // console.log('lastRating', lastRating);

        let userRatings = lastRating;

        const userData = {
            name: user.name,
            stars: userStars,
            ratings: userRatings
        };
        //TODO: if live zherebievka => do not substitute. Do it at the start and shuffle then
        substituteTBDPlayer(user, tourId, userStars, userRatings);

        const response = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tourId}/players/.json`,
            {
                method: 'POST',
                body: JSON.stringify(userData),
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.ok && +Object.keys(tournamentPlayers).length === +maxPlayers - 1) {
            let tournamentStatusResponse = {};
            let tournamentStatusResponseModal = confirmWindow(
                `Are you sure you want to update tournament's status to 'Registration Finished'?`
            );
            if (tournamentStatusResponseModal) {
                tournamentStatusResponse = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tourId}/status.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify('Registration finished!'),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );
            }
        }
        window.location.reload();
    };

    const confirmWindow = (message) => {
        const response = window.confirm(message);
        if (response) {
            console.log('YES');
        } else {
            console.log('NO');
        }
        return response;
    };

    const substituteTBDPlayer = async (user, tournamentInternalId, playerStars, playerRatings) => {
        // Find the index of the first occurrence of 'TBD' team in the array
        const firstStagePairsResponse = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentInternalId}/bracket/playoffPairs/0.json`
        );

        const data = await firstStagePairsResponse.json();

        const indexes = data.reduce((acc, pair, idx) => {
            if (pair.team1 === 'TBD') {
                acc.push({ index: idx, team: 'team1' });
            }
            if (pair.team2 === 'TBD') {
                acc.push({ index: idx, team: 'team2' });
            }
            return acc;
        }, []);

        if (indexes.length > 0) {
            // Loop through all found indexes and substitute 'TBD' with the user
            const randomIndex = Math.floor(Math.random() * indexes.length);
            const { index, team } = indexes[randomIndex];

            // Substitute 'TBD' with the user at the randomly selected index
            if (team === 'team1') {
                data[index].team1 = user.name;
                data[index].stars1 = playerStars;
                data[index].ratings1 = playerRatings;
            } else {
                data[index].team2 = user.name;
                data[index].stars2 = playerStars;
                data[index].ratings2 = playerRatings;
            }

            try {
                const response = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentInternalId}/bracket/playoffPairs/0.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify(data),
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
        } else {
            // If 'TBD' team is not found, handle the case (e.g., display a message)
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

                    maxTournamnetPlayers = tournament.maxPlayers;
                    // maxPlayers = tournament.maxPlayers;
                    // console.log('Object.values(tournament.players)', Object.values(tournament.players));
                    // console.log('length 111', Object.values(tournament.players).length);
                    // currentPlayers = tournament.players ? tournament.players : {};
                    // tournamentName = tournament.name;
                    tournamentObj = tournament;

                    // console.log('tournament', tournament);

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
                            <p>Max players: {tournament.maxTournamnetPlayers}</p>
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
                                                addUserTournament(
                                                    tournament.id,
                                                    userNickName,
                                                    tournament.players,
                                                    tournament.maxPlayers
                                                )
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
                                        <button
                                            onClick={() =>
                                                addUserTournament(
                                                    tournament.id,
                                                    userNickName,
                                                    tournament.players,
                                                    tournament.maxPlayers
                                                )
                                            }
                                        >
                                            Register-2
                                        </button>
                                    )}
                                </>
                            )}
                            <p>Price Pull</p>

                            {tournament.status === 'Registration Started' &&
                                +tournament.maxPlayers !== +Object.keys(tournament.players).length && (
                                    <div>
                                        <label htmlFor="nickname">Player's Nickname</label>
                                        <input type="name" id="nickname" ref={nicknameRef} required />
                                        <button
                                            onClick={() =>
                                                addUserTournament(
                                                    tournament.id,
                                                    nicknameRef.current.value,
                                                    tournament.players,
                                                    tournament.maxPlayers
                                                )
                                            }
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
            <h2>Current Tournaments</h2>
            {tournamentList}
            {showDetails && (
                <TournamentBracket
                    maxPlayers={maxTournamnetPlayers}
                    tournamentId={clickedId}
                    tournamentStatus={tournamentStatus}
                    tournamentWinner={tournamentWinner}
                    // tournamentNameParam={tournamentName}
                ></TournamentBracket>
            )}
        </div>
    );
};

export default TournamentList;
