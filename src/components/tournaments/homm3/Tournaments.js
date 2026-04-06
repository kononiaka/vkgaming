import { useContext, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { lookForUserId, fetchLeaderboard, snapshotLeaderboardRanks } from '../../../api/api';
import { addCoins } from '../../../api/coinTransactions';
import AuthContext from '../../../store/auth-context';
import { getTournamentData } from '../../tournaments/tournament_api';
import Modal from '../../Modal/Modal';
import SpinningWheel from '../../SpinningWheel/SpinningWheel';
import classes from './Tournaments.module.css';
import { TournamentBracket, renderPlayerList } from './tournamentsBracket';

const TournamentList = () => {
    const { tournamentId } = useParams();
    const [searchParams] = useSearchParams();
    const [tournaments, setTournaments] = useState([]);
    const [clickedId, setClickedId] = useState([]);
    const [tournamentStatus, setTournamentStatus] = useState('');
    const [tournamentWinnersObject, setTournamentWinners] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    // const [selectedTournament, setSelectedTournament] = useState(null);
    const [showPlayers, setShowPlayers] = useState(false); // State to toggle visibility
    const [statusFilter, setStatusFilter] = useState(() => {
        // Pre-initialise from URL so the fetch-based default respects it
        const params = new URLSearchParams(window.location.search);
        const param = params.get('status');
        const allowed = ['all', 'registration', 'registrationFinished', 'started', 'live', 'finished'];
        return param && allowed.includes(param) ? param : null;
    });
    const [showSpinningWheel, setShowSpinningWheel] = useState(false);
    const [tournamentPlayers, setTournamentPlayers] = useState({});
    const [allPlayerNicknames, setAllPlayerNicknames] = useState([]);
    const [nicknameQuery, setNicknameQuery] = useState('');
    const [nicknameSuggestions, setNicknameSuggestions] = useState([]);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const [addingPlayerTournamentId, setAddingPlayerTournamentId] = useState(null);
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

    const normalizeMatchType = (rawType) => {
        const normalized = String(rawType ?? '')
            .toLowerCase()
            .trim();
        if (normalized === 'bo-3' || normalized === '3' || normalized === 'bo3') {
            return 'bo-3';
        }
        return 'bo-1';
    };

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
                // Set default filter: 'started' if any in-progress tournament exists, else 'finished'
                setStatusFilter((prev) => {
                    if (prev !== null) {
                        return prev;
                    } // already set (e.g. from URL param)
                    const hasInProgress = tournamentList.some((t) => t.status === 'Started!');
                    return hasInProgress ? 'started' : 'finished';
                });
                // (no post-fetch setup needed)
            } else {
                console.error('Failed to fetch tournaments:', data);
            }
        } catch (error) {
            console.error('Error fetching tournaments:', error);
        }
    };

    const fetchAllPlayerNicknames = async () => {
        try {
            const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
            const data = await response.json();
            if (!response.ok || !data) {
                setAllPlayerNicknames([]);
                return;
            }

            const nicknames = Object.values(data)
                .map((user) => user?.enteredNickname)
                .filter((nickname) => typeof nickname === 'string' && nickname.trim() !== '');

            setAllPlayerNicknames([...new Set(nicknames)]);
        } catch (error) {
            console.error('Error fetching player nicknames:', error);
            setAllPlayerNicknames([]);
        }
    };

    const updateNicknameSuggestions = (value, tournamentPlayersObj) => {
        const query = value.trim().toLowerCase();
        if (!query) {
            setNicknameSuggestions([]);
            setActiveSuggestionIndex(-1);
            return;
        }

        const alreadyRegistered = new Set(
            Object.values(tournamentPlayersObj || {})
                .filter((player) => player && player.name)
                .map((player) => player.name.toLowerCase())
        );

        const filtered = allPlayerNicknames
            .filter(
                (nickname) => nickname.toLowerCase().includes(query) && !alreadyRegistered.has(nickname.toLowerCase())
            )
            .slice(0, 8);

        setNicknameSuggestions(filtered);
        setActiveSuggestionIndex(filtered.length > 0 ? 0 : -1);
    };

    const handleNicknameKeyDown = (event, tournament) => {
        if (!nicknameSuggestions.length) {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveSuggestionIndex((prev) => {
                const next = prev < nicknameSuggestions.length - 1 ? prev + 1 : 0;
                return next;
            });
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveSuggestionIndex((prev) => {
                const next = prev > 0 ? prev - 1 : nicknameSuggestions.length - 1;
                return next;
            });
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            const selectedByDefault =
                activeSuggestionIndex >= 0 ? nicknameSuggestions[activeSuggestionIndex] : nicknameSuggestions[0];
            if (selectedByDefault) {
                setNicknameQuery(selectedByDefault);
                setNicknameSuggestions([]);
                setActiveSuggestionIndex(-1);
                addUserTournament(tournament.id, selectedByDefault, tournament.players, tournament.maxPlayers, {
                    isAdminManagedAdd: true
                });
                return;
            }

            const selectedNickname = nicknameQuery.trim();
            if (!selectedNickname) {
                return;
            }

            addUserTournament(tournament.id, selectedNickname, tournament.players, tournament.maxPlayers, {
                isAdminManagedAdd: true
            });
        }
    };

    useEffect(() => {
        fetchTournaments();
        fetchAllPlayerNicknames();
    }, []);

    useEffect(() => {
        const statusParam = searchParams.get('status');
        const allowed = ['all', 'registration', 'registrationFinished', 'started', 'live', 'finished'];
        if (statusParam && allowed.includes(statusParam)) {
            setStatusFilter(statusParam);
        }
    }, [searchParams]);

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

    const addUserTournament = async (
        tourId,
        nickname,
        currentTournamentPlayers,
        maxPlayers,
        options = { isAdminManagedAdd: false }
    ) => {
        if (addingPlayerTournamentId === tourId) {
            return;
        }

        setAddingPlayerTournamentId(tourId);

        try {
            const normalizedNickname = (nickname || '').trim();
            if (!normalizedNickname) {
                authCtx.setNotificationShown(true, 'Please enter a player nickname.', 'error', 4);
                return;
            }

            // Resolve nickname case-insensitively to avoid null lookups when casing differs.
            const matchedNickname =
                allPlayerNicknames.find((n) => n.toLowerCase() === normalizedNickname.toLowerCase()) ||
                normalizedNickname;

            const user = await lookForUserId(matchedNickname, 'full');
            const userId = await lookForUserId(matchedNickname);

            if (!userId || !user) {
                authCtx.setNotificationShown(true, `Player "${normalizedNickname}" was not found.`, 'error', 5);
                return;
            }

            const userResponse = await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`,
                {
                    method: 'GET'
                }
            );

            const data = await userResponse.json();

            if (!data) {
                authCtx.setNotificationShown(true, `Player "${matchedNickname}" has invalid profile data.`, 'error', 5);
                return;
            }

            let userStars = data.stars ?? 0;

            const lastRating = data.ratings
                ? parseFloat(data.ratings.split(',').pop().trim()).toFixed(2)
                : parseFloat(0).toFixed(2);

            let userRatings = lastRating;

            let placeInLeaderboard = await fetchLeaderboard(data);

            const userData = {
                name: user.name || matchedNickname,
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

            const isSelfRegistration =
                !!authCtx.userNickName && matchedNickname.toLowerCase() === authCtx.userNickName.toLowerCase();
            const shouldAwardRegistrationCoins = response.ok && isSelfRegistration && !options.isAdminManagedAdd;

            // Award coins only when user registers themselves, not when admin manages entries.
            if (shouldAwardRegistrationCoins) {
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

            if (response.ok && +Object.keys(currentTournamentPlayers).length === +maxPlayers - 1) {
                const tournamentStatusResponseModal = confirmWindow(
                    `Are you sure you want to update tournament's status to 'Registration Finished'?`
                );
                if (tournamentStatusResponseModal) {
                    const tournamentStatusResponse = await fetch(
                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tourId}/status.json`,
                        {
                            method: 'PUT',
                            body: JSON.stringify('Registration finished!'),
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    if (tournamentStatusResponse.ok) {
                        authCtx.setNotificationShown(
                            true,
                            'Tournament status updated to Registration Finished!',
                            'success',
                            4
                        );
                    } else {
                        authCtx.setNotificationShown(true, 'Failed to update tournament status.', 'error', 5);
                    }
                }
            }

            // Do not hard-reload the page: it clears notification state before the toast is shown.
            setNicknameQuery('');
            setNicknameSuggestions([]);
            setActiveSuggestionIndex(-1);
            await fetchTournaments();
        } finally {
            setAddingPlayerTournamentId(null);
        }
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

    const fillTournamentWithRandomPlayers = async (tourId, currentTournamentPlayers, maxPlayers) => {
        try {
            // Get all users from database
            const usersResponse = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
            const allUsers = await usersResponse.json();

            if (!allUsers) {
                alert('No users found in database');
                return;
            }

            // Get current tournament players
            const currentPlayerNames = Object.values(currentTournamentPlayers)
                .filter((player) => player !== null)
                .map((player) => player.name);

            console.log('Current tournament players:', currentPlayerNames);
            console.log('All users in database:', allUsers);

            // Filter eligible users: not in tournament and have at least 1 game played
            const eligibleUsers = Object.entries(allUsers)
                .filter(([, user]) => {
                    if (!user || !user.enteredNickname) {
                        return false;
                    }

                    // Check if already in tournament
                    if (currentPlayerNames.includes(user.enteredNickname)) {
                        return false;
                    }

                    // Check if has at least 1 game played
                    console.log('User games user:', user);
                    const totalGames = user.gamesPlayed?.heroes3?.total || 0;
                    return totalGames >= 1;
                })
                .map(([, user]) => ({
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
            const spotsToFill = maxPlayers - Object.keys(currentTournamentPlayers).length;

            if (spotsToFill <= 0) {
                alert('Tournament is already full');
                return;
            }

            const playersToAdd = Math.min(spotsToFill, eligibleUsers.length);

            const confirm = confirmWindow(
                `Found ${eligibleUsers.length} eligible players.\nAdd ${playersToAdd} random players to fill the tournament?`
            );

            if (!confirm) {
                return;
            }

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
            const newPlayerCount = Object.keys(currentTournamentPlayers).length + playersToAdd;
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
        setShowSpinningWheel(false);
        // setSelectedTournament(null);
    };

    const handleStartTournament = async (preBracketPairs) => {
        // This will be called when spinning wheel completes

        const isBracketComplete = preBracketPairs.every((pair) => pair[0] !== 'TBD' && pair[1] !== 'TBD');

        if (!isBracketComplete) {
            console.error('Bracket is not complete. Please fill all slots.');
            alert('Bracket is not complete. Please fill all slots.');
            return;
        }

        try {
            // Get tournament data
            const tournamentResponseGET = await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${clickedId}/.json`,
                {
                    method: 'GET'
                }
            );

            if (!tournamentResponseGET.ok) {
                throw new Error('Failed to fetch tournament data');
            }

            const tournamentData = await tournamentResponseGET.json();
            const maxPlayers = tournamentData.maxPlayers;
            const tournamentPlayoffGamesRaw = tournamentData.tournamentPlayoffGames || 'bo-1';
            const gameType = normalizeMatchType(tournamentPlayoffGamesRaw);
            const players = tournamentData.players;

            // Calculate stage labels based on maxPlayers
            let currentStageLabels = [];
            if (+maxPlayers === 4) {
                currentStageLabels = ['Semi-final', 'Third Place', 'Final'];
            } else if (+maxPlayers === 8) {
                currentStageLabels = ['Quarter-final', 'Semi-final', 'Third Place', 'Final'];
            } else if (+maxPlayers === 16) {
                currentStageLabels = ['1/8 Final', 'Quarter-final', 'Semi-final', 'Third Place', 'Final'];
            } else if (+maxPlayers === 32) {
                currentStageLabels = ['1/16 Final', '1/8 Final', 'Quarter-final', 'Semi-final', 'Third Place', 'Final'];
            }

            // Determine number of games based on bo-1 or bo-3
            const numGames = gameType === 'bo-3' ? 3 : 1;

            // Format bracket pairs with player data
            const formattedBracket = preBracketPairs.map((pair) => {
                const player1 = Object.values(players).find((p) => p.name === pair[0]);
                const player2 = Object.values(players).find((p) => p.name === pair[1]);

                // Get the latest ratings as strings
                const ratings1 = player1?.ratings
                    ? typeof player1.ratings === 'string' && player1.ratings.includes(',')
                        ? player1.ratings.split(',').pop().trim()
                        : String(player1.ratings)
                    : '0';

                const ratings2 = player2?.ratings
                    ? typeof player2.ratings === 'string' && player2.ratings.includes(',')
                        ? player2.ratings.split(',').pop().trim()
                        : String(player2.ratings)
                    : '0';

                // Create games array
                const games = Array.from({ length: numGames }, (_, index) => ({
                    castle1: '',
                    castle2: '',
                    castleWinner: '',
                    gameId: index,
                    gameStatus: 'Not Started',
                    gameWinner: '',
                    color1: 'red',
                    color2: 'blue',
                    gold1: 0,
                    gold2: 0,
                    restart1_111: 0,
                    restart1_112: 0,
                    restart2_111: 0,
                    restart2_112: 0
                }));

                return {
                    gameStatus: 'Not Started',
                    games: games,
                    ratings1: ratings1,
                    ratings2: ratings2,
                    score1: 0,
                    score2: 0,
                    stage: currentStageLabels[0] || 'Quarter-final',
                    stars1: player1?.stars || 0,
                    stars2: player2?.stars || 0,
                    team1: pair[0],
                    team2: pair[1],
                    type: gameType,
                    winner: null,
                    color1: 'red',
                    color2: 'blue'
                };
            });

            // Create the full bracket structure with all stages
            const fullBracketStructure = [formattedBracket]; // Stage 0

            // Add empty stages for Semi-final, Third Place, and Final
            for (let i = 1; i < currentStageLabels.length; i++) {
                const stageGames = [];
                let pairsInStage;

                // Determine number of pairs based on stage
                const stageName = currentStageLabels[i];
                if (stageName === 'Semi-final') {
                    pairsInStage = 2;
                } else if (stageName === 'Third Place' || stageName === 'Final') {
                    pairsInStage = 1;
                } else if (stageName === 'Quarter-final') {
                    pairsInStage = 4;
                } else if (stageName === '1/8 Final') {
                    pairsInStage = 8;
                } else if (stageName === '1/16 Final') {
                    pairsInStage = 16;
                } else {
                    pairsInStage = 1;
                }

                for (let j = 0; j < pairsInStage; j++) {
                    const emptyGames = Array.from({ length: numGames }, (_, index) => ({
                        castle1: '',
                        castle2: '',
                        castleWinner: '',
                        gameId: index,
                        gameStatus: 'Not Started',
                        gameWinner: '',
                        color1: 'red',
                        color2: 'blue',
                        gold1: 0,
                        gold2: 0,
                        restart1_111: 0,
                        restart1_112: 0,
                        restart2_111: 0,
                        restart2_112: 0
                    }));

                    stageGames.push({
                        gameStatus: 'Not Started',
                        games: emptyGames,
                        ratings1: null,
                        ratings2: null,
                        score1: 0,
                        score2: 0,
                        stage: currentStageLabels[i],
                        stars1: null,
                        stars2: null,
                        team1: 'TBD',
                        team2: 'TBD',
                        type: gameType,
                        winner: null,
                        color1: 'red',
                        color2: 'blue'
                    });
                }

                fullBracketStructure.push(stageGames);
            }

            console.log('Full bracket structure to be posted:', fullBracketStructure);

            // Post the bracket structure to the database
            const bracketResponse = await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${clickedId}/bracket/playoffPairs.json`,
                {
                    method: 'PUT',
                    body: JSON.stringify(fullBracketStructure),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!bracketResponse.ok) {
                throw new Error('Failed to update tournament bracket');
            }

            console.log('Tournament Bracket Updated successfully!');

            // Update tournament status to "Started!"
            await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${clickedId}/status.json`,
                {
                    method: 'PUT',
                    body: JSON.stringify('Started!'),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('Tournament status updated to Started!');

            // Snapshot leaderboard rankings at the start of the tournament
            try {
                const snapshotResult = await snapshotLeaderboardRanks();
                if (snapshotResult.success) {
                    console.log(
                        `Leaderboard snapshot taken at tournament start: ${snapshotResult.successCount} players, ${snapshotResult.errorCount} errors`
                    );
                } else {
                    console.error('Failed to snapshot leaderboard at tournament start:', snapshotResult.error);
                }
            } catch (error) {
                console.error('Error during leaderboard snapshot at tournament start:', error);
            }

            // Close spinning wheel and reload to show bracket
            setShowSpinningWheel(false);
            window.location.reload();
        } catch (error) {
            console.error('Error updating tournament status:', error);
            alert('Error starting tournament');
        }
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

    const showDetailsHandler = async (
        currentTournamentStatus,
        currentTournamentWinnersObject,
        currentTournamentId,
        tournament = null
    ) => {
        // console.log('currentTournamentWinner', currentTournamentWinnersObject);

        setClickedId(currentTournamentId);
        setTournamentStatus(currentTournamentStatus);
        setTournamentWinners(currentTournamentWinnersObject);

        // Check if this is a "Registration finished!" status and tournament has randomBracket enabled
        if (currentTournamentStatus === 'Registration finished!' && tournament && tournament.randomBracket) {
            // Show spinning wheel directly
            setTournamentPlayers(tournament.players || {});
            setShowSpinningWheel(true);
        } else {
            // Show bracket modal
            setShowDetails((prevState) => !prevState);
        }
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
        if (statusFilter === null) {
            return false;
        } // still loading default
        if (statusFilter === 'all') {
            return true;
        }
        if (statusFilter === 'registration') {
            return tournament.status === 'Registration' || tournament.status === 'Registration Started';
        }
        if (statusFilter === 'registrationFinished') {
            return tournament.status === 'Registration finished!';
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
                            if (status === 'Registration' || status.includes('Registration')) {
                                return 'registration';
                            }
                            if (status === 'Started!') {
                                return 'started';
                            }
                            if (status.includes('Finished')) {
                                return 'finished';
                            }
                            return '';
                        };

                        const getMedalEmoji = (place) => {
                            if (place === '1st' || place === '1') {
                                return '🥇';
                            }
                            if (place === '2nd' || place === '2') {
                                return '🥈';
                            }
                            if (place === '3rd' || place === '3') {
                                return '🥉';
                            }
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
                                            showDetailsHandler(
                                                tournament.status,
                                                tournament.winners,
                                                tournament.id,
                                                tournament
                                            )
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
                                {authCtx.isAdmin &&
                                    tournament.status === 'Registration Started' &&
                                    +tournament.maxPlayers !== +Object.keys(tournament.players).length && (
                                        <div className={classes.inputGroup}>
                                            <label htmlFor="nickname">Player's Nickname</label>
                                            <input
                                                type="text"
                                                id="nickname"
                                                ref={nicknameRef}
                                                value={nicknameQuery}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setNicknameQuery(value);
                                                    updateNicknameSuggestions(value, tournament.players);
                                                }}
                                                onFocus={() =>
                                                    updateNicknameSuggestions(nicknameQuery, tournament.players)
                                                }
                                                onKeyDown={(e) => handleNicknameKeyDown(e, tournament)}
                                                onBlur={() => {
                                                    setTimeout(() => {
                                                        setNicknameSuggestions([]);
                                                        setActiveSuggestionIndex(-1);
                                                    }, 120);
                                                }}
                                                autoComplete="off"
                                                required
                                            />
                                            {nicknameSuggestions.length > 0 && (
                                                <div
                                                    style={{
                                                        marginTop: '0.4rem',
                                                        border: '1px solid rgba(0, 255, 255, 0.3)',
                                                        borderRadius: '8px',
                                                        background: 'rgba(10, 20, 40, 0.95)',
                                                        maxHeight: '180px',
                                                        overflowY: 'auto'
                                                    }}
                                                >
                                                    {nicknameSuggestions.map((nickname, index) => (
                                                        <button
                                                            key={nickname}
                                                            type="button"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                setNicknameQuery(nickname);
                                                                setNicknameSuggestions([]);
                                                                setActiveSuggestionIndex(-1);
                                                            }}
                                                            onMouseEnter={() => setActiveSuggestionIndex(index)}
                                                            style={{
                                                                display: 'block',
                                                                width: '100%',
                                                                textAlign: 'left',
                                                                padding: '0.5rem 0.75rem',
                                                                border: 'none',
                                                                background:
                                                                    index === activeSuggestionIndex
                                                                        ? 'rgba(0, 255, 255, 0.18)'
                                                                        : 'transparent',
                                                                color: '#00ffff',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {nickname}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <button
                                                    className={classes.btn}
                                                    disabled={addingPlayerTournamentId === tournament.id}
                                                    onClick={() => {
                                                        const selectedNickname =
                                                            activeSuggestionIndex >= 0
                                                                ? nicknameSuggestions[activeSuggestionIndex]
                                                                : nicknameQuery.trim();
                                                        if (!selectedNickname) {
                                                            return;
                                                        }
                                                        addUserTournament(
                                                            tournament.id,
                                                            selectedNickname,
                                                            tournament.players,
                                                            tournament.maxPlayers,
                                                            { isAdminManagedAdd: true }
                                                        );
                                                    }}
                                                >
                                                    {addingPlayerTournamentId === tournament.id ? (
                                                        <span className={classes.loadingInline}>
                                                            <span className={classes.spinner}></span>
                                                            Adding...
                                                        </span>
                                                    ) : (
                                                        '➕ Add Player'
                                                    )}
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
                                        {authCtx.isAdmin && (
                                            <button
                                                className={`${classes.btn} ${classes.btnPrimary}`}
                                                style={{
                                                    background: 'linear-gradient(135deg, #4caf50, #45a049)',
                                                    border: '2px solid #4caf50',
                                                    fontSize: '1.1rem',
                                                    padding: '0.75rem 1.5rem'
                                                }}
                                                onClick={() =>
                                                    showDetailsHandler(
                                                        tournament.status,
                                                        tournament.winners,
                                                        tournament.id,
                                                        tournament
                                                    )
                                                }
                                            >
                                                🎮 Start Tournament
                                            </button>
                                        )}
                                    </div>
                                )}

                                {!tournament.status.includes('Finished') ? (
                                    <div className={classes.prizePool}>
                                        <h4>💰 Prize Pool</h4>
                                        {Object.entries(tournament.pricePull).map(([place, prize]) => (
                                            <div key={place} className={classes.prizeItem}>
                                                <span className={classes.medal}>{getMedalEmoji(place)}</span>
                                                <span className={classes.prizePlace}>{place}:</span>
                                                <span className={classes.prizeAmount}>
                                                    {tournament.prizeType === 'coins' ? `${prize} coins` : `$${prize}`}
                                                </span>
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
                                                let coinPrize = null;
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
                                                if (tournament.coinPrizePull) {
                                                    coinPrize = tournament.coinPrizePull[place];
                                                    if (!coinPrize) {
                                                        const coinPrizeKey = Object.keys(tournament.coinPrizePull).find(
                                                            (key) => key.toLowerCase() === place.toLowerCase()
                                                        );
                                                        coinPrize = coinPrizeKey
                                                            ? tournament.coinPrizePull[coinPrizeKey]
                                                            : null;
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
                                                            {(prize || coinPrize) && (
                                                                <span className={classes.prizeInBrackets}>
                                                                    {' '}
                                                                    {tournament.prizeType === 'coins'
                                                                        ? `(${coinPrize || prize} coins)`
                                                                        : `($${prize || coinPrize})`}
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
                    <option value="registrationFinished" style={{ background: '#1a1a2e', color: '#00ffff' }}>
                        ✅ Registration Finished
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
            {showSpinningWheel && (
                <Modal onClose={closeModalHandler}>
                    <SpinningWheel players={tournamentPlayers} onStartTournament={handleStartTournament} />
                </Modal>
            )}
        </div>
    );
};

export default TournamentList;
