import { useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { lookForUserId, fetchLeaderboard } from '../../../api/api';
import { addCoins } from '../../../api/coinTransactions';
import AuthContext from '../../../store/auth-context';
import { getTournamentData } from '../../tournaments/tournament_api';
import Modal from '../../Modal/Modal';
import classes from './Tournaments.module.css';
import { TournamentBracket, renderPlayerList } from './tournamentsBracket';

const TournamentList = () => {
    const { tournamentId } = useParams();
    const [tournaments, setTournaments] = useState([]);
    const [clickedId, setClickedId] = useState([]);
    const [tournamentStatus, setTournamentStatus] = useState('');
    const [tournamentWinnersObject, setTournamentWinners] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    const [firstStagePairs, setFirstStagePairs] = useState([]);
    // const [selectedTournament, setSelectedTournament] = useState(null);
    const [showPlayers, setShowPlayers] = useState(false); // State to toggle visibility
    const [statusFilter, setStatusFilter] = useState('started');
    const authCtx = useContext(AuthContext);
    let { userNickName, isLogged } = authCtx;

    const toggleShowPlayers = (competitionId) => {
        setShowPlayers((prev) => {
            const updatedState = {
                ...prev,
                [competitionId]: !prev[competitionId]
            };
            return updatedState;
        });
    };

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

    // Auto-open tournament details if tournamentId is in URL
    useEffect(() => {
        if (tournamentId && tournaments.length > 0) {
            const tournament = tournaments.find((t) => t.id === tournamentId);
            if (tournament) {
                setClickedId(tournamentId);
                setShowDetails(true);
                setTournamentStatus(tournament.status);
                setTournamentWinners(tournament.winners || '');
            }
        }
    }, [tournamentId, tournaments]);

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

        let userStars = data.stars;

        const lastRating = parseFloat(data.ratings.split(',').pop().trim()).toFixed(2);

        let userRatings = lastRating;

        let placeInLeaderboard = await fetchLeaderboard(data);

        const userData = {
            name: user.name,
            stars: userStars,
            ratings: userRatings,
            placeInLeaderboard: placeInLeaderboard
        };

        let tournamentData = await getTournamentData(tourId);

        if (tournamentData.preparedBracket) {
            substituteTBDPlayer(user, tourId, userStars, userRatings);
        } else {
            console.log('Tournament does not have a prepared bracket.');
        }

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

        // Award coins for tournament registration
        if (response.ok) {
            try {
                await addCoins(
                    userId,
                    2,
                    'tournament_registration',
                    `Registered for tournament: ${tournamentData.name}`,
                    { tournamentId: tourId, tournamentName: tournamentData.name }
                );
                authCtx.setNotificationShown(
                    true,
                    'Success! You received 2 coins for tournament registration!',
                    'success',
                    5
                );
            } catch (error) {
                console.error('Error awarding registration coins:', error);
            }
        }

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

    const fillTournamentWithRandomPlayers = async (tourId, tournamentPlayers, maxPlayers) => {
        try {
            // Get all users from database
            const usersResponse = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
            const allUsers = await usersResponse.json();

            if (!allUsers) {
                alert('No users found in database');
                return;
            }

            // Get current tournament players
            const currentPlayerNames = Object.values(tournamentPlayers)
                .filter((player) => player !== null)
                .map((player) => player.name);

            console.log('Current tournament players:', currentPlayerNames);
            console.log('All users in database:', allUsers);

            // Filter eligible users: not in tournament and have at least 1 game played
            const eligibleUsers = Object.entries(allUsers)
                .filter(([userId, user]) => {
                    if (!user || !user.enteredNickname) return false;

                    // Check if already in tournament
                    if (currentPlayerNames.includes(user.enteredNickname)) return false;

                    // Check if has at least 1 game played
                    console.log('User games user:', user);
                    const totalGames = user.gamesPlayed?.heroes3?.total || 0;
                    return totalGames >= 1;
                })
                .map(([userId, user]) => ({
                    userId,
                    name: user.enteredNickname,
                    stars: user.stars || 0,
                    ratings: user.ratings || '0',
                    gamesPlayed: user.gamesPlayed
                }));

            if (eligibleUsers.length === 0) {
                alert('No eligible players found (must have at least 1 game played and not already in tournament)');
                return;
            }

            // Calculate how many players we need to add
            const spotsToFill = maxPlayers - Object.keys(tournamentPlayers).length;

            if (spotsToFill <= 0) {
                alert('Tournament is already full');
                return;
            }

            const playersToAdd = Math.min(spotsToFill, eligibleUsers.length);

            const confirm = confirmWindow(
                `Found ${eligibleUsers.length} eligible players.\nAdd ${playersToAdd} random players to fill the tournament?`
            );

            if (!confirm) return;

            // Shuffle and select random players
            const shuffled = [...eligibleUsers].sort(() => Math.random() - 0.5);
            const selectedPlayers = shuffled.slice(0, playersToAdd);

            // Add each selected player
            for (const player of selectedPlayers) {
                const lastRating = parseFloat(player.ratings.split(',').pop().trim()).toFixed(2);
                const placeInLeaderboard = await fetchLeaderboard(player.gamesPlayed);

                const userData = {
                    name: player.name,
                    stars: player.stars,
                    ratings: lastRating,
                    placeInLeaderboard: placeInLeaderboard
                };

                // Add to tournament
                await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tourId}/players/.json`,
                    {
                        method: 'POST',
                        body: JSON.stringify(userData),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                // Check if tournament has prepared bracket and substitute TBD
                const tournamentData = await getTournamentData(tourId);
                if (tournamentData.preparedBracket) {
                    await substituteTBDPlayer({ name: player.name }, tourId, player.stars, lastRating);
                }
            }

            // Check if tournament is now full and update status
            const newPlayerCount = Object.keys(tournamentPlayers).length + playersToAdd;
            console.log('newPlayerCount: ' + newPlayerCount);
            console.log('maxPlayers: ' + maxPlayers);
            console.log('maxPlayers type:', typeof maxPlayers);
            console.log('Comparison result:', newPlayerCount === maxPlayers);
            console.log('Comparison result (number):', newPlayerCount === +maxPlayers);

            if (newPlayerCount === +maxPlayers) {
                console.log('Updating status to Registration finished!');
                const statusResponse = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tourId}/status.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify('Registration finished!'),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );
                console.log('Status update response:', statusResponse.ok, statusResponse.status);
                if (statusResponse.ok) {
                    console.log('Status successfully updated to Registration finished!');
                } else {
                    console.error('Failed to update status:', await statusResponse.text());
                }
                alert(`Successfully added ${playersToAdd} players! Tournament is now full and ready to start.`);
            } else {
                alert(`Successfully added ${playersToAdd} players to the tournament!`);
            }
            window.location.reload();
        } catch (error) {
            console.error('Error filling tournament with random players:', error);
            alert('Error adding players to tournament');
        }
    };

    const closeModalHandler = () => {
        setShowDetails(false);
        // setSelectedTournament(null);
    };

    const substituteTBDPlayer = async (user, tournamentInternalId, playerStars, playerRatings) => {
        // Find the index of the first occurrence of 'TBD' team in the array
        const firstStagePairsResponse = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentInternalId}/bracket/playoffPairs/0.json`
        );

        const data = await firstStagePairsResponse.json();

        if (data) {
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
        } else {
            console.log(`No data found for tournament ID: ${tournamentInternalId}`);
        }
    };

    // const showDetailsHandler = (tournament) => {
    //     setSelectedTournament(tournament);
    //     setShowDetails(true);
    // };

    const showDetailsHandler = async (currentTournamentStatus, currentTournamentWinnersObject, currentTournamentId) => {
        // console.log('currentTournamentWinner', currentTournamentWinnersObject);

        setClickedId(currentTournamentId);
        setShowDetails((prevState) => !prevState);
        setTournamentStatus(currentTournamentStatus);
        setTournamentWinners(currentTournamentWinnersObject);
    };

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

    const filteredTournaments = tournaments.filter((tournament) => {
        if (statusFilter === 'all') {
            return true;
        }
        if (statusFilter === 'registration') {
            return tournament.status === 'Registration' || tournament.status === 'Registration Started';
        }
        if (statusFilter === 'started') {
            return tournament.status === 'Started!';
        }
        if (statusFilter === 'finished') {
            return tournament.status.includes('Finished');
        }
        if (statusFilter === 'live') {
            return hasLiveGames(tournament);
        }
        return true;
    });

    const tournamentList =
        tournaments.length > 0 ? (
            <ul className={classes.tournamentList}>
                {filteredTournaments
                    .sort((a, b) => {
                        const statusOrder = {
                            'Registration Started': 1,
                            Registration: 1,
                            'Started!': 2,
                            'Tournament Finished': 3
                        };
                        const statusDiff = (statusOrder[a.status] || 999) - (statusOrder[b.status] || 999);
                        if (statusDiff !== 0) {
                            return statusDiff;
                        }
                        return new Date(b.date) - new Date(a.date);
                    })
                    .map((tournament) => {
                        maxTournamnetPlayers = tournament.maxPlayers;

                        const getStatusClass = (status) => {
                            if (status === 'Registration' || status.includes('Registration')) return 'registration';
                            if (status === 'Started!') return 'started';
                            if (status.includes('Finished')) return 'finished';
                            return '';
                        };

                        const getMedalEmoji = (place) => {
                            if (place === '1st' || place === '1') return '🥇';
                            if (place === '2nd' || place === '2') return '🥈';
                            if (place === '3rd' || place === '3') return '🥉';
                            return '🏅';
                        };

                        return (
                            <li key={tournament.id} className={classes.bracket}>
                                <h3 className={classes.tournamentTitle}>{`${tournament.name} (${tournament.date})`}</h3>
                                <div className={`${classes.statusBadge} ${classes[getStatusClass(tournament.status)]}`}>
                                    {tournament.status}
                                </div>
                                <div className={classes.infoGrid}>
                                    <div className={classes.infoItem}>
                                        <p>
                                            <strong>{Object.values(tournament.players).length}</strong> /{' '}
                                            {maxTournamnetPlayers}
                                        </p>
                                        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                                            Players Registered
                                        </p>
                                    </div>
                                    <div className={classes.infoItem}>
                                        <p>
                                            <strong>{maxTournamnetPlayers}</strong>
                                        </p>
                                        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                                            Max Players
                                        </p>
                                    </div>
                                    {tournament.winner && tournament.status.includes('Finished') && (
                                        <div className={classes.infoItem} style={{ gridColumn: '1 / -1' }}>
                                            <div className={classes.winnersPreview}>
                                                {Object.entries(tournament.winners)
                                                    .slice(0, 3)
                                                    .map(([place, winner]) => (
                                                        <div key={place} className={classes.winnerPreviewItem}>
                                                            <span className={classes.medal}>
                                                                {getMedalEmoji(place)}
                                                            </span>
                                                            <span className={classes.winnerName}>{winner}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className={classes.playersSection}>
                                    <div className={classes.playersHeader}>
                                        <button
                                            className={`${classes.btn} ${classes.btnToggle}`}
                                            onClick={() => toggleShowPlayers(tournament.id)}
                                        >
                                            {showPlayers[tournament.id] ? '👥 Hide Players' : '👥 Show Players'}
                                        </button>
                                    </div>
                                    {showPlayers[tournament.id] && 'players' in tournament && (
                                        <ul className={classes.playersList}>
                                            {Object.values(tournament.players)
                                                .filter(
                                                    (player) =>
                                                        player !== null &&
                                                        player.name !== undefined &&
                                                        player.name.trim() !== ''
                                                )
                                                .map((player, index) => (
                                                    <li key={index}>{player.name}</li>
                                                ))}
                                        </ul>
                                    )}
                                </div>

                                <div className={classes.actionButtons}>
                                    <button
                                        className={`${classes.btn} ${classes.btnPrimary}`}
                                        onClick={() =>
                                            showDetailsHandler(tournament.status, tournament.winners, tournament.id)
                                        }
                                    >
                                        🏆 View Bracket
                                    </button>

                                    {'players' in tournament &&
                                    Object.keys(tournament.players).length < tournament.maxPlayers ? (
                                        checkRegisterUser(userNickName, tournament.players) ? (
                                            <div className={classes.registeredBadge}>✓ You are registered!</div>
                                        ) : (
                                            isLogged && (
                                                <button
                                                    className={classes.btn}
                                                    onClick={() =>
                                                        addUserTournament(
                                                            tournament.id,
                                                            userNickName,
                                                            tournament.players,
                                                            tournament.maxPlayers
                                                        )
                                                    }
                                                >
                                                    📝 Register Now
                                                </button>
                                            )
                                        )
                                    ) : null}
                                </div>

                                {'players' in tournament ? (
                                    showDetails && renderPlayerList(tournament.players)
                                ) : (
                                    <>
                                        <p style={{ color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>
                                            No players registered yet.
                                        </p>
                                        {isLogged &&
                                            +tournament.maxPlayers !== +Object.keys(tournament.players).length && (
                                                <button
                                                    className={classes.btn}
                                                    onClick={() =>
                                                        addUserTournament(
                                                            tournament.id,
                                                            userNickName,
                                                            tournament.players,
                                                            tournament.maxPlayers
                                                        )
                                                    }
                                                >
                                                    📝 Be the First to Register
                                                </button>
                                            )}
                                    </>
                                )}
                                {tournament.status === 'Registration Started' &&
                                    +tournament.maxPlayers !== +Object.keys(tournament.players).length && (
                                        <div className={classes.inputGroup}>
                                            <label htmlFor="nickname">Player's Nickname</label>
                                            <input type="name" id="nickname" ref={nicknameRef} required />
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <button
                                                    className={classes.btn}
                                                    onClick={() =>
                                                        addUserTournament(
                                                            tournament.id,
                                                            nicknameRef.current.value,
                                                            tournament.players,
                                                            tournament.maxPlayers
                                                        )
                                                    }
                                                >
                                                    ➕ Add Player
                                                </button>
                                                <button
                                                    className={classes.btn}
                                                    style={{
                                                        background: 'linear-gradient(135deg, #ff6b6b, #ee5a6f)',
                                                        border: '2px solid #ff6b6b'
                                                    }}
                                                    onClick={() =>
                                                        fillTournamentWithRandomPlayers(
                                                            tournament.id,
                                                            tournament.players,
                                                            tournament.maxPlayers
                                                        )
                                                    }
                                                >
                                                    🎲 Fill with Random Players
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                {tournament.status === 'Registration finished!' && (
                                    <div
                                        style={{
                                            padding: '1rem',
                                            background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            marginTop: '1rem'
                                        }}
                                    >
                                        <p
                                            style={{
                                                margin: '0 0 0.5rem 0',
                                                color: '#1a1a2e',
                                                fontWeight: 'bold',
                                                fontSize: '1.1rem'
                                            }}
                                        >
                                            ✅ Tournament is Full!
                                        </p>
                                        <button
                                            className={`${classes.btn} ${classes.btnPrimary}`}
                                            style={{
                                                background: 'linear-gradient(135deg, #4caf50, #45a049)',
                                                border: '2px solid #4caf50',
                                                fontSize: '1.1rem',
                                                padding: '0.75rem 1.5rem'
                                            }}
                                            onClick={() =>
                                                showDetailsHandler(tournament.status, tournament.winners, tournament.id)
                                            }
                                        >
                                            🎮 Start Tournament
                                        </button>
                                    </div>
                                )}

                                {!tournament.status.includes('Finished') ? (
                                    <div className={classes.prizePool}>
                                        <h4>💰 Prize Pool</h4>
                                        {Object.entries(tournament.pricePull).map(([place, prize]) => (
                                            <div key={place} className={classes.prizeItem}>
                                                <span className={classes.medal}>{getMedalEmoji(place)}</span>
                                                <span className={classes.prizePlace}>{place}:</span>
                                                <span className={classes.prizeAmount}>${prize}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    tournament.winners && (
                                        <div className={classes.winnersSection}>
                                            <h4>🏆 Tournament Winners</h4>
                                            {Object.entries(tournament.winners).map(([place, winner]) => {
                                                // Find prize amount by matching the place key (case-insensitive)
                                                let prize = null;
                                                if (tournament.pricePull) {
                                                    // Try exact match first
                                                    prize = tournament.pricePull[place];
                                                    // If not found, try case-insensitive match
                                                    if (!prize) {
                                                        const prizeKey = Object.keys(tournament.pricePull).find(
                                                            (key) => key.toLowerCase() === place.toLowerCase()
                                                        );
                                                        prize = prizeKey ? tournament.pricePull[prizeKey] : null;
                                                    }
                                                }
                                                return (
                                                    <div key={place} className={classes.winnerItem}>
                                                        <span className={classes.medalLarge}>
                                                            {getMedalEmoji(place)}
                                                        </span>
                                                        <span className={classes.placeLabel}>{place}</span>
                                                        <span className={classes.winnerNameLarge}>
                                                            {winner}
                                                            {prize && (
                                                                <span className={classes.prizeInBrackets}>
                                                                    {' '}
                                                                    (${prize})
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                )}
                            </li>
                        );
                    })}
            </ul>
        ) : (
            <div className={classes.noTournaments}>No current tournaments available</div>
        );

    return (
        <div className={classes.tournamentContainer}>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem'
                }}
            >
                <h2 style={{ margin: 0, flex: 1 }} className={classes.tournamentHeader}>
                    Current Tournaments
                </h2>
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
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        minWidth: '200px',
                        flexShrink: 0
                    }}
                >
                    <option value="all" style={{ background: '#1a1a2e', color: '#00ffff' }}>
                        All Tournaments
                    </option>
                    <option value="registration" style={{ background: '#1a1a2e', color: '#00ffff' }}>
                        📝 Registration Open
                    </option>
                    <option value="started" style={{ background: '#1a1a2e', color: '#00ffff' }}>
                        🎮 In Progress
                    </option>
                    <option value="live" style={{ background: '#1a1a2e', color: '#00ffff' }}>
                        🔴 Live Games
                    </option>
                    <option value="finished" style={{ background: '#1a1a2e', color: '#00ffff' }}>
                        🏆 Finished
                    </option>
                </select>
            </div>
            {tournamentList}
            {showDetails && (
                <Modal onClose={closeModalHandler}>
                    <TournamentBracket
                        maxPlayers={maxTournamnetPlayers}
                        tournamentId={clickedId}
                        tournamentStatus={tournamentStatus}
                        tournamentWinners={tournamentWinnersObject}
                        // tournamentNameParam={tournamentName}
                    ></TournamentBracket>
                </Modal>
            )}
        </div>
    );
};

export default TournamentList;
