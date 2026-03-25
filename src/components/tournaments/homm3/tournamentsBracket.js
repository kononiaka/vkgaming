import { useEffect, useState, useContext } from 'react';
import {
    addScoreToUser,
    getNewRating,
    getPlayerPrizeTotal,
    loadUserById,
    lookForCastleStats,
    lookForTournamentName,
    lookForUserId,
    lookForUserPrevScore,
    pullTournamentPrizes,
    fetchCastlesList,
    calculateStarsFromRating,
    snapshotLeaderboardRanks
} from '../../../api/api';
import { shuffleArray } from '../../tournaments/tournament_api';
import { PlayerBracket } from './PlayerBracket/PlayerBracket';
import StatsPopup from '../../StatsPopup/StatsPopup';
import { findByName } from '../../../api/api.js';
import SpinningWheel from '../../SpinningWheel/SpinningWheel';
import Modal from '../../Modal/Modal.js';
import ReportGameModal from './ReportGameModal';
import AuthContext from '../../../store/auth-context';
import classes from './tournamentsBracket.module.css';
const formatPlayerName = (player) => player.name;

const uniquePlayerNames = [];
const currentStageIndex = 0;
let SHOULD_POSTING = true;
let isManualScore = false;
let clickedRadioButton;
let playersObj = {};
let tournamentName = null;
let allPairsHaveTeams = null;

const normalizeMatchType = (rawType) => {
    const normalized = String(rawType ?? '')
        .toLowerCase()
        .trim();
    if (normalized === 'bo-5' || normalized === '5' || normalized === 'bo5') {
        return 'bo-5';
    }
    if (normalized === 'bo-3' || normalized === '3' || normalized === 'bo3') {
        return 'bo-3';
    }
    return 'bo-1';
};

const getBestOfValue = (matchType) => {
    const normalized = normalizeMatchType(matchType);
    return Number(normalized.split('-')[1]) || 1;
};

const buildMatchKey = (gameData, tournamentId) => {
    const normalize = (value) =>
        String(value ?? '')
            .trim()
            .toLowerCase();

    const gamesDigest = Array.isArray(gameData.games)
        ? gameData.games
              .map(
                  (g) =>
                      `${g.gameId ?? ''}:${normalize(g.gameWinner)}:${normalize(g.castle1)}:${normalize(g.castle2)}:${g.gold1 ?? 0}:${g.gold2 ?? 0}`
              )
              .join(';')
        : '';

    const rawKey = [
        normalize(tournamentId),
        normalize(gameData.tournamentName),
        normalize(gameData.gameType),
        normalize(gameData.opponent1),
        normalize(gameData.opponent2),
        normalize(gameData.score),
        normalize(gameData.winner),
        gamesDigest
    ].join('|');

    return encodeURIComponent(rawKey);
};

export const TournamentBracket = ({
    maxPlayers,
    tournamentId,
    tournamentStatus,
    tournamentWinners
    // tournamentNameParam
}) => {
    // Helper to persist latest processed stage in localStorage
    const setLatestProcessedStage = (stage) => {
        // Old logic preserved
        const pair = playoffPairs[selectedStageIndex]?.[selectedPairIndex];
        const storageKey = `reportGameModal-progress-${pair?.id || `${pair?.team1}-${pair?.team2}`}`;
        let progress = {};
        try {
            progress = JSON.parse(localStorage.getItem(storageKey)) || {};
        } catch {
            // Ignore JSON parse errors, treat as empty progress
        }
        progress.latestProcessedStage = stage;
        localStorage.setItem(storageKey, JSON.stringify(progress));
    };

    // New: Detailed progress tracking for each reporting stage
    const setDetailedProgressStage = (stage, extra = {}) => {
        const pair = playoffPairs[selectedStageIndex]?.[selectedPairIndex];
        const storageKey = `reportGameModal-progress-${pair?.id || `${pair?.team1}-${pair?.team2}`}`;
        let progress = {};
        try {
            progress = JSON.parse(localStorage.getItem(storageKey)) || {};
        } catch {
            // Ignore JSON parse errors, treat as empty progress
        }
        progress.detailedStage = stage;
        Object.assign(progress, extra);
        localStorage.setItem(storageKey, JSON.stringify(progress));
    };

    const authCtx = useContext(AuthContext);
    const [stageLabels, setStageLabels] = useState([]);
    const [gamesPerStage, setGamesPerStage] = useState({});
    const [shuffledNames, setShuffledNames] = useState([]);
    const [playoffPairs, setPlayoffPairs] = useState([]);
    const [startTournament, setStartTournament] = useState(false);
    const [startButton, setStartButton] = useState(false);
    const [isUpdateButtonVisible, setUpdateButtonVisible] = useState(true);
    const [showCastlesModal, setShowCastlesModal] = useState(false);
    const [availableCastles, setAvailableCastles] = useState([]);
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState(null);
    const [isSpinningWheelOpen, setIsSpinningWheelOpen] = useState(false);
    const [isTournamentBracketOpen, setIsTournamentBracketOpen] = useState(true); // State for tournament bracket visibility
    const [showReportGameModal, setShowReportGameModal] = useState(false);
    const [selectedStageIndex, setSelectedStageIndex] = useState(null);
    const [selectedPairIndex, setSelectedPairIndex] = useState(null);

    const normalizeName = (value) =>
        String(value || '')
            .trim()
            .toLowerCase();
    const canViewReportButtonForPair = (pair) => {
        if (!pair) {
            return false;
        }

        if (authCtx.isAdmin) {
            return true;
        }

        const currentUser = normalizeName(authCtx.userNickName);
        if (!currentUser) {
            return false;
        }

        return currentUser === normalizeName(pair.team1) || currentUser === normalizeName(pair.team2);
    };

    const canReportGameForPair = (pair) => {
        if (!canViewReportButtonForPair(pair)) {
            return false;
        }

        // Once processed, only admins can re-report.
        if (pair.gameStatus === 'Processed') {
            return Boolean(authCtx.isAdmin);
        }

        return true;
    };

    const getCurrentRating = (ratings) => {
        if (typeof ratings === 'string' && ratings.includes(',')) {
            return parseFloat(parseFloat(ratings.split(',').at(-1)).toFixed(2));
        }

        return ratings ? parseFloat(Number(ratings).toFixed(2)) : 0;
    };

    const recalculatePlayerStars = async ({ attendeeNames = null } = {}) => {
        const usersResponse = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
        const usersData = await usersResponse.json();

        const allPlayers = Object.entries(usersData || {})
            .map(([id, userData]) => ({
                id,
                name: userData.enteredNickname || userData.name,
                ratings: getCurrentRating(userData.ratings)
            }))
            .filter((player) => player.name && player.ratings > 0)
            .sort((a, b) => b.ratings - a.ratings);

        if (allPlayers.length === 0) {
            return { updatedCount: 0 };
        }

        const highestRating = allPlayers[0].ratings;
        const lowestRating = Math.min(...allPlayers.map((player) => player.ratings));
        const playersToUpdate = attendeeNames
            ? allPlayers.filter((player) => attendeeNames.includes(player.name))
            : allPlayers;

        for (const player of playersToUpdate) {
            const newStars = calculateStarsFromRating(player.ratings, highestRating, lowestRating);

            await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${player.id}.json`, {
                method: 'PATCH',
                body: JSON.stringify({ stars: newStars }),
                headers: { 'Content-Type': 'application/json' }
            });

            console.log(`Updated ${player.name}: ${player.ratings} rating -> ${newStars} stars`);
        }

        return {
            updatedCount: playersToUpdate.length,
            highestRating,
            lowestRating
        };
    };

    let BO3_DEFAULT;
    // let tournamentName;

    // Determine the stage label based on the number of max players

    //TODO when there is a winner move him to the prior stage
    useEffect(() => {
        let labels = [];
        // let gamesPerStageData = {};
        // console.log('maximum' + tournamentId, maxPlayers);
        const fetchData = async () => {
            const tournamentResponseName = await lookForTournamentName(tournamentId);
            // console.log('tournamentResponseName', JSON.stringify(tournamentResponseName));

            tournamentName = tournamentResponseName.name;
            // console.log('tournamentName: ' + tournamentName);
        };

        fetchData();

        // console.log('tournamentId', tournamentId);
        // console.log('Object.keys(maxPlayers)' + tournamentName, Object.keys(maxPlayers));
        // console.log('Object.keys(maxPlayers).length' + tournamentName, Object.keys(maxPlayers).length);

        if (+maxPlayers === 4) {
            labels = ['Semi-final', 'Third Place', 'Final'];
        } else if (+maxPlayers === 8) {
            labels = ['Quarter-final', 'Semi-final', 'Third Place', 'Final'];
        } else if (+maxPlayers === 16) {
            labels = ['1/8 Final', 'Quarter-final', 'Semi-final', 'Third Place', 'Final'];
        } else if (+maxPlayers === 32) {
            labels = ['1/16 Final', '1/8 Final', 'Quarter-final', 'Semi-final', 'Third Place', 'Final'];
        }

        setStageLabels(labels);

        if (tournamentStatus === 'Tournament Finished') {
            setUpdateButtonVisible(false);
        }

        setGamesPerStage({
            '1/32 Final': 32,
            '1/16 Final': 16,
            '1/8 Final': 8,
            'Quarter-final': 4,
            'Semi-final': 2,
            'Third Place': 1,
            Final: 1
        });

        const fetchPlayoffPairs = async () => {
            try {
                const tournamentResponse = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/.json`
                );

                if (tournamentResponse.ok) {
                    const data = await tournamentResponse.json();
                    const registeredPlayer = Object.values(data.players).length.toString();
                    const tournamentPlayers = data.maxPlayers;

                    if (registeredPlayer === tournamentPlayers && data.status === 'Registration finished!') {
                        setStartButton(true);
                    }
                }
                const bracketResponse = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`
                );

                // console.log('bracketResponse', bracketResponse);

                if (bracketResponse.ok) {
                    const data = await bracketResponse.json();
                    if (data) {
                        // Parse the object
                        const valuesArray = Object.values(data);
                        // console.log('valuesArray', valuesArray);

                        let playoffPairsDetermined = data?.playoffPairs;
                        if (!playoffPairsDetermined) {
                            playoffPairsDetermined = valuesArray[0].playoffPairs;
                        }
                        setPlayoffPairs(playoffPairsDetermined);
                        // console.log('playoffPairsDetermined', playoffPairsDetermined);
                    }
                } else {
                    console.log('Failed to fetch playoff pairs');
                }
            } catch (error) {
                console.error('Error fetching playoff pairs:', error);
            }
        };

        fetchPlayoffPairs();
    }, [maxPlayers, uniquePlayerNames]);

    const handleShowStats = async (team1, team2) => {
        // Fetch all games from your DB (adjust the URL as needed)
        const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/games.json');
        const data = await response.json();

        // Filter games where both players played and include game IDs
        const games = Object.entries(data.heroes3 || {})
            .filter(
                ([id, game]) =>
                    (game.opponent1 === team1 && game.opponent2 === team2) ||
                    (game.opponent1 === team2 && game.opponent2 === team1)
            )
            .map(([id, game]) => ({ ...game, id }));

        const total = games.length;
        const wins = games.filter((g) => g.winner === team1).length;
        const losses = games.filter((g) => g.winner === team2).length;
        const winPercent = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';

        // Sort by date descending and take the last 5 games
        const last5Games = games.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

        // Calculate restart coefficients from tournament games
        // Coefficient formula: 1.0 + (restart_111 × 0.5) + (restart_112 × 1.0), capped at 2.0
        let restartCoeffA = 0;
        let restartCoeffB = 0;
        let team1GamesCount = 0;

        // Collect all tournament games between these two players
        playoffPairs.forEach((stageGames) => {
            if (Array.isArray(stageGames)) {
                stageGames.forEach((pair) => {
                    if (
                        (pair.team1 === team1 && pair.team2 === team2) ||
                        (pair.team1 === team2 && pair.team2 === team1)
                    ) {
                        // Calculate restarts from pair.games array
                        if (pair.games && Array.isArray(pair.games)) {
                            pair.games.forEach((game) => {
                                // Determine which team is team1 and team2 in the pair
                                const isTeam1Side = pair.team1 === team1;

                                if (isTeam1Side) {
                                    // Team1 coefficient: 1.0 + (111 × 0.5) + (112 × 1.0)
                                    const coeffA =
                                        1.0 + (game.restart1_111 || 0) * 0.5 + (game.restart1_112 || 0) * 1.0;
                                    restartCoeffA += Math.min(coeffA, 2.0); // Cap at 2.0

                                    // Team2 coefficient: 1.0 + (111 × 0.5) + (112 × 1.0)
                                    const coeffB =
                                        1.0 + (game.restart2_111 || 0) * 0.5 + (game.restart2_112 || 0) * 1.0;
                                    restartCoeffB += Math.min(coeffB, 2.0); // Cap at 2.0
                                } else {
                                    // Team1 and Team2 are swapped in the pair
                                    const coeffA =
                                        1.0 + (game.restart2_111 || 0) * 0.5 + (game.restart2_112 || 0) * 1.0;
                                    restartCoeffA += Math.min(coeffA, 2.0);

                                    const coeffB =
                                        1.0 + (game.restart1_111 || 0) * 0.5 + (game.restart1_112 || 0) * 1.0;
                                    restartCoeffB += Math.min(coeffB, 2.0);
                                }

                                team1GamesCount++;
                            });
                        }
                    }
                });
            }
        });

        // Calculate averages
        if (team1GamesCount > 0) {
            restartCoeffA = restartCoeffA / team1GamesCount;
            restartCoeffB = restartCoeffB / team1GamesCount;
        }

        setStats({
            total,
            wins,
            losses,
            winPercent,
            playerA: team1,
            playerB: team2,
            last5Games,
            restartCoeffA,
            restartCoeffB
        });
        setShowStats(true);
    };

    const handleCloseStats = () => setShowStats(false);

    const getWinner = (pair) => {
        const score1 = pair.type === 'bo-3' ? parseInt(pair.score1) : parseInt(pair.score1) || 0;
        const score2 = pair.type === 'bo-3' ? parseInt(pair.score2) : parseInt(pair.score2) || 0;

        if (pair.type === 'bo-3') {
            if (+score1 === 2 && +score2 < 2) {
                pair.winner = pair.team1;
            } else if (+score2 === 2 && +score1 < 2) {
                pair.winner = pair.team2;
            } else {
                pair.winner = '';
            }
        } else if (pair.type === 'bo-1') {
            if (+score1 > +score2) {
                pair.winner = pair.team1;
                pair.gameWinner = pair.castle1;
            } else if (+score1 < +score2) {
                pair.winner = pair.team2;
                pair.gameWinner = pair.castle2;
            } else {
                return 'Tie';
            }
        }
        // pair.gameStatus = pair.gameStatus !== 'Finished' ? 'Finished' : 'Not Started';
        if (pair.winner && pair.gameStatus !== 'Processed') {
            if (pair.type === 'bo-3') {
                let results = ['2-0', '2-1', '1-2', '0-2'];
                let combinedScore = `${score1}-${score2}`;

                if (results.includes(combinedScore)) {
                    pair.gameStatus = 'Finished';
                }
            } else {
                pair.gameStatus = 'Finished';
            }
        }
    };

    const handleStartTournament = async () => {
        console.log('handleStartTournament called');

        const tournamentResponseGET = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/.json`,
            {
                method: 'GET'
            }
        );
        let tournamentResponse = null;
        if (tournamentResponseGET.ok) {
            const data = await tournamentResponseGET.json();
            console.log('Tournament data:', data);
            // const playoffsGames = data.tournamentPlayoffGames;
            // const tournamentPlayoffGamesFinal = data.tournamentPlayoffGamesFinal;
            const randomBrackets = data.randomBracket;
            playersObj = data.players;
            console.log('playersObj:', playersObj);
            // let tournamentData = {};

            // Recalculate stars for tournament attendees before starting
            const confirmRecalculateStars = confirmWindow(
                `Recalculate stars for tournament attendees?\n\nThis will update stars for players participating in this tournament.\n\nRecalculate stars?`
            );

            if (confirmRecalculateStars) {
                try {
                    const attendeeNames = Object.values(playersObj)
                        .filter((player) => player && player.name)
                        .map((player) => player.name);
                    const result = await recalculatePlayerStars({ attendeeNames });

                    console.log(
                        `Tournament attendees stars recalculated successfully. Updated ${result.updatedCount} players.`
                    );
                    alert('Tournament attendees stars recalculated successfully!');
                } catch (error) {
                    console.error('Error recalculating stars:', error);
                    alert('Error recalculating stars: ' + error.message);
                    return;
                }
            } else {
                console.log('Star recalculation cancelled by user');
            }

            setStartTournament(true);

            // Automatically snapshot current leaderboard rankings before tournament starts
            try {
                const snapshotResult = await snapshotLeaderboardRanks();
                if (snapshotResult.success) {
                    console.log(
                        `Leaderboard snapshot taken: ${snapshotResult.successCount} players, ${snapshotResult.errorCount} errors`
                    );
                } else {
                    console.error('Failed to snapshot leaderboard:', snapshotResult.error);
                }
            } catch (error) {
                console.error('Error during leaderboard snapshot:', error);
            }

            // Prepare the tournament data
            console.log('Random Brackets setting:', randomBrackets);
            console.log('Should open spinning wheel?', !randomBrackets);
            if (randomBrackets) {
                console.log('Opening spinning wheel...');
                setIsSpinningWheelOpen(true);
            } else {
                console.log('Random bracket is true, skipping spinning wheel');
                tournamentResponse = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/.json`,
                    {
                        method: 'PATCH',
                        body: JSON.stringify({
                            status: 'Started!'
                        }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );
                try {
                    if (tournamentResponse.ok) {
                        console.log('Pairs posted to Firebase successfully');
                    } else {
                        console.log('Failed to post pairs to Firebase');
                    }
                } catch (error) {
                    console.error('Error posting pairs to Firebase:', error);
                }

                // window.location.reload();
            }
        }
    };

    const updateTournament = async () => {
        const tournamentData = {
            playoffPairs: playoffPairs
        };

        const tournamentResponse = await lookForTournamentName(tournamentId);
        tournamentName = tournamentResponse.name;

        allPairsHaveTeams = allPairsHaveTeamsFunc(playoffPairs);

        // let updateDataResponseModal = confirmWindow(
        //     `Are you sure you want to update winners with this JSON ${JSON.stringify(tournamentData)}?`
        // );

        try {
            //TODO: check if the playoffPairs is equal to the DB object => do nothing
            // if (SHOULD_POSTING && updateDataResponseModal) {
            //     const response = await fetch(
            //         `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`,
            //         {
            //             method: 'PUT',
            //             body: JSON.stringify(tournamentData),
            //             headers: {
            //                 'Content-Type': 'application/json'
            //             }
            //         }
            //     );

            //     if (response.ok) {

            // console.log('playoffPairs before', JSON.stringify(playoffPairs, null, 2));

            await processFinishedGames(playoffPairs);

            //TODO: Could this be ommit?
            // console.log('playoffPairs', JSON.stringify(playoffPairs, null, 2));

            const retrievedWinners = await retrieveWinnersFromDatabase();

            //TODO: check if the quantity of winners are the same => doing nothing
            const tournamentDataWithWinners = {
                playoffPairs: retrievedWinners
            };

            //TODO: if the tournamentDate is the same as the tournamentDataWithWinners
            const isSame = JSON.stringify(tournamentData) === JSON.stringify(tournamentDataWithWinners);

            //TODO: why do we need to PUT it the second time - to determine the next stage pairings?
            let winnerBracket = {};

            //IMPORTANT: Which means that all pairs have teams and no need to determine the next stage pairings
            if (!allPairsHaveTeams) {
                let winnersDataPutResponseModal = confirmWindow(
                    `Are you sure you want to update tournamentDataWithWinners with this JSON ${JSON.stringify(tournamentDataWithWinners, null, 2)}?`
                );

                if (SHOULD_POSTING && winnersDataPutResponseModal) {
                    winnerBracket = await fetch(
                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`,
                        {
                            method: 'PUT',
                            body: JSON.stringify(tournamentDataWithWinners),
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                } else {
                    winnerBracket.ok = true;
                }
            }

            // if (winnerBracket.ok) {
            let place;
            let prizeAmount;
            const lastStage = retrievedWinners[retrievedWinners.length - 1];

            const firstPlace = lastStage[lastStage.length - 1] ? lastStage[lastStage.length - 1].winner : null;

            const secondPlace = firstPlace
                ? firstPlace === lastStage[lastStage.length - 1].team1
                    ? lastStage[lastStage.length - 1].team2
                    : lastStage[lastStage.length - 1].team1
                : undefined;

            // TODO URGENT: why we can't put the third place here as well?

            if (firstPlace) {
                let prizes = await pullTournamentPrizes(tournamentId);
                const winnersData = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/.json`
                );

                if (winnersData.ok) {
                    const existingData = await winnersData.json();

                    existingData['1st place'] = firstPlace;
                    existingData['2nd place'] = secondPlace;

                    let firstPlaceId = await lookForUserId(firstPlace);
                    let secondPlaceId = await lookForUserId(secondPlace);

                    let firstPlaceRecord = await loadUserById(firstPlaceId);
                    let secondPlaceRecord = await loadUserById(secondPlaceId);
                    let winnersResponse = {};

                    let winnersResponseModal = confirmWindow(
                        `Are you sure you want to update winners with this JSON ${JSON.stringify(existingData)}?`
                    );

                    if (SHOULD_POSTING && winnersResponseModal) {
                        winnersResponse = await fetch(
                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/.json`,
                            {
                                method: 'PUT',
                                body: JSON.stringify(existingData),
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            }
                        );
                    } else {
                        winnersResponse.ok = true;
                    }
                    if (winnersResponse.ok) {
                        let tournamentStatusResponse = {};
                        let tournamentStatusResponseModal = confirmWindow(
                            `Are you sure you want to update tournament's status to 'FINISHED'?`
                        );
                        if (SHOULD_POSTING && tournamentStatusResponseModal) {
                            tournamentStatusResponse = await fetch(
                                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/status.json`,
                                {
                                    method: 'PUT',
                                    body: JSON.stringify('Tournament Finished'),
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                }
                            );
                        } else {
                            tournamentStatusResponse.ok = true;
                        }
                        if (tournamentStatusResponse.ok) {
                            setUpdateButtonVisible(false);

                            if (tournamentStatusResponse.ok) {
                                if (!firstPlaceRecord || typeof firstPlaceRecord.prizes !== 'object') {
                                    console.log('1ST PLACE PRIZE WAS DETERMINED', prizeAmount);
                                    // If not, initialize "prizes" as an object
                                    firstPlaceRecord.prizes = [];
                                }
                                place = '1st Place';
                                prizeAmount = prizes[place];
                                let firstPriceTotal = await getPlayerPrizeTotal(firstPlaceId);
                                firstPlaceRecord.totalPrize = +firstPriceTotal + +prizeAmount;

                                firstPlaceRecord.prizes.push({
                                    tournamentName: tournamentResponse.name,
                                    place: place,
                                    prizeAmount: prizeAmount
                                });

                                let firstPlaceResponse = {};

                                let firstPlaceResponseModal = confirmWindow(
                                    `Are you sure you want to update first place winner?`
                                );
                                if (SHOULD_POSTING && firstPlaceResponseModal) {
                                    firstPlaceResponse = await fetch(
                                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${firstPlaceId}.json`,
                                        {
                                            method: 'PUT',
                                            headers: {
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify(firstPlaceRecord)
                                        }
                                    );
                                } else {
                                    firstPlaceResponse.ok = true;
                                }
                                if (firstPlaceResponse.ok) {
                                    if (!secondPlaceRecord || typeof secondPlaceRecord.prizes !== 'object') {
                                        secondPlaceRecord.prizes = [];
                                    }
                                    place = '2nd Place';
                                    prizeAmount = prizes[place];
                                    let secondPriceTotal = await getPlayerPrizeTotal(secondPlaceId);
                                    secondPlaceRecord.totalPrize = +secondPriceTotal + +prizeAmount;

                                    secondPlaceRecord.prizes.push({
                                        tournamentName: tournamentResponse.name,
                                        place: place,
                                        prizeAmount: prizeAmount
                                    });
                                    let secondPlaceResponse = {};
                                    let secondPlaceResponseModal = confirmWindow(
                                        `Are you sure you want to update second place winner?`
                                    );
                                    console.log('Final firstPlaceResponseModal:', secondPlaceResponseModal);
                                    if (SHOULD_POSTING && secondPlaceResponseModal) {
                                        secondPlaceResponse = await fetch(
                                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${secondPlaceId}.json`,
                                            {
                                                method: 'PUT',
                                                headers: {
                                                    'Content-Type': 'application/json'
                                                },
                                                body: JSON.stringify(secondPlaceRecord)
                                            }
                                        );
                                    } else {
                                        secondPlaceResponse.ok = true;
                                    }
                                    if (secondPlaceResponse.ok) {
                                        console.log('PRIZES FOR THE USERS WERE UPDATED SUCCESSFULLY');
                                        // Now process 3rd place prize
                                        await determineThirdPlaceWinner(retrievedWinners, stageLabels);
                                    }
                                }
                            }
                        }
                    } else {
                        const errorMessage = await winnersResponse.text();
                        console.error('Error:', winnersResponse.status, errorMessage);
                    }
                }
            }

            try {
                const starRecalculationResult = await recalculatePlayerStars();
                console.log(
                    `Player stars recalculated after tournament finish. Updated ${starRecalculationResult.updatedCount} players.`
                );
            } catch (error) {
                console.error('Error recalculating player stars after tournament finish:', error);
            }

            // }

            // Automatically snapshot current leaderboard rankings after tournament finishes and all prizes are awarded
            try {
                const snapshotResult = await snapshotLeaderboardRanks();
                if (snapshotResult.success) {
                    console.log(
                        `Leaderboard snapshot taken after tournament: ${snapshotResult.successCount} players, ${snapshotResult.errorCount} errors`
                    );
                } else {
                    console.error('Failed to snapshot leaderboard after tournament:', snapshotResult.error);
                }
            } catch (error) {
                console.error('Error during leaderboard snapshot after tournament:', error);
            }

            console.log('Pairs posted to Firebase successfully');
            let reloadResponse = confirmWindow(`Are you sure you want to reload the page?`);
            if (reloadResponse) {
                window.location.reload();
            }
        } catch (error) {
            console.log('Error posting pairs to Firebase:', error);
        }
    };

    // Utility function to check if all pairs have valid teams
    function allPairsHaveTeamsFunc(tournamentPlayoffPairs) {
        if (!Array.isArray(tournamentPlayoffPairs)) {
            return false;
        }
        return tournamentPlayoffPairs.every(
            (stage) =>
                Array.isArray(stage) &&
                stage.every((pair) => pair.team1 && pair.team1 !== 'TBD' && pair.team2 && pair.team2 !== 'TBD')
        );
    }

    function confirmWindowNew(message) {
        return new Promise((resolve) => {
            const confirmButton = document.createElement('button');
            confirmButton.textContent = 'Yes';
            confirmButton.addEventListener('click', () => {
                resolve(true);
            });

            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'No';
            cancelButton.addEventListener('click', () => {
                resolve(false);
            });

            const div = document.createElement('div');
            div.appendChild(confirmButton);
            div.appendChild(cancelButton);
            div.style.position = 'absolute';
            div.style.top = '0';
            div.style.left = '0';
            div.style.width = '100%';
            div.style.height = '100%';
            div.style.backgroundColor = 'rgba(0,0,0,0,0.5)';
            div.style.padding = '10px';
            div.style.display = 'flex';
            div.style.justifyContent = 'center';
            div.style.alignItems = 'center';
            div.style.gap = '10px';

            const messageDiv = document.createElement('div');
            messageDiv.textContent = message;
            messageDiv.style.position = 'absolute';
            messageDiv.style.top = '50%';
            messageDiv.style.left = '50%';
            messageDiv.style.width = '100%';
            messageDiv.style.height = '50%';
            messageDiv.style.backgroundColor = 'rgba(0,0,0,0,0.5)';
            messageDiv.style.padding = '10px';
            messageDiv.style.display = 'flex';
            messageDiv.style.justifyContent = 'center';
            messageDiv.style.alignItems = 'center';
            messageDiv.style.gap = '10px';

            document.body.appendChild(messageDiv);
            document.body.appendChild(div);

            const result = new Promise((resolve) => {
                const buttonClicked = document.createElement('button');
                buttonClicked.textContent = 'Got it!';
                buttonClicked.addEventListener('click', () => {
                    resolve(true);
                });

                const cancelButtonNew = document.createElement('button');
                cancelButtonNew.textContent = 'Cancel';
                cancelButtonNew.addEventListener('click', () => {
                    resolve(false);
                });

                div.appendChild(buttonClicked);
                div.appendChild(cancelButtonNew);

                div.style.display = 'flex';
                div.style.justifyContent = 'center';
                div.style.alignItems = 'center';
                div.style.gap = '10px';

                div.style.position = 'absolute';
                div.style.top = '50%';
                div.style.left = '50%';
                div.style.width = '100%';
                div.style.height = '50%';
            });
        });
    }

    const retrieveWinnersFromDatabase = async () => {
        try {
            let mustFetch = confirmWindow('Please wait...');
            if (mustFetch) {
                const tournamentResponseGET = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/.json`,
                    {
                        method: 'GET'
                    }
                );
                if (tournamentResponseGET.ok) {
                    const data = await tournamentResponseGET.json();
                    const playoffsGames = data.tournamentPlayoffGames;
                    const tournamentPlayoffGamesFinal = data.tournamentPlayoffGamesFinal;

                    const bracketResponse = await fetch(
                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`
                    );
                    const playerResponse = await fetch(
                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/players/.json`
                    );

                    if (bracketResponse.ok && playerResponse.ok) {
                        const bracketData = await bracketResponse.json();

                        const playersData = await playerResponse.json();

                        let collectedPlayoffPairs = bracketData?.playoffPairs || [];
                        let nextStagePairings;
                        let nextStageIndex = 0;

                        for (let currentStage = 0; currentStage < collectedPlayoffPairs.length - 1; currentStage++) {
                            let currentStagePlayoffPairs = collectedPlayoffPairs[currentStage];

                            let currentStagePlayoffWinners = currentStagePlayoffPairs
                                .map((pair) => {
                                    const result = findByName(playersData, pair.winner);

                                    // Always use ratings from DB (fresh), but preserve stars from tournament entry
                                    let playerRecentRatings = result ? result.ratings : null;

                                    if (pair.winner === pair.team1) {
                                        return {
                                            winner: pair.winner,
                                            ratings: result ? playerRecentRatings : pair.ratings1,
                                            stars: pair.stars1 // Always preserve original tournament entry stars
                                        };
                                    } else {
                                        return {
                                            winner: pair.winner,
                                            ratings: result ? playerRecentRatings : pair.ratings2,
                                            stars: pair.stars2 // Always preserve original tournament entry stars
                                        };
                                    }
                                })
                                .filter((pair) => pair.winner !== undefined || pair.winner === 'TBD');

                            nextStageIndex = currentStage + 1;
                            let nextStagePlayoffPairs = collectedPlayoffPairs[nextStageIndex];

                            let thirdPlaceWinner;
                            if (currentStage === 2) {
                                thirdPlaceWinner = collectedPlayoffPairs[currentStage][0].winner;
                            }
                            const nextStagePlayoffWinners = nextStagePlayoffPairs.map((pair) => pair.winner);
                            const hasUndefinedTeam = nextStagePlayoffPairs.some(
                                (pair) => pair.team1 === 'TBD' || pair.team2 === 'TBD'
                            );

                            if (
                                nextStagePlayoffWinners.includes(undefined) &&
                                !thirdPlaceWinner &&
                                !allPairsHaveTeams
                            ) {
                                if (nextStageIndex === 2) {
                                    //THIRD PLACE
                                    const losers = currentStagePlayoffPairs.map((match) => {
                                        let loserName;
                                        if (match.winner === match.team1) {
                                            loserName = match.team2;
                                        } else if (match.winner === match.team2) {
                                            loserName = match.team1;
                                        } else {
                                            loserName = 'TBD';
                                        }

                                        // Use stars from the pair (original tournament entry), not from DB
                                        // Fetch updated ratings from DB for losers
                                        const loserData = Object.values(playersData).find(
                                            (player) => player.name === loserName
                                        );

                                        return {
                                            winner: loserName,
                                            stars: match.winner === match.team1 ? match.stars2 : match.stars1,
                                            ratings: loserData
                                                ? loserData.ratings
                                                : match.winner === match.team1
                                                  ? match.ratings2
                                                  : match.ratings1
                                        };
                                    });

                                    let thirdPlacePairing = determineNextStagePairings(losers);

                                    if (currentStagePlayoffWinners.length > 0) {
                                        nextStagePairings = determineNextStagePairings(
                                            currentStagePlayoffWinners,
                                            currentStage,
                                            playoffsGames
                                        );
                                        collectedPlayoffPairs[nextStageIndex + 1] = nextStagePairings;
                                        collectedPlayoffPairs[nextStageIndex] = thirdPlacePairing;
                                    }
                                } else {
                                    if (hasUndefinedTeam) {
                                        const gamesToUse =
                                            nextStageIndex === 3 ? tournamentPlayoffGamesFinal : playoffsGames;
                                        if (currentStagePlayoffWinners.length > 0) {
                                            nextStagePairings = determineNextStagePairings(
                                                currentStagePlayoffWinners,
                                                currentStage,
                                                gamesToUse
                                            );
                                            collectedPlayoffPairs[nextStageIndex] = nextStagePairings;
                                        }
                                    }
                                }
                            }
                        }

                        //TODO: This should be in a mutual function determinePrizeWinner
                        determineThirdPlaceWinner(collectedPlayoffPairs, stageLabels);
                        // setPlayoffPairs(collectedPlayoffPairs);
                        return collectedPlayoffPairs;
                    } else {
                        console.log('Failed to retrieve winners from the database');
                    }
                } else {
                    console.log('Fetch canceled by user');
                }
            }
        } catch (error) {
            console.error('Error retrieving winners from the database:', error);
        }
    };

    const processFinishedGames = async (collectedPlayoffPairs) => {
        let finishedPairs = [];

        collectedPlayoffPairs.forEach((pair) => {
            pair.forEach((pairDetails) => {
                if (pairDetails.gameStatus !== 'Processed') {
                    let fullResult = `${pairDetails.score1}-${pairDetails.score2}`;
                    if (pairDetails.type === 'bo-3') {
                        let results = ['2-0', '2-1', '1-2', '0-2'];

                        if (results.includes(fullResult) && pairDetails.winner && pairDetails.winner !== 'Tie') {
                            pairDetails.gameStatus = 'Finished';
                            finishedPairs.push(pairDetails);
                        } else {
                            results = ['1-0', '1-1', '0-1'];
                            if (results.includes(fullResult)) {
                                pairDetails.gameStatus = 'In Progress';
                            } else if (fullResult === '0-0' && Array.isArray(pairDetails.games)) {
                                const hasActivity = pairDetails.games.some((game) =>
                                    Boolean(
                                        game && (game.castle1 || game.castle2 || game.gameWinner || game.castleWinner)
                                    )
                                );
                                if (hasActivity) {
                                    pairDetails.gameStatus = 'In Progress';
                                }
                            }
                        }
                    } else {
                        if (
                            +pairDetails.score1 + +pairDetails.score2 === 1 &&
                            pairDetails.winner &&
                            pairDetails.winner !== 'Tie'
                        ) {
                            pairDetails.gameStatus = 'Finished';
                            finishedPairs.push(pairDetails);
                        } else {
                            if (
                                pairDetails.games[0].castle1 &&
                                pairDetails.games[0].castle2 &&
                                !pairDetails.games[0].gameWinner
                            ) {
                                pairDetails.gameStatus = 'In Progress';
                            }
                        }
                    }
                }
            });
        });

        //TODO: implement the gameStatus. If the gameWinner exists determine game as finished

        if (finishedPairs.length === 0) {
            console.log('No finished pairs found');
            return;
        }

        const tournamentInfo = await lookForTournamentName(tournamentId);
        const currentTournamentName = tournamentInfo?.name || tournamentName || 'Unknown Tournament';

        for (const finishedPair of finishedPairs) {
            let { castle1, castle2, score1, score2, team1, team2, winner, type } = finishedPair;
            if (!winner || winner === 'Tie') {
                continue;
            }

            const opponent1Id = await lookForUserId(team1);
            const opponent2Id = await lookForUserId(team2);

            let games;
            if (finishedPair.type === 'bo-3') {
                games = {
                    opponent1: team1,
                    opponent2: team2,
                    date: new Date().toISOString(),
                    games: finishedPair.games,
                    tournamentName: currentTournamentName,
                    gameType: type,
                    opponent1Castle: castle1,
                    opponent2Castle: castle2,
                    score: `${score1}-${score2}`,
                    winner: winner
                };
            } else {
                games = {
                    opponent1: team1,
                    opponent2: team2,
                    date: new Date().toISOString(),
                    tournamentName: currentTournamentName,
                    gameType: type,
                    opponent1Castle: finishedPair.games[0]?.castle1,
                    opponent2Castle: finishedPair.games[0]?.castle2,
                    score: `${score1}-${score2}`,
                    winner: winner
                };
            }

            let winnerId;
            let winnerCastle;
            let lostCastle;

            if (finishedPair.type === 'bo-3') {
                // Determine overall match winner from the match-level winner field (not per-game)
                // This avoids a 2-1 scenario where the last game processed belongs to the losing player
                if (winner === team1) {
                    winnerId = opponent1Id;
                } else if (winner === team2) {
                    winnerId = opponent2Id;
                }

                // Per-game castle stats (each game has its own winner)
                finishedPair.games.forEach((game) => {
                    if (game.gameWinner) {
                        const gameWinnerCastle = team1 === game.gameWinner ? game.castle1 : game.castle2;
                        const gameLoserCastle = team1 === game.gameWinner ? game.castle2 : game.castle1;
                        if (game.gameStatus && game.gameStatus === 'Finished' && gameWinnerCastle && gameLoserCastle) {
                            lookForCastleStats(gameWinnerCastle, 'win');
                            lookForCastleStats(gameLoserCastle, 'lost');
                            game.gameStatus = 'Processed';
                        }
                    }
                });
            } else {
                if (team1 === winner) {
                    winnerId = opponent1Id;
                    winnerCastle = finishedPair.games[0]?.castle1;
                    lostCastle = finishedPair.games[0]?.castle2;
                } else if (team2 === winner) {
                    winnerId = opponent2Id;
                    winnerCastle = finishedPair.games[0]?.castle2;
                    lostCastle = finishedPair.games[0]?.castle1;
                }

                if (winnerCastle && lostCastle) {
                    lookForCastleStats(winnerCastle, 'win');
                    lookForCastleStats(lostCastle, 'lost');
                }
            }

            if (SHOULD_POSTING) {
                const matchKey = buildMatchKey(games, tournamentId);
                games.matchKey = matchKey;

                const existingGameResponse = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3/${matchKey}.json`
                );
                const existingGameData = await existingGameResponse.json();

                if (!existingGameData) {
                    const gameResponse = await fetch(
                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3/${matchKey}.json`,
                        {
                            method: 'PUT',
                            body: JSON.stringify(games),
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    await gameResponse.json();
                }
            }

            const opponent1PrevData = await lookForUserPrevScore(opponent1Id);
            const opponent2PrevData = await lookForUserPrevScore(opponent2Id);

            const didWinOpponent1 = winnerId === opponent1Id;
            const didWinOpponent2 = winnerId === opponent2Id;

            let opponent1Score = await getNewRating(
                parseFloat(opponent1PrevData.ratings.split(',').pop().trim()),
                parseFloat(opponent2PrevData.ratings.split(',').pop().trim()),
                didWinOpponent1
            );
            let opponent2Score = await getNewRating(
                parseFloat(opponent2PrevData.ratings.split(',').pop().trim()),
                parseFloat(opponent1PrevData.ratings.split(',').pop().trim()),
                didWinOpponent2
            );

            if (SHOULD_POSTING) {
                await addScoreToUser(opponent1Id, opponent1PrevData, opponent1Score, winnerId, tournamentId, team1);
                await addScoreToUser(opponent2Id, opponent2PrevData, opponent2Score, winnerId, tournamentId, team2);
            }

            finishedPair.gameStatus = 'Processed';
            if (Array.isArray(finishedPair.games)) {
                finishedPair.games.forEach((game) => {
                    game.gameStatus = 'Processed';
                });
            }
        }

        let pushProcessedGame = true;
        let responseFinishedPair;
        if (pushProcessedGame) {
            // Use collectedPlayoffPairs (the mutated parameter) instead of the stale playoffPairs state
            responseFinishedPair = await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/playoffPairs/.json`,
                {
                    method: 'PUT',
                    body: JSON.stringify(collectedPlayoffPairs),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (responseFinishedPair.ok) {
                console.log('Finished pairs PUT successfully');
                setPlayoffPairs(collectedPlayoffPairs);
            } else {
                console.error('Failed to persist processed pairs. Local state was not updated.');
            }
        } else {
            setPlayoffPairs(collectedPlayoffPairs);
        }

        // console.log('finishedPairs LENGTH', finishedPairs.length);
        // console.log('finishedPairs', finishedPairs);
        // setPlayoffPairs(finishedPairs);

        return finishedPairs;
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

    const determineThirdPlaceWinner = async (playOffPairs, stages) => {
        //TODO tournamentName to add
        let place = '3rd Place';
        let prizes = await pullTournamentPrizes(tournamentId);
        if (!prizes || typeof prizes !== 'object' || prizes[place] === undefined || prizes[place] === null) {
            console.warn(`Prize data missing for ${place}. Skipping 3rd place prize processing.`);
            return;
        }
        const prizeAmount = prizes[place];

        const thirdPlaceIndex = stages.indexOf('Third Place');
        if (thirdPlaceIndex === -1 || !playOffPairs?.[thirdPlaceIndex] || !playOffPairs[thirdPlaceIndex][0]) {
            console.warn('Third place stage or match is missing. Skipping 3rd place processing.');
            return;
        }

        const thirdPlace = playOffPairs[thirdPlaceIndex];
        if (thirdPlace[0].winner) {
            let winner = thirdPlace[0].winner;
            if (winner) {
                let userId = await lookForUserId(winner);
                let userRecord = await loadUserById(userId);
                if (!userRecord || typeof userRecord !== 'object') {
                    console.error('FAILED TO LOAD USER RECORD FOR THE THIRD PLACE:', userId);
                    return;
                }

                let thirdPriceTotal = await getPlayerPrizeTotal(userId);

                userRecord.totalPrize = +thirdPriceTotal + +prizeAmount;

                if (!userRecord || typeof userRecord.prizes !== 'object') {
                    // If not, initialize "prizes" as an object
                    userRecord.prizes = [];
                }

                userRecord.prizes.push({
                    tournamentName: tournamentName,
                    place: place,
                    prizeAmount: prizeAmount
                });

                const response = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/3rd place.json`,
                    {
                        method: 'GET'
                    }
                );
                const data = await response.json();

                if (response.ok && data === 'TBD') {
                    let response = {};
                    let thirdPlaceModal = confirmWindow(
                        `Process Games: Are you sure you want to update the third place with a player: ${winner}?`
                    );
                    console.log('Process Games thirdPlaceModal:', thirdPlaceModal);

                    if (SHOULD_POSTING && thirdPlaceModal) {
                        response = await fetch(
                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/3rd place.json`,
                            {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(winner)
                            }
                        );
                    } else {
                        response.ok = true;
                    }

                    let responseUser = {};
                    if (response.ok) {
                        if (SHOULD_POSTING && thirdPlaceModal) {
                            responseUser = await fetch(
                                `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`,
                                {
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify(userRecord)
                                }
                            );
                        } else {
                            responseUser.ok = true;
                        }

                        if (responseUser.ok) {
                            console.log('USER RECORD THIRD PLACE WAS UPDATED:', userId);
                        }
                    }
                }
            } else {
                console.error('FAILED TO UPDATE USER FOR THE THIRD PLACE:');
            }
        }
    };

    // Example functions for processing winners and updating the next stage pairings in the database
    const determineNextStagePairings = (winners, currentStage, playoffsGames = 1) => {
        const nextPairings = [];
        const normalizedType = normalizeMatchType(playoffsGames);
        const configuredGames = getBestOfValue(normalizedType);

        // Iterate through the winners array and create pairings for the next stage
        for (let i = 0; i < winners.length; i += 2) {
            const games = [];

            const totalGames = configuredGames > 1 ? configuredGames - 1 : configuredGames;

            for (let j = 0; j < totalGames; j++) {
                games.push({
                    castle1: '',
                    castle2: '',
                    castleWinner: '',
                    gameId: j,
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
                });
            }

            const pair = {
                gameStatus: 'Not Started',
                team1: (winners[i] && winners[i].winner) || 'TBD',
                score1: 0,
                stars1: (winners[i] && winners[i].stars) || null,
                ratings1: (winners[i] && winners[i].ratings) || null,
                team2: (winners[i + 1] && winners[i + 1].winner) || 'TBD',
                score2: 0,
                stars2: (winners[i + 1] && winners[i + 1].stars) || null,
                ratings2: (winners[i + 1] && winners[i + 1].ratings) || null,
                type: normalizedType,
                games: games,
                color1: 'red',
                color2: 'blue'
            };

            nextPairings.push(pair);
        }
        if (currentStage === 0 && nextPairings.length === 1) {
            const pair = {
                gameStatus: 'Not Started',
                team1: 'TBD',
                score1: 0,
                stars1: null,
                ratings1: null,
                team2: 'TBD',
                score2: 0,
                stars2: null,
                ratings2: null,
                games: [
                    {
                        castle1: '',
                        castle2: '',
                        castleWinner: '',
                        gameId: 0,
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
                    }
                ],
                type: 'bo-1',
                color1: 'red',
                color2: 'blue'
            };

            nextPairings.push(pair);
        }
        return nextPairings;
    };

    const handleScoreChange = (stageName, pairIndex, teamIndex, newScore) => {
        const stageMappings = {
            'Quarter-final': 0,
            'Semi-final': 1,
            'Third Place': 2,
            Final: 3
            // Add more stages and their numerical values as needed
        };

        // Map the stage name to a numerical stage value
        const stage = stageMappings[stageName]; // Convert to lowercase for case-insensitive matching

        if (stage === undefined) {
            // Handle the case where an invalid stage name is provided
            console.error(`Invalid stage name: ${stageName}`);
            return;
        }

        setPlayoffPairs((prevPairs) => {
            const updatedPairs = [...prevPairs];
            const pair = updatedPairs[stage][pairIndex];

            if (teamIndex === 1) {
                pair.score1 = newScore;
            } else if (teamIndex === 2) {
                pair.score2 = newScore;
            }

            if (pair.score1 && pair.score2) {
                getWinner(pair);
                console.log('FINALLY', pair);
            }
            return updatedPairs;
        });
    };

    function renderShowStatsButton(team1, team2, onShowStats) {
        // Only show button if both players are determined (not TBD)
        if (team1 === 'TBD' || team2 === 'TBD' || !team1 || !team2) {
            return null;
        }

        return (
            <div
                onClick={() => onShowStats(team1, team2)}
                style={{
                    width: '24px',
                    height: '24px',
                    background: 'rgb(62, 32, 192)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'gold',
                    fontWeight: 'bold',
                    fontSize: '1em',
                    cursor: 'pointer',
                    border: '2px solid gold',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
                }}
                title="Show Stats"
            >
                ?
            </div>
        );
    }

    const handleGetAvailableCastles = async () => {
        let castles = await fetchCastlesList();
        console.log('castles', castles);

        const result = getAvailableCastles(castles);
        setAvailableCastles(result);
        setShowCastlesModal(true);
    };

    //TODO: implement the getAvailableCastles function to filter castles based on the number of games played
    function getAvailableCastles(castles) {
        // Calculate live games for each castle (castles selected but no winner yet)
        const castlesWithLiveGames = castles.map((castle) => {
            let liveGames = 0;

            // Count live games across all stages
            playoffPairs.forEach((stage) => {
                stage.forEach((pair) => {
                    if (pair.games && Array.isArray(pair.games)) {
                        pair.games.forEach((game) => {
                            // Game is live if:
                            // 1. gameStatus is 'In Progress', OR
                            // 2. Both castles are selected but no winner declared
                            const isInProgress = game.gameStatus === 'In Progress';
                            const hasCastlesNoWinner = game.castle1 && game.castle2 && !game.castleWinner;

                            if (
                                (game.castle1 === castle.name || game.castle2 === castle.name) &&
                                (isInProgress || hasCastlesNoWinner)
                            ) {
                                liveGames++;
                            }
                        });
                    }
                });
            });

            return {
                ...castle,
                liveGames: liveGames
            };
        });

        return [...castlesWithLiveGames].sort((a, b) => a.total - b.total);
    }

    const onStartTournament = async (bracket) => {
        console.log('Tournament ID:', tournamentId);
        console.log('Tournament Bracket:', bracket);

        const isBracketComplete = bracket.every((pair) => pair[0] !== 'TBD' && pair[1] !== 'TBD');

        if (!isBracketComplete) {
            console.error('Bracket is not complete. Please fill all slots.');
            return;
        }

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

        // Fetch tournament data to get playoff games settings
        let tournamentPlayoffGames = 'bo-1';
        try {
            const tournamentResponseGET = await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/.json`,
                {
                    method: 'GET'
                }
            );
            if (tournamentResponseGET.ok) {
                const tournamentData = await tournamentResponseGET.json();
                tournamentPlayoffGames = normalizeMatchType(tournamentData.tournamentPlayoffGames || 'bo-1');
            }
        } catch (error) {
            console.error('Error fetching tournament data:', error);
        }

        // Determine number of games based on bo-1 or bo-3
        const numGames = getBestOfValue(tournamentPlayoffGames);
        const gameType = tournamentPlayoffGames;

        // Format bracket pairs with player data following the exact structure
        const formattedBracket = bracket.map((pair) => {
            const player1 = Object.values(playersObj).find((p) => p.name === pair[0]);
            const player2 = Object.values(playersObj).find((p) => p.name === pair[1]);

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

            // Create games array based on tournament type
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

        try {
            // Create the full bracket structure with all stages
            const fullBracketStructure = [formattedBracket]; // Stage 0: Quarter-final

            // Add empty stages for Semi-final, Third Place, and Final with placeholder objects
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
                    pairsInStage = 1; // Default fallback
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

            console.log('Full bracket structure to be posted:', JSON.stringify(fullBracketStructure, null, 2));
            console.log('Stage labels:', currentStageLabels);
            console.log('Number of stages:', fullBracketStructure.length);

            const tournamentResponse = await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/playoffPairs.json`,
                {
                    method: 'PUT',
                    body: JSON.stringify(fullBracketStructure),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (tournamentResponse.ok) {
                console.log('Tournament Bracket Updated successfully!');
                // Update tournament status
                await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/status.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify('Started!'),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );
                console.log('Tournament successfully started!');
                setIsSpinningWheelOpen(false);

                // Fetch and update playoff pairs instead of reloading
                const bracketResponse = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/playoffPairs.json`
                );
                if (bracketResponse.ok) {
                    const updatedPairs = await bracketResponse.json();
                    console.log('Fetched updated playoff pairs:', updatedPairs);
                    setPlayoffPairs(updatedPairs);
                }
            } else {
                console.error('Failed to update tournament bracket');
            }
        } catch (error) {
            console.error('Error updating tournament:', error);
        }
    };

    const handleOpenReportGame = (pair, stageIdx, pairIdx) => {
        if (pair.team1 === 'TBD' || pair.team2 === 'TBD' || !pair.team1 || !pair.team2) {
            alert('Cannot report game until both players are assigned.');
            return;
        }
        if (pair.gameStatus === 'Processed' && !authCtx.isAdmin) {
            alert('This game is already processed. Only admin can re-report it.');
            return;
        }
        if (!canReportGameForPair(pair)) {
            alert('Only match players or admin can report this game.');
            return;
        }
        setSelectedStageIndex(stageIdx);
        setSelectedPairIndex(pairIdx);
        setShowReportGameModal(true);
    };

    // Helper function to update player ratings and statistics after a game
    const updatePlayerRatings = async (team1, team2, winnerId) => {
        try {
            // Get player IDs
            const opponent1Id = await lookForUserId(team1);
            const opponent2Id = await lookForUserId(team2);

            const confirmPlayerIds = confirmWindow(
                `Player IDs fetched:\n${team1}: ${opponent1Id}\n${team2}: ${opponent2Id}\n\nContinue?`
            );
            if (!confirmPlayerIds) {
                return { success: false, newRatings: {} };
            }

            // Fetch current player data
            const opponent1PrevData = await lookForUserPrevScore(opponent1Id);
            const opponent2PrevData = await lookForUserPrevScore(opponent2Id);

            const opponent1Stats = opponent1PrevData.games?.heroes3 || { total: 0, win: 0, lose: 0 };
            console.log('opponent1Stats', opponent1Stats);
            const opponent2Stats = opponent2PrevData.games?.heroes3 || { total: 0, win: 0, lose: 0 };

            //TODO: Fix database structure - 'win' field may be missing in all records
            // Calculate win from total - lose if win field is missing
            const opponent1Win =
                opponent1Stats.win !== undefined
                    ? opponent1Stats.win
                    : (opponent1Stats.total || 0) - (opponent1Stats.lose || 0);
            const opponent2Win =
                opponent2Stats.win !== undefined
                    ? opponent2Stats.win
                    : (opponent2Stats.total || 0) - (opponent2Stats.lose || 0);

            // Extract most recent ratings
            const opponent1Rating = opponent1PrevData.ratings?.split(',').pop().trim() || '0';
            console.log('opponent1Rating', opponent1Rating);
            const opponent2Rating = opponent2PrevData.ratings?.split(',').pop().trim() || '0';

            const confirmCurrentStats = confirmWindow(
                `Current Stats:\n\n${team1}:\nRating: ${opponent1Rating}\nTotal: ${opponent1Stats.total}, Win: ${opponent1Win}, Lose: ${opponent1Stats.lose}\n\n${team2}:\nRating: ${opponent2Rating}\nTotal: ${opponent2Stats.total}, Win: ${opponent2Win}, Lose: ${opponent2Stats.lose}\n\nContinue?`
            );
            if (!confirmCurrentStats) {
                return { success: false, newRatings: {} };
            }

            // Determine winners
            const didWinOpponent1 = winnerId === opponent1Id;
            const didWinOpponent2 = winnerId === opponent2Id;

            const winnerName = didWinOpponent1 ? team1 : team2;
            const loserName = didWinOpponent1 ? team2 : team1;

            const confirmWinner = confirmWindow(`Winner determined: ${winnerName}\nLoser: ${loserName}\n\nContinue?`);
            if (!confirmWinner) {
                return { success: false, newRatings: {} };
            }

            // Update player game statistics (win/lose/total) - calculate before rating updates
            // Use calculated opponent1Win/opponent2Win instead of opponent1Stats.win to handle missing 'win' field
            const updatedOpponent1Stats = {
                total: (opponent1Stats.total || 0) + 1,
                win: opponent1Win + (didWinOpponent1 ? 1 : 0),
                lose: (opponent1Stats.lose || 0) + (didWinOpponent1 ? 0 : 1)
            };

            const updatedOpponent2Stats = {
                total: (opponent2Stats.total || 0) + 1,
                win: opponent2Win + (didWinOpponent2 ? 1 : 0),
                lose: (opponent2Stats.lose || 0) + (didWinOpponent2 ? 0 : 1)
            };

            // Extract latest ratings
            const opponent1CurrentRating = parseFloat(opponent1PrevData.ratings.split(',').pop().trim());
            const opponent2CurrentRating = parseFloat(opponent2PrevData.ratings.split(',').pop().trim());

            // Calculate new ratings
            const opponent1NewRating = await getNewRating(
                opponent1CurrentRating,
                opponent2CurrentRating,
                didWinOpponent1
            );
            const opponent2NewRating = await getNewRating(
                opponent2CurrentRating,
                opponent1CurrentRating,
                didWinOpponent2
            );

            const confirmRatingChanges = confirmWindow(
                `Rating Changes:\n\n${team1}:\nOld: ${opponent1CurrentRating.toFixed(2)}\nNew: ${opponent1NewRating.toFixed(2)}\nChange: ${(opponent1NewRating - opponent1CurrentRating).toFixed(2)}\n\n${team2}:\nOld: ${opponent2CurrentRating.toFixed(2)}\nNew: ${opponent2NewRating.toFixed(2)}\nChange: ${(opponent2NewRating - opponent2CurrentRating).toFixed(2)}\n\nUpdate ratings?`
            );
            if (!confirmRatingChanges) {
                console.log('Rating changes preview cancelled - skipping ratings update but continuing to statistics');
            }

            // Confirm before updating ratings (only if preview was confirmed)
            if (confirmRatingChanges) {
                const confirmRatingsUpdate = confirmWindow(
                    `Update player ratings to database?\n\n${team1}: ${opponent1CurrentRating.toFixed(2)} → ${opponent1NewRating.toFixed(2)}\n${team2}: ${opponent2CurrentRating.toFixed(2)} → ${opponent2NewRating.toFixed(2)}\n\nUpdate ratings?`
                );
                if (confirmRatingsUpdate) {
                    try {
                        console.log(
                            `Updating ${team1} (${opponent1Id}) rating: ${opponent1CurrentRating.toFixed(2)} → ${opponent1NewRating.toFixed(2)}`
                        );
                        await addScoreToUser(
                            opponent1Id,
                            opponent1PrevData,
                            opponent1NewRating,
                            winnerId,
                            tournamentId,
                            team1
                        );
                        console.log(`✓ ${team1} rating updated successfully`);

                        console.log(
                            `Updating ${team2} (${opponent2Id}) rating: ${opponent2CurrentRating.toFixed(2)} → ${opponent2NewRating.toFixed(2)}`
                        );
                        await addScoreToUser(
                            opponent2Id,
                            opponent2PrevData,
                            opponent2NewRating,
                            winnerId,
                            tournamentId,
                            team2
                        );
                        console.log(`✓ ${team2} rating updated successfully`);
                    } catch (error) {
                        console.error('Error updating player ratings:', error);
                        alert(`Error updating ratings: ${error.message}`);
                    }
                } else {
                    console.log('Player ratings update skipped by user');
                }
            }

            // Separate step for player statistics
            const confirmStatistics = confirmWindow(
                `Update Player Statistics?\n\n${team1}:\nOld - Total: ${opponent1Stats.total}, Win: ${opponent1Win}, Lose: ${opponent1Stats.lose}\nNew - Total: ${updatedOpponent1Stats.total}, Win: ${updatedOpponent1Stats.win}, Lose: ${updatedOpponent1Stats.lose}\n\n${team2}:\nOld - Total: ${opponent2Stats.total}, Win: ${opponent2Win}, Lose: ${opponent2Stats.lose}\nNew - Total: ${updatedOpponent2Stats.total}, Win: ${updatedOpponent2Stats.win}, Lose: ${updatedOpponent2Stats.lose}\n\nUpdate?`
            );
            if (!confirmStatistics) {
                console.log('Player statistics update skipped by user');
                alert('⚠️ Player statistics update skipped - continuing with next steps');
                return {
                    success: true,
                    newRatings: {
                        [team1]: opponent1NewRating.toFixed(2),
                        [team2]: opponent2NewRating.toFixed(2)
                    }
                };
            }

            // Update opponent 1 statistics
            const confirmStats1 = confirmWindow(
                `Update ${team1} statistics to database?\n\nTotal: ${updatedOpponent1Stats.total}, Win: ${updatedOpponent1Stats.win}, Lose: ${updatedOpponent1Stats.lose}\n\nUpdate?`
            );
            if (confirmStats1) {
                await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${opponent1Id}/gamesPlayed/heroes3.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify(updatedOpponent1Stats),
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
                console.log(`${team1} statistics updated successfully`);
            } else {
                console.log(`${team1} statistics update skipped by user`);
            }

            // Update opponent 2 statistics
            const confirmStats2 = confirmWindow(
                `Update ${team2} statistics to database?\n\nTotal: ${updatedOpponent2Stats.total}, Win: ${updatedOpponent2Stats.win}, Lose: ${updatedOpponent2Stats.lose}\n\nUpdate?`
            );
            if (confirmStats2) {
                await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${opponent2Id}/gamesPlayed/heroes3.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify(updatedOpponent2Stats),
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
                console.log(`${team2} statistics updated successfully`);
            } else {
                console.log(`${team2} statistics update skipped by user`);
            }

            console.log('Player ratings and statistics process completed');
            alert('✅ Player ratings and statistics process completed!');
            return {
                success: true,
                newRatings: {
                    [team1]: opponent1NewRating.toFixed(2),
                    [team2]: opponent2NewRating.toFixed(2)
                }
            };
        } catch (error) {
            console.error('Error updating player ratings and statistics:', error);
            throw error;
        }
    };

    // Helper function to fetch the current rating for a player from tournament players data
    const getUpdatedPlayerRating = async (playerName) => {
        try {
            const response = await fetch(
                `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/players/.json`
            );
            if (response.ok) {
                const playersData = await response.json();
                const playerData = Object.values(playersData).find((p) => p && p.name === playerName);
                if (playerData && playerData.ratings) {
                    // Extract the latest rating from the comma-separated list
                    const latestRating = playerData.ratings.split(',').pop().trim();
                    return latestRating;
                }
            }
        } catch (error) {
            console.error(`Error fetching updated rating for ${playerName}:`, error);
        }
        return null;
    };

    const handleSubmitGameReport = async (reportData) => {
        // Begin detailed progress tracking
        setDetailedProgressStage('Started');
        try {
            // Update the specific pair in playoffPairs
            const updatedPairs = [...playoffPairs];
            const pair = updatedPairs[selectedStageIndex][selectedPairIndex];
            setDetailedProgressStage('Pair selected');

            if (pair.gameStatus === 'Processed' && !authCtx.isAdmin) {
                alert('This game is already processed. Only admin can re-report it.');
                return;
            }

            if (!canReportGameForPair(pair)) {
                alert('Only match players or admin can submit this game report.');
                return;
            }

            pair.score1 = reportData.score1;
            pair.score2 = reportData.score2;
            pair.winner = reportData.winner;
            pair.games = reportData.games;
            // Set game status based on whether winner is selected
            pair.gameStatus = reportData.winner ? 'Finished' : 'In Progress';
            setDetailedProgressStage('Scores and winner set');

            // Update local state

            setPlayoffPairs(updatedPairs);
            setDetailedProgressStage('Pair state updated');

            // Persist progress to localStorage after updating the pair
            setLatestProcessedStage(pair.gameStatus);

            // Update castle statistics for each game (runs regardless of overall winner)
            let castleIdx = 1;
            for (const game of reportData.games) {
                // Skip games that have already been processed
                if (game.gameStatus === 'Processed') {
                    setDetailedProgressStage(`Game ${castleIdx} already processed`);
                    console.log(`Game ${game.gameId + 1} already processed, skipping castle stats update`);
                    castleIdx++;
                    continue;
                }

                if (game.castle1 && game.castle2) {
                    console.log('game', game);
                    // If winner is selected, update win/lose stats
                    if (game.gameWinner) {
                        // Track if each castle update is skipped
                        let castle1Skipped = false;
                        let castle2Skipped = false;

                        // Update castle1 stats
                        setDetailedProgressStage(`First castle processed`, {
                            castle: game.castle1,
                            gameId: game.gameId
                        });
                        const castle1Response = await fetch(
                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/statistic/heroes3/castles/${game.castle1}.json`
                        );
                        if (castle1Response.ok) {
                            const castle1Data = await castle1Response.json();
                            const isWinner = game.castleWinner === game.castle1;
                            const updatedCastle1Stats = {
                                win: (castle1Data.win || 0) + (isWinner ? 1 : 0),
                                lose: (castle1Data.lose || 0) + (isWinner ? 0 : 1),
                                total: (castle1Data.total || 0) + 1
                            };

                            const confirmCastle1 = confirmWindow(
                                `Update ${game.castle1} castle stats?\n\nOld - Win: ${castle1Data.win || 0}, Lose: ${castle1Data.lose || 0}, Total: ${castle1Data.total || 0}\nNew - Win: ${updatedCastle1Stats.win}, Lose: ${updatedCastle1Stats.lose}, Total: ${updatedCastle1Stats.total}\n\nUpdate?`
                            );
                            if (confirmCastle1) {
                                await fetch(
                                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/statistic/heroes3/castles/${game.castle1}.json`,
                                    {
                                        method: 'PUT',
                                        body: JSON.stringify(updatedCastle1Stats),
                                        headers: { 'Content-Type': 'application/json' }
                                    }
                                );
                                console.log(`${game.castle1} castle stats updated`);
                            } else {
                                castle1Skipped = true;
                                console.log(`${game.castle1} castle stats update skipped`);
                            }
                        }

                        // Update castle2 stats
                        setDetailedProgressStage(`Second castle processed`, {
                            castle: game.castle2,
                            gameId: game.gameId
                        });
                        const castle2Response = await fetch(
                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/statistic/heroes3/castles/${game.castle2}.json`
                        );
                        if (castle2Response.ok) {
                            const castle2Data = await castle2Response.json();
                            const isWinner = game.castleWinner === game.castle2;
                            const updatedCastle2Stats = {
                                win: (castle2Data.win || 0) + (isWinner ? 1 : 0),
                                lose: (castle2Data.lose || 0) + (isWinner ? 0 : 1),
                                total: (castle2Data.total || 0) + 1
                            };

                            const confirmCastle2 = confirmWindow(
                                `Update ${game.castle2} castle stats?\n\nOld - Win: ${castle2Data.win || 0}, Lose: ${castle2Data.lose || 0}, Total: ${castle2Data.total || 0}\nNew - Win: ${updatedCastle2Stats.win}, Lose: ${updatedCastle2Stats.lose}, Total: ${updatedCastle2Stats.total}\n\nUpdate?`
                            );
                            if (confirmCastle2) {
                                await fetch(
                                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/statistic/heroes3/castles/${game.castle2}.json`,
                                    {
                                        method: 'PUT',
                                        body: JSON.stringify(updatedCastle2Stats),
                                        headers: { 'Content-Type': 'application/json' }
                                    }
                                );
                                console.log(`${game.castle2} castle stats updated`);

                                // Mark game as processed after both castle stats are updated
                                game.gameStatus = 'Processed';
                                setDetailedProgressStage(`Game ${castleIdx} marked as Processed`, {
                                    gameId: game.gameId
                                });
                                console.log(`Game ${game.gameId + 1} marked as Processed`);
                            } else {
                                castle2Skipped = true;
                                console.log(`${game.castle2} castle stats update skipped`);
                            }
                        }

                        // If both castle updates were skipped, still mark as processed
                        if (castle1Skipped && castle2Skipped) {
                            game.gameStatus = 'Processed';
                            setDetailedProgressStage(`Game ${castleIdx} marked as Processed (skipped)`, {
                                gameId: game.gameId
                            });
                            console.log(`Game ${game.gameId + 1} marked as Processed (skipped)`);
                        }
                    }
                }
            }

            // If overall winner is selected, handle ratings, game posting, and promotions
            if (reportData.winner) {
                // Update player ratings FIRST
                const winnerId = await lookForUserId(reportData.winner);
                const ratingResult = await updatePlayerRatings(pair.team1, pair.team2, winnerId);
                setDetailedProgressStage('First player stats updated', { player: pair.team1 });
                setDetailedProgressStage('Second player stats updated', { player: pair.team2 });

                // Use the newly calculated ratings directly
                let team1NewRating = null;
                let team2NewRating = null;
                if (ratingResult && ratingResult.newRatings) {
                    team1NewRating = ratingResult.newRatings[pair.team1];
                    team2NewRating = ratingResult.newRatings[pair.team2];

                    if (team1NewRating !== null && team1NewRating !== undefined) {
                        const currentRatings1 =
                            typeof pair.ratings1 === 'string'
                                ? pair.ratings1
                                : pair.ratings1 !== null && pair.ratings1 !== undefined
                                  ? String(pair.ratings1)
                                  : '';
                        pair.ratings1 = currentRatings1 ? `${currentRatings1}, ${team1NewRating}` : `${team1NewRating}`;
                    }
                    if (team2NewRating !== null && team2NewRating !== undefined) {
                        const currentRatings2 =
                            typeof pair.ratings2 === 'string'
                                ? pair.ratings2
                                : pair.ratings2 !== null && pair.ratings2 !== undefined
                                  ? String(pair.ratings2)
                                  : '';
                        pair.ratings2 = currentRatings2 ? `${currentRatings2}, ${team2NewRating}` : `${team2NewRating}`;
                    }
                }
                // Update state to reflect the new ratings for tooltip display
                setPlayoffPairs(updatedPairs);

                setDetailedProgressStage('Game posted to database');
                // Post game to database
                const gameData = {
                    opponent1: pair.team1,
                    opponent2: pair.team2,
                    date: new Date().toISOString(),
                    games: reportData.games,
                    tournamentName: tournamentName,
                    gameType: pair.type,
                    opponent1Castle: reportData.games[0]?.castle1 || '',
                    opponent2Castle: reportData.games[0]?.castle2 || '',
                    score: `${reportData.score1}-${reportData.score2}`,
                    winner: reportData.winner
                };

                console.log('Game data to be posted:', JSON.stringify(gameData, null, 2));
                console.log(
                    'Games with gold and restarts:',
                    gameData.games.map((g) => ({
                        gameId: g.gameId,
                        gold1: g.gold1,
                        gold2: g.gold2,
                        restart1_111: g.restart1_111,
                        restart1_112: g.restart1_112,
                        restart2_111: g.restart2_111,
                        restart2_112: g.restart2_112
                    }))
                );

                const confirmGamePost = confirmWindow(
                    `Post game to database?\n\n${pair.team1} vs ${pair.team2}\nScore: ${reportData.score1}-${reportData.score2}\nWinner: ${reportData.winner}\n\nPost game?`
                );
                if (confirmGamePost) {
                    const matchKey = buildMatchKey(gameData, tournamentId);
                    gameData.matchKey = matchKey;

                    const existingGameResponse = await fetch(
                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3/${matchKey}.json`
                    );
                    const existingGameData = await existingGameResponse.json();

                    if (existingGameData) {
                        console.log('Skipping duplicate game record:', gameData);
                    } else {
                        const fetchResponse = await fetch(
                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3/${matchKey}.json`,
                            {
                                method: 'PUT',
                                body: JSON.stringify(gameData),
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            }
                        );

                        if (fetchResponse.ok) {
                            console.log('Game posted to database successfully');
                            console.log('Gold and restart data stored for all games');
                        } else {
                            console.error('Error posting game to database:', fetchResponse.statusText);
                        }
                    }
                } else {
                    console.log('Game posting skipped by user');
                }

                // Mark pair and all games as 'Processed' (regardless of what was skipped)
                pair.gameStatus = 'Processed';
                setDetailedProgressStage('Ratings updated');
                reportData.games.forEach((game) => {
                    game.gameStatus = 'Processed';
                });

                setDetailedProgressStage('Prizes awarded');
                // Promote winner and loser to next stage
                const currentStage = stageLabels[selectedStageIndex];
                const winner = reportData.winner;
                const loser = pair.team1 === winner ? pair.team2 : pair.team1;

                console.log(`Current stage: ${currentStage}, Winner: ${winner}, Loser: ${loser}`);

                // Promote based on current stage
                if (currentStage === 'Semi-final') {
                    // Winner goes to Final, Loser goes to Third Place
                    const finalStageIndex = stageLabels.indexOf('Final');
                    const thirdPlaceStageIndex = stageLabels.indexOf('Third Place');

                    // Use the newly calculated ratings
                    const winnerRating = winner === pair.team1 ? team1NewRating : team2NewRating;
                    const loserRating = winner === pair.team1 ? team2NewRating : team1NewRating;

                    // Promote winner to Final
                    if (finalStageIndex !== -1 && updatedPairs[finalStageIndex] && updatedPairs[finalStageIndex][0]) {
                        const finalPair = updatedPairs[finalStageIndex][0];
                        const teamSlot = selectedPairIndex === 0 ? 'team1' : 'team2';

                        const confirmPromoteToFinal = confirmWindow(
                            `Promote winner to Final?\n\n${winner} → Final ${teamSlot}\n\nPromote?`
                        );

                        if (confirmPromoteToFinal) {
                            // Determine which slot to fill based on which semi-final this is
                            if (selectedPairIndex === 0) {
                                // First semi-final winner goes to team1 of Final
                                if (finalPair.team1 === 'TBD' || !finalPair.team1) {
                                    finalPair.team1 = winner;
                                    finalPair.ratings1 =
                                        winnerRating || (pair.winner === pair.team1 ? pair.ratings1 : pair.ratings2);
                                    finalPair.stars1 = pair.winner === pair.team1 ? pair.stars1 : pair.stars2;
                                    console.log(
                                        `Promoted ${winner} to Final team1 with updated rating: ${finalPair.ratings1}`
                                    );
                                }
                            } else if (selectedPairIndex === 1) {
                                // Second semi-final winner goes to team2 of Final
                                if (finalPair.team2 === 'TBD' || !finalPair.team2) {
                                    finalPair.team2 = winner;
                                    finalPair.ratings2 =
                                        winnerRating || (pair.winner === pair.team1 ? pair.ratings1 : pair.ratings2);
                                    finalPair.stars2 = pair.winner === pair.team1 ? pair.stars1 : pair.stars2;
                                    console.log(
                                        `Promoted ${winner} to Final team2 with updated rating: ${finalPair.ratings2}`
                                    );
                                }
                            }
                        } else {
                            console.log(`Promotion to Final cancelled by user`);
                        }
                    }

                    // Promote loser to Third Place
                    if (
                        thirdPlaceStageIndex !== -1 &&
                        updatedPairs[thirdPlaceStageIndex] &&
                        updatedPairs[thirdPlaceStageIndex][0]
                    ) {
                        const thirdPlacePair = updatedPairs[thirdPlaceStageIndex][0];
                        const teamSlot = selectedPairIndex === 0 ? 'team1' : 'team2';

                        const confirmPromoteToThirdPlace = confirmWindow(
                            `Promote loser to Third Place?\n\n${loser} → Third Place ${teamSlot}\n\nPromote?`
                        );

                        if (confirmPromoteToThirdPlace) {
                            // Determine which slot to fill based on which semi-final this is
                            if (selectedPairIndex === 0) {
                                // First semi-final loser goes to team1 of Third Place
                                if (thirdPlacePair.team1 === 'TBD' || !thirdPlacePair.team1) {
                                    thirdPlacePair.team1 = loser;
                                    thirdPlacePair.ratings1 =
                                        loserRating || (pair.winner === pair.team1 ? pair.ratings2 : pair.ratings1);
                                    thirdPlacePair.stars1 = pair.winner === pair.team1 ? pair.stars2 : pair.stars1;
                                    console.log(
                                        `Promoted ${loser} to Third Place team1 with updated rating: ${thirdPlacePair.ratings1}`
                                    );
                                }
                            } else if (selectedPairIndex === 1) {
                                // Second semi-final loser goes to team2 of Third Place
                                if (thirdPlacePair.team2 === 'TBD' || !thirdPlacePair.team2) {
                                    thirdPlacePair.team2 = loser;
                                    thirdPlacePair.ratings2 =
                                        loserRating || (pair.winner === pair.team1 ? pair.ratings2 : pair.ratings1);
                                    thirdPlacePair.stars2 = pair.winner === pair.team1 ? pair.stars2 : pair.stars1;
                                    console.log(
                                        `Promoted ${loser} to Third Place team2 with updated rating: ${thirdPlacePair.ratings2}`
                                    );
                                }
                            }
                        } else {
                            console.log(`Promotion to Third Place cancelled by user`);
                        }
                    }
                } else if (currentStage === 'Quarter-final') {
                    // Winner goes to Semi-final
                    // Use the newly calculated rating for the winner
                    const winnerRating = winner === pair.team1 ? team1NewRating : team2NewRating;

                    const semiStageIndex = stageLabels.indexOf('Semi-final');
                    if (semiStageIndex !== -1 && updatedPairs[semiStageIndex]) {
                        const semiPairIndex = Math.floor(selectedPairIndex / 2);
                        const semiPair = updatedPairs[semiStageIndex][semiPairIndex];
                        if (semiPair) {
                            const teamSlot = selectedPairIndex % 2 === 0 ? 'team1' : 'team2';
                            const ratingsSlot = selectedPairIndex % 2 === 0 ? 'ratings1' : 'ratings2';
                            const starsSlot = selectedPairIndex % 2 === 0 ? 'stars1' : 'stars2';

                            const confirmPromoteToSemi = confirmWindow(
                                `Promote winner to Semi-final?\n\n${winner} → Semi-final ${semiPairIndex + 1} ${teamSlot}\n\nPromote?`
                            );

                            if (confirmPromoteToSemi) {
                                if (semiPair[teamSlot] === 'TBD' || !semiPair[teamSlot]) {
                                    semiPair[teamSlot] = winner;
                                    // Persist progress to localStorage for each finished pair
                                    setLatestProcessedStage('Finished');
                                    semiPair[ratingsSlot] =
                                        winnerRating || (pair.winner === pair.team1 ? pair.ratings1 : pair.ratings2);
                                    semiPair[starsSlot] = pair.winner === pair.team1 ? pair.stars1 : pair.stars2;
                                    console.log(
                                        `Promoted ${winner} to Semi-final ${semiPairIndex} ${teamSlot} with updated rating: ${semiPair[ratingsSlot]}`
                                    );
                                }
                            } else {
                                console.log(`Promotion to Semi-final cancelled by user`);
                            }
                        }
                    }
                } else if (currentStage === '1/8 Final') {
                    // Winner goes to Quarter-final
                    // Use the newly calculated rating for the winner
                    const winnerRating = winner === pair.team1 ? team1NewRating : team2NewRating;

                    const quarterStageIndex = stageLabels.indexOf('Quarter-final');
                    if (quarterStageIndex !== -1 && updatedPairs[quarterStageIndex]) {
                        const quarterPairIndex = Math.floor(selectedPairIndex / 2);
                        const quarterPair = updatedPairs[quarterStageIndex][quarterPairIndex];
                        if (quarterPair) {
                            const teamSlot = selectedPairIndex % 2 === 0 ? 'team1' : 'team2';
                            setLatestProcessedStage('Finished');
                            const ratingsSlot = selectedPairIndex % 2 === 0 ? 'ratings1' : 'ratings2';
                            const starsSlot = selectedPairIndex % 2 === 0 ? 'stars1' : 'stars2';

                            const confirmPromoteToQuarter = confirmWindow(
                                `Promote winner to Quarter-final?\n\n${winner} → Quarter-final ${quarterPairIndex + 1} ${teamSlot}\n\nPromote?`
                            );

                            setLatestProcessedStage('In Progress');
                            if (confirmPromoteToQuarter) {
                                if (quarterPair[teamSlot] === 'TBD' || !quarterPair[teamSlot]) {
                                    quarterPair[teamSlot] = winner;
                                    quarterPair[ratingsSlot] =
                                        winnerRating || (pair.winner === pair.team1 ? pair.ratings1 : pair.ratings2);
                                    quarterPair[starsSlot] = pair.winner === pair.team1 ? pair.stars1 : pair.stars2;
                                    console.log(
                                        `Promoted ${winner} to Quarter-final ${quarterPairIndex} ${teamSlot} with updated rating: ${quarterPair[ratingsSlot]}`
                                    );
                                }
                            } else {
                                console.log(`Promotion to Quarter-final cancelled by user`);
                            }
                        }
                    }
                } else if (currentStage === '1/16 Final') {
                    // Winner goes to 1/8 Final
                    // Use the newly calculated rating for the winner
                    const winnerRating = winner === pair.team1 ? team1NewRating : team2NewRating;

                    const eighthStageIndex = stageLabels.indexOf('1/8 Final');
                    if (eighthStageIndex !== -1 && updatedPairs[eighthStageIndex]) {
                        const eighthPairIndex = Math.floor(selectedPairIndex / 2);
                        const eighthPair = updatedPairs[eighthStageIndex][eighthPairIndex];
                        if (eighthPair) {
                            const teamSlot = selectedPairIndex % 2 === 0 ? 'team1' : 'team2';
                            const ratingsSlot = selectedPairIndex % 2 === 0 ? 'ratings1' : 'ratings2';
                            const starsSlot = selectedPairIndex % 2 === 0 ? 'stars1' : 'stars2';

                            const confirmPromoteToEighth = confirmWindow(
                                `Promote winner to 1/8 Final?\n\n${winner} → 1/8 Final ${eighthPairIndex + 1} ${teamSlot}\n\nPromote?`
                            );

                            if (confirmPromoteToEighth) {
                                if (eighthPair[teamSlot] === 'TBD' || !eighthPair[teamSlot]) {
                                    eighthPair[teamSlot] = winner;
                                    eighthPair[ratingsSlot] =
                                        winnerRating || (pair.winner === pair.team1 ? pair.ratings1 : pair.ratings2);
                                    eighthPair[starsSlot] = pair.winner === pair.team1 ? pair.stars1 : pair.stars2;
                                    console.log(
                                        `Promoted ${winner} to 1/8 Final ${eighthPairIndex} ${teamSlot} with updated rating: ${eighthPair[ratingsSlot]}`
                                    );
                                }
                            } else {
                                console.log(`Promotion to 1/8 Final cancelled by user`);
                            }
                        }
                    }
                } else if (currentStage === 'Third Place') {
                    // Award Third Place prize to the winner
                    console.log(`Third Place game completed. Winner: ${winner}`);

                    const confirmThirdPlacePrize = confirmWindow(
                        `Award Third Place prize to ${winner}?\n\nThis will update the tournament winners and player's prize record.\n\nAward prize?`
                    );

                    if (confirmThirdPlacePrize) {
                        try {
                            // Get tournament prizes
                            const prizes = await pullTournamentPrizes(tournamentId);
                            const prizeAmount = prizes['3rd Place'];

                            console.log('Third Place Prize:', prizeAmount);

                            // Find and update player record
                            const playerId = await lookForUserId(winner);
                            if (playerId) {
                                const playerData = await loadUserById(playerId);

                                if (playerData) {
                                    // Initialize prizes array if it doesn't exist
                                    if (!playerData.prizes) {
                                        playerData.prizes = [];
                                    }

                                    // Add new prize
                                    playerData.prizes.push({
                                        tournamentName: tournamentName,
                                        place: '3rd Place',
                                        prizeAmount: prizeAmount
                                    });

                                    // Calculate new total prize
                                    const currentTotal = await getPlayerPrizeTotal(playerId);
                                    const newTotal = parseFloat(currentTotal || 0) + parseFloat(prizeAmount);
                                    playerData.totalPrize = newTotal;

                                    console.log('Updated player data:', playerData);

                                    // Update tournament winners
                                    const confirmUpdateWinner = confirmWindow(
                                        `Update tournament 3rd place winner?\n\nWinner: ${winner}\nPrize: ${prizeAmount}\n\nUpdate?`
                                    );

                                    if (confirmUpdateWinner) {
                                        await fetch(
                                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/3rd place.json`,
                                            {
                                                method: 'PUT',
                                                body: JSON.stringify(winner),
                                                headers: { 'Content-Type': 'application/json' }
                                            }
                                        );
                                        console.log('Tournament 3rd place winner updated');
                                    }

                                    // Update player record
                                    const confirmUpdatePlayer = confirmWindow(
                                        `Update player record with prize?\n\nPlayer: ${winner}\nOld Total: ${currentTotal}\nNew Total: ${newTotal}\n\nUpdate?`
                                    );

                                    if (confirmUpdatePlayer) {
                                        await fetch(
                                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${playerId}.json`,
                                            {
                                                method: 'PUT',
                                                body: JSON.stringify(playerData),
                                                headers: { 'Content-Type': 'application/json' }
                                            }
                                        );
                                        console.log('Player record updated with 3rd place prize');
                                    }
                                } else {
                                    console.log('Player data not found');
                                    alert('Could not load player data for prize award');
                                }
                            } else {
                                console.log('Player ID not found');
                                alert('Could not find player ID for prize award');
                            }
                        } catch (error) {
                            console.error('Error awarding Third Place prize:', error);
                            alert('Error awarding Third Place prize: ' + error.message);
                        }

                        // Mark pair and all games as 'Processed' for Third Place
                        pair.gameStatus = 'Processed';
                        reportData.games.forEach((game) => {
                            game.gameStatus = 'Processed';
                        });
                        console.log('Third Place games marked as Processed');
                    } else {
                        console.log('Third Place prize award cancelled by user');
                    }
                } else if (currentStage === 'Final') {
                    // Award Final prizes to winner (1st place) and loser (2nd place)
                    console.log(`Final game completed. Winner: ${winner}, Runner-up: ${loser}`);

                    const confirmFinalPrizes = confirmWindow(
                        `Award Final prizes?\n\n1st Place: ${winner}\n2nd Place: ${loser}\n\nThis will update tournament winners and player prize records.\n\nAward prizes?`
                    );

                    if (confirmFinalPrizes) {
                        try {
                            // Get tournament prizes
                            const prizes = await pullTournamentPrizes(tournamentId);
                            const firstPlacePrize = prizes['1st Place'];
                            const secondPlacePrize = prizes['2nd Place'];

                            console.log('1st Place Prize:', firstPlacePrize);
                            console.log('2nd Place Prize:', secondPlacePrize);

                            // Award 1st place prize
                            const firstPlacePlayerId = await lookForUserId(winner);
                            if (firstPlacePlayerId) {
                                const winnerData = await loadUserById(firstPlacePlayerId);
                                if (winnerData) {
                                    // Initialize prizes array if it doesn't exist
                                    if (!winnerData.prizes) {
                                        winnerData.prizes = [];
                                    }

                                    // Add new prize
                                    winnerData.prizes.push({
                                        tournamentName: tournamentName,
                                        place: '1st Place',
                                        prizeAmount: firstPlacePrize
                                    });

                                    // Calculate new total prize
                                    const winnerCurrentTotal = await getPlayerPrizeTotal(firstPlacePlayerId);
                                    const winnerNewTotal =
                                        parseFloat(winnerCurrentTotal || 0) + parseFloat(firstPlacePrize);
                                    winnerData.totalPrize = winnerNewTotal;

                                    console.log('Updated winner data:', winnerData);

                                    // Update tournament 1st place winner
                                    const confirmUpdateWinner = confirmWindow(
                                        `Update tournament 1st place winner?\n\nWinner: ${winner}\nPrize: ${firstPlacePrize}\n\nUpdate?`
                                    );

                                    if (confirmUpdateWinner) {
                                        await fetch(
                                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/1st place.json`,
                                            {
                                                method: 'PUT',
                                                body: JSON.stringify(winner),
                                                headers: { 'Content-Type': 'application/json' }
                                            }
                                        );
                                        console.log('Tournament 1st place winner updated');
                                    }

                                    // Update winner record
                                    const confirmUpdateWinnerPlayer = confirmWindow(
                                        `Update winner record with prize?\n\nPlayer: ${winner}\nOld Total: ${winnerCurrentTotal}\nNew Total: ${winnerNewTotal}\n\nUpdate?`
                                    );

                                    if (confirmUpdateWinnerPlayer) {
                                        await fetch(
                                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${firstPlacePlayerId}.json`,
                                            {
                                                method: 'PUT',
                                                body: JSON.stringify(winnerData),
                                                headers: { 'Content-Type': 'application/json' }
                                            }
                                        );
                                        console.log('Winner record updated with 1st place prize');
                                    }
                                } else {
                                    console.log('Winner data not found');
                                    alert('Could not load winner data for prize award');
                                }
                            } else {
                                console.log('Winner ID not found');
                                alert('Could not find winner ID for prize award');
                            }

                            // Award 2nd place prize
                            const secondPlacePlayerId = await lookForUserId(loser);
                            if (secondPlacePlayerId) {
                                const loserData = await loadUserById(secondPlacePlayerId);
                                if (loserData) {
                                    // Initialize prizes array if it doesn't exist
                                    if (!loserData.prizes) {
                                        loserData.prizes = [];
                                    }

                                    // Add new prize
                                    loserData.prizes.push({
                                        tournamentName: tournamentName,
                                        place: '2nd Place',
                                        prizeAmount: secondPlacePrize
                                    });

                                    // Calculate new total prize
                                    const loserCurrentTotal = await getPlayerPrizeTotal(secondPlacePlayerId);
                                    const loserNewTotal =
                                        parseFloat(loserCurrentTotal || 0) + parseFloat(secondPlacePrize);
                                    loserData.totalPrize = loserNewTotal;

                                    console.log('Updated runner-up data:', loserData);

                                    // Update tournament 2nd place winner
                                    const confirmUpdateRunnerUp = confirmWindow(
                                        `Update tournament 2nd place winner?\n\nRunner-up: ${loser}\nPrize: ${secondPlacePrize}\n\nUpdate?`
                                    );

                                    if (confirmUpdateRunnerUp) {
                                        await fetch(
                                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/winners/2nd place.json`,
                                            {
                                                method: 'PUT',
                                                body: JSON.stringify(loser),
                                                headers: { 'Content-Type': 'application/json' }
                                            }
                                        );
                                        console.log('Tournament 2nd place winner updated');
                                    }

                                    // Update runner-up record
                                    const confirmUpdateLoserPlayer = confirmWindow(
                                        `Update runner-up record with prize?\n\nPlayer: ${loser}\nOld Total: ${loserCurrentTotal}\nNew Total: ${loserNewTotal}\n\nUpdate?`
                                    );

                                    if (confirmUpdateLoserPlayer) {
                                        await fetch(
                                            `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${secondPlacePlayerId}.json`,
                                            {
                                                method: 'PUT',
                                                body: JSON.stringify(loserData),
                                                headers: { 'Content-Type': 'application/json' }
                                            }
                                        );
                                        console.log('Runner-up record updated with 2nd place prize');
                                    }
                                } else {
                                    console.log('Runner-up data not found');
                                    alert('Could not load runner-up data for prize award');
                                }
                            } else {
                                console.log('Runner-up ID not found');
                                alert('Could not find runner-up ID for prize award');
                            }
                        } catch (error) {
                            console.error('Error awarding Final prizes:', error);
                            alert('Error awarding Final prizes: ' + error.message);
                        }

                        // Mark pair and all games as 'Processed' for Final
                        pair.gameStatus = 'Processed';
                        reportData.games.forEach((game) => {
                            game.gameStatus = 'Processed';
                        });
                        console.log('Final games marked as Processed');

                        // Update tournament status to "Tournament Finished"
                        const confirmStatusUpdate = confirmWindow(
                            `Update tournament status to 'Tournament Finished'?\n\nThis will mark the tournament as complete.\n\nUpdate status?`
                        );

                        if (confirmStatusUpdate) {
                            try {
                                await fetch(
                                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/status.json`,
                                    {
                                        method: 'PUT',
                                        body: JSON.stringify('Tournament Finished'),
                                        headers: { 'Content-Type': 'application/json' }
                                    }
                                );
                                console.log('Tournament status updated to Tournament Finished');

                                // Automatically snapshot current leaderboard rankings after tournament finishes
                                try {
                                    const snapshotResult = await snapshotLeaderboardRanks();
                                    if (snapshotResult.success) {
                                        console.log(
                                            `Leaderboard snapshot taken after tournament: ${snapshotResult.successCount} players, ${snapshotResult.errorCount} errors`
                                        );
                                    } else {
                                        console.error(
                                            'Failed to snapshot leaderboard after tournament:',
                                            snapshotResult.error
                                        );
                                    }
                                } catch (error) {
                                    console.error('Error during leaderboard snapshot after tournament:', error);
                                }

                                // Recalculate stars for all players based on new ratings
                                const confirmRecalculateStars = confirmWindow(
                                    `Recalculate stars for all players based on updated ratings?\n\nThis will update player stars according to their new ratings.\n\nRecalculate stars?`
                                );

                                if (confirmRecalculateStars) {
                                    try {
                                        const result = await recalculatePlayerStars();
                                        console.log(
                                            `All player stars recalculated successfully. Updated ${result.updatedCount} players.`
                                        );
                                        alert('Player stars recalculated successfully!');
                                    } catch (error) {
                                        console.error('Error recalculating stars:', error);
                                        alert('Error recalculating stars: ' + error.message);
                                    }
                                } else {
                                    console.log('Star recalculation cancelled by user');
                                }
                            } catch (error) {
                                console.error('Error updating tournament status:', error);
                                alert('Error updating tournament status: ' + error.message);
                            }
                        } else {
                            console.log('Tournament status update cancelled by user');
                        }
                    } else {
                        console.log('Final prizes award cancelled by user');
                    }
                }

                // Update the local state with promoted players
                setPlayoffPairs(updatedPairs);
                setDetailedProgressStage('Finished');
            }

            // Post to Firebase
            const confirmBracketUpdate = confirmWindow(
                `Update tournament bracket in database?\n\nThis will save all changes to the tournament.\n\nUpdate bracket?`
            );
            if (confirmBracketUpdate) {
                const response = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/playoffPairs.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify(updatedPairs),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (response.ok) {
                    setShowReportGameModal(false);
                    alert('Game result reported successfully!');
                } else {
                    alert('Error updating tournament bracket');
                }
            } else {
                console.log('Bracket update skipped by user');
                alert('Bracket update cancelled - local changes saved but not synced to database');
                setShowReportGameModal(false);
            }
        } catch (error) {
            setDetailedProgressStage('Error', { error: error.message });
            console.error('Error reporting game result:', error);
            alert('Error reporting game result');
        }
    };

    return (
        <div className={`scrollable-list-class brackets-class`} style={{ overflowY: 'auto', maxHeight: '80vh' }}>
            <div
                className={classes.brackets}
                style={{
                    position: 'fixed',
                    top: 0,
                    backgroundColor: 'rgb(62, 32, 192)', // Match the modal background
                    color: 'yellow',
                    padding: '1rem',
                    zIndex: 1000,
                    textAlign: 'center',
                    borderBottom: '1px solid white',
                    width: '100%',
                    left: 0
                }}
            >
                {!startTournament && isUpdateButtonVisible && (
                    <div
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}
                    >
                        <button
                            id="update-tournament"
                            onClick={() => updateTournament()}
                            className={classes.actionButton}
                            style={{ padding: '0.8rem 1.5rem', fontSize: '1rem', minWidth: '180px' }}
                        >
                            Update Tournament
                        </button>

                        <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>{tournamentName}</div>
                            {tournamentWinners && (
                                <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
                                    <p style={{ color: 'gold', margin: '0.4rem 0' }}>
                                        🥇 Gold: {tournamentWinners['1st place']}
                                    </p>
                                    <p style={{ color: 'silver', margin: '0.4rem 0' }}>
                                        🥈 Silver: {tournamentWinners['2nd place']}
                                    </p>
                                    <p style={{ color: '#CD7F32', margin: '0.4rem 0' }}>
                                        🥉 Bronze: {tournamentWinners['3rd place']}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                                onClick={() => handleGetAvailableCastles()}
                                className={classes.actionButton}
                                style={{ padding: '0.8rem 1.5rem', fontSize: '1rem', minWidth: '180px' }}
                            >
                                Get Available Castles
                            </button>
                        </div>
                    </div>
                )}
                {!startTournament && !isUpdateButtonVisible && authCtx.isAdmin && (
                    <div style={{ marginBottom: '1rem' }}>
                        {tournamentName}
                        {tournamentWinners && (
                            <p style={{ color: 'gold', margin: 0, fontSize: '1.4rem', fontWeight: 'bold' }}>
                                🥇 Gold: {tournamentWinners['1st place']}
                            </p>
                        )}
                        {tournamentWinners && (
                            <p style={{ color: 'silver', margin: 0, fontSize: '1.4rem', fontWeight: 'bold' }}>
                                🥈 Silver: {tournamentWinners['2nd place']}
                            </p>
                        )}
                        {tournamentWinners && (
                            <p style={{ color: '#CD7F32', margin: 0, fontSize: '1.4rem', fontWeight: 'bold' }}>
                                🥉 Bronze: {tournamentWinners['3rd place']}
                            </p>
                        )}
                        <button
                            onClick={async () => {
                                const confirmed = window.confirm(
                                    "Recalculate stars for ALL players based on their current ratings?\n\nThis will update every player's star count."
                                );
                                if (!confirmed) {
                                    return;
                                }
                                try {
                                    const result = await recalculatePlayerStars();
                                    alert(`Stars recalculated successfully! Updated ${result.updatedCount} players.`);
                                } catch (error) {
                                    console.error('Error recalculating stars:', error);
                                    alert('Error recalculating stars: ' + error.message);
                                }
                            }}
                            className={classes.actionButton}
                            style={{
                                marginTop: '0.75rem',
                                padding: '0.6rem 1.2rem',
                                fontSize: '0.95rem',
                                background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
                            }}
                        >
                            ⭐ Recalculate Stars Now
                        </button>
                    </div>
                )}
            </div>

            {/* Render the spinning wheel modal */}
            {isSpinningWheelOpen && (
                <Modal onClose={() => setIsSpinningWheelOpen(false)}>
                    <SpinningWheel players={playersObj} onStartTournament={onStartTournament} />
                </Modal>
            )}

            {showCastlesModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000,
                        overflow: 'hidden'
                    }}
                    onClick={() => setShowCastlesModal(false)}
                >
                    <div
                        style={{
                            background:
                                'linear-gradient(135deg, rgba(62, 32, 192, 0.98) 0%, rgba(45, 20, 150, 0.98) 100%)',
                            padding: '2rem',
                            borderRadius: '12px',
                            border: '2px solid gold',
                            minWidth: '400px',
                            maxWidth: '600px',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                            position: 'relative',
                            animation: 'slideIn 0.3s ease-out'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setShowCastlesModal(false)}
                            style={{
                                position: 'absolute',
                                top: '1rem',
                                right: '1rem',
                                background: 'gold',
                                border: 'none',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                color: 'rgb(62, 32, 192)',
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                                transition: 'transform 0.2s ease'
                            }}
                            onMouseEnter={(e) => (e.target.style.transform = 'rotate(90deg)')}
                            onMouseLeave={(e) => (e.target.style.transform = 'rotate(0deg)')}
                        >
                            ×
                        </button>
                        <h3
                            style={{
                                color: 'gold',
                                textAlign: 'center',
                                marginBottom: '1.5rem',
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)'
                            }}
                        >
                            Available Castles
                        </h3>
                        <ul
                            style={{
                                listStyle: 'none',
                                padding: 0,
                                margin: 0
                            }}
                        >
                            {(() => {
                                // Find min and max total values (including live games)
                                const totals = availableCastles.map((castle) => castle.total + (castle.liveGames || 0));
                                const minTotal = Math.min(...totals);
                                const maxTotal = Math.max(...totals);

                                return availableCastles.map((castle, idx) => {
                                    const isLive = castle.liveGames > 0;
                                    const castleTotal = castle.total + (castle.liveGames || 0);
                                    return (
                                        <li
                                            key={idx}
                                            style={{
                                                padding: '0.75rem 1rem',
                                                margin: '0.5rem 0',
                                                background: isLive
                                                    ? 'rgba(255, 165, 0, 0.3)'
                                                    : 'rgba(45, 20, 150, 0.6)',
                                                borderLeft: isLive ? '4px solid #ff6b00' : '4px solid gold',
                                                borderRadius: '6px',
                                                color:
                                                    castleTotal === minTotal
                                                        ? '#4ade80'
                                                        : castleTotal === maxTotal
                                                          ? '#f87171'
                                                          : '#FFD700',
                                                fontWeight:
                                                    castleTotal === minTotal || castleTotal === maxTotal
                                                        ? 'bold'
                                                        : 'normal',
                                                fontSize: '1.1rem',
                                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                                cursor: 'default'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.target.style.transform = 'translateX(5px)';
                                                e.target.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.target.style.transform = 'translateX(0)';
                                                e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
                                            }}
                                        >
                                            <span style={{ fontWeight: 'bold' }}>
                                                {castle.name}
                                                {isLive && (
                                                    <span
                                                        style={{
                                                            marginLeft: '8px',
                                                            padding: '2px 6px',
                                                            background: '#ff6b00',
                                                            color: 'white',
                                                            borderRadius: '4px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        🔴 LIVE ({castle.liveGames})
                                                    </span>
                                                )}
                                            </span>
                                            <span style={{ float: 'right', color: 'white' }}>
                                                Games: {castle.total}
                                                {isLive && (
                                                    <span
                                                        style={{
                                                            color: '#ff6b00',
                                                            fontWeight: 'bold',
                                                            marginLeft: '4px'
                                                        }}
                                                    >
                                                        +{castle.liveGames}
                                                    </span>
                                                )}
                                            </span>
                                        </li>
                                    );
                                });
                            })()}
                        </ul>
                        <button
                            onClick={() => setShowCastlesModal(false)}
                            style={{
                                marginTop: '1.5rem',
                                width: '100%',
                                padding: '0.75rem',
                                background: 'linear-gradient(135deg, gold 0%, #FFD700 100%)',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'rgb(62, 32, 192)',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 6px 16px rgba(255, 215, 0, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {!startTournament && tournamentStatus === 'Registration finished!' && (
                <button onClick={handleStartTournament} className={classes.actionButton}>
                    Start Tournament
                </button>
            )}
            {startTournament && playoffPairs.length === 0 && (
                <button onClick={() => shuffleArray(uniquePlayerNames)} className={classes.actionButton}>
                    Shuffle
                </button>
            )}

            {stageLabels.length === 0 ? (
                <h6>Tournament registration hasn't started</h6>
            ) : (
                <div className={classes['bracket-stages-container']} style={{ marginTop: '100px' }}>
                    {stageLabels.map(function (stage, stageIndex) {
                        // Combine Final and Third Place in one column
                        if (stage === 'Final') {
                            const thirdPlaceIndex = stageLabels.findIndex((label) => label === 'Third Place');
                            const finalPairs = playoffPairs[stageIndex] || [];
                            const thirdPlacePairs = thirdPlaceIndex !== -1 ? playoffPairs[thirdPlaceIndex] || [] : [];

                            return (
                                <div
                                    key="final-and-third"
                                    className={`${classes['bracket-stages-column']} 
                        ${stageIndex === currentStageIndex ? classes.active : ''}`}
                                >
                                    <h3 style={{ color: 'red' }}>Final</h3>
                                    {finalPairs.map((pair, pairIndex) => {
                                        const { team1, team2, score1, score2, winner, castle1, castle2, type } = pair;
                                        const hasTruthyPlayers = (team1 && team2 && team1 !== 'TBD') || team2 !== 'TBD';

                                        // ...BO3_DEFAULT logic if needed...

                                        return (
                                            <div
                                                key={`final-${pairIndex}`}
                                                className={classes['game-block']}
                                                style={{ position: 'relative' }}
                                            >
                                                {/* Stats button positioned bottom right */}
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: '0.5rem',
                                                        right: '0.5rem',
                                                        zIndex: 1
                                                    }}
                                                >
                                                    {renderShowStatsButton(pair.team1, pair.team2, handleShowStats)}
                                                </div>

                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                                                        alignItems: 'center',
                                                        gap: '0.75rem',
                                                        width: '100%'
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '0.5rem',
                                                            minWidth: 0
                                                        }}
                                                    >
                                                        <PlayerBracket
                                                            pair={pair}
                                                            team={'team1'}
                                                            pairIndex={pairIndex}
                                                            hasTruthyPlayers={hasTruthyPlayers}
                                                            stageIndex={stageIndex}
                                                            setPlayoffPairs={setPlayoffPairs}
                                                            handleCastleChange={handleCastleChange}
                                                            handleScoreChange={handleScoreChange}
                                                            handleBlur={handleBlur}
                                                            handleRadioChange={handleRadioChange}
                                                            stage={stage}
                                                            teamIndex={1}
                                                            getWinner={getWinner}
                                                            clickedRadioButton={clickedRadioButton}
                                                            playersObj={playersObj}
                                                        />
                                                        <PlayerBracket
                                                            pair={pair}
                                                            team={'team2'}
                                                            pairIndex={pairIndex}
                                                            hasTruthyPlayers={hasTruthyPlayers}
                                                            stageIndex={stageIndex}
                                                            setPlayoffPairs={setPlayoffPairs}
                                                            handleCastleChange={handleCastleChange}
                                                            handleScoreChange={handleScoreChange}
                                                            handleBlur={handleBlur}
                                                            handleRadioChange={handleRadioChange}
                                                            stage={stage}
                                                            teamIndex={2}
                                                            getWinner={getWinner}
                                                            isManualScore={isManualScore}
                                                            clickedRadioButton={clickedRadioButton}
                                                            playersObj={playersObj}
                                                        />
                                                    </div>
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            gap: '0.5rem',
                                                            alignItems: 'center',
                                                            justifyContent: 'flex-end'
                                                        }}
                                                    >
                                                        {pair.team1 !== 'TBD' &&
                                                        pair.team2 !== 'TBD' &&
                                                        canViewReportButtonForPair(pair) ? (
                                                            <button
                                                                onClick={() =>
                                                                    handleOpenReportGame(pair, stageIndex, pairIndex)
                                                                }
                                                                disabled={
                                                                    pair.gameStatus === 'Processed' && !authCtx.isAdmin
                                                                }
                                                                style={{
                                                                    padding: '0.5rem 1rem',
                                                                    background:
                                                                        pair.gameStatus === 'Processed'
                                                                            ? '#808080'
                                                                            : 'gold',
                                                                    border: 'none',
                                                                    borderRadius: '6px',
                                                                    color:
                                                                        pair.gameStatus === 'Processed'
                                                                            ? '#ffffff'
                                                                            : 'rgb(62, 32, 192)',
                                                                    fontWeight: 'bold',
                                                                    cursor:
                                                                        pair.gameStatus === 'Processed' &&
                                                                        !authCtx.isAdmin
                                                                            ? 'not-allowed'
                                                                            : 'pointer',
                                                                    opacity:
                                                                        pair.gameStatus === 'Processed' &&
                                                                        !authCtx.isAdmin
                                                                            ? 0.75
                                                                            : 1,
                                                                    fontSize: '0.9rem'
                                                                }}
                                                            >
                                                                {pair.gameStatus === 'Processed' && !authCtx.isAdmin
                                                                    ? '🔒 Report Game'
                                                                    : pair.gameStatus === 'Processed'
                                                                      ? 'Re-report Game'
                                                                      : 'Report Game'}
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <h3 style={{ color: 'orange', marginTop: '20rem' }}>Third Place</h3>
                                    {thirdPlacePairs.map((pair, pairIndex) => {
                                        const { team1, team2, score1, score2, winner, castle1, castle2, type } = pair;
                                        const hasTruthyPlayers = (team1 && team2 && team1 !== 'TBD') || team2 !== 'TBD';
                                        return (
                                            <div key={`thirdplace-${pairIndex}`} className={classes['game-block']}>
                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                                                        alignItems: 'center',
                                                        gap: '0.75rem',
                                                        width: '100%'
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '0.5rem',
                                                            minWidth: 0
                                                        }}
                                                    >
                                                        <PlayerBracket
                                                            pair={pair}
                                                            team={'team1'}
                                                            pairIndex={pairIndex}
                                                            hasTruthyPlayers={hasTruthyPlayers}
                                                            stageIndex={stageIndex - 1}
                                                            setPlayoffPairs={setPlayoffPairs}
                                                            handleCastleChange={handleCastleChange}
                                                            handleScoreChange={handleScoreChange}
                                                            handleBlur={handleBlur}
                                                            handleRadioChange={handleRadioChange}
                                                            stage={stage}
                                                            teamIndex={1}
                                                            getWinner={getWinner}
                                                            clickedRadioButton={clickedRadioButton}
                                                            playersObj={playersObj}
                                                        />
                                                        <PlayerBracket
                                                            pair={pair}
                                                            team={'team2'}
                                                            pairIndex={pairIndex}
                                                            hasTruthyPlayers={hasTruthyPlayers}
                                                            stageIndex={stageIndex - 1}
                                                            setPlayoffPairs={setPlayoffPairs}
                                                            handleCastleChange={handleCastleChange}
                                                            handleScoreChange={handleScoreChange}
                                                            handleBlur={handleBlur}
                                                            handleRadioChange={handleRadioChange}
                                                            stage={stage}
                                                            teamIndex={2}
                                                            getWinner={getWinner}
                                                            isManualScore={isManualScore}
                                                            clickedRadioButton={clickedRadioButton}
                                                            playersObj={playersObj}
                                                        />
                                                    </div>
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            gap: '0.5rem',
                                                            alignItems: 'center',
                                                            justifyContent: 'flex-end'
                                                        }}
                                                    >
                                                        {pair.team1 !== 'TBD' &&
                                                        pair.team2 !== 'TBD' &&
                                                        canViewReportButtonForPair(pair) ? (
                                                            <button
                                                                onClick={() =>
                                                                    handleOpenReportGame(
                                                                        pair,
                                                                        thirdPlaceIndex,
                                                                        pairIndex
                                                                    )
                                                                }
                                                                disabled={
                                                                    pair.gameStatus === 'Processed' && !authCtx.isAdmin
                                                                }
                                                                style={{
                                                                    padding: '0.5rem 1rem',
                                                                    background:
                                                                        pair.gameStatus === 'Processed'
                                                                            ? '#808080'
                                                                            : 'gold',
                                                                    border: 'none',
                                                                    borderRadius: '6px',
                                                                    color:
                                                                        pair.gameStatus === 'Processed'
                                                                            ? '#ffffff'
                                                                            : 'rgb(62, 32, 192)',
                                                                    fontWeight: 'bold',
                                                                    cursor:
                                                                        pair.gameStatus === 'Processed' &&
                                                                        !authCtx.isAdmin
                                                                            ? 'not-allowed'
                                                                            : 'pointer',
                                                                    opacity:
                                                                        pair.gameStatus === 'Processed' &&
                                                                        !authCtx.isAdmin
                                                                            ? 0.75
                                                                            : 1,
                                                                    fontSize: '0.9rem'
                                                                }}
                                                            >
                                                                {pair.gameStatus === 'Processed' && !authCtx.isAdmin
                                                                    ? '🔒 Report Game'
                                                                    : pair.gameStatus === 'Processed'
                                                                      ? 'Re-report Game'
                                                                      : 'Report Game'}
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            bottom: '0.5rem',
                                                            right: '0.5rem',
                                                            zIndex: 2
                                                        }}
                                                    >
                                                        {renderShowStatsButton(pair.team1, pair.team2, handleShowStats)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        }

                        // Skip rendering the Third Place column separately
                        if (stage === 'Third Place') {
                            return null;
                        }

                        // Default rendering for other stages
                        return (
                            <div
                                key={stage}
                                className={`${classes['bracket-stages-column']} ${stageIndex === currentStageIndex ? classes.active : ''}`}
                            >
                                <h3 style={{ color: 'red' }}>{stage}</h3>
                                {playoffPairs[stageIndex]?.map((pair, pairIndex) => {
                                    // console.log('pair-map', pair);
                                    const { team1, team2, score1, score2, winner, castle1, castle2, type } = pair;

                                    const hasTruthyPlayers = (team1 && team2 && team1 !== 'TBD') || team2 !== 'TBD';

                                    if (type === 'bo-3' && pair.games) {
                                        BO3_DEFAULT = [
                                            {
                                                gameId: 1,
                                                castle1: pair.games[0].castle1 ? pair.games[0].castle1 : null,
                                                castle2: pair.games[0].castle2 ? pair.games[0].castle2 : null,
                                                gameWinner: pair.games[0].gameWinner ? pair.games[0].gameWinner : null,
                                                castleWinner: pair.games[0].castleWinner
                                                    ? pair.games[0].castleWinner
                                                    : null
                                            },
                                            {
                                                gameId: 2,
                                                castle1: pair.games[1].castle1 ? pair.games[1].castle1 : null,
                                                castle2: pair.games[1].castle2 ? pair.games[1].castle2 : null,
                                                gameWinner: pair.games[1].gameWinner ? pair.games[1].gameWinner : null,
                                                castleWinner: pair.games[1].castleWinner
                                                    ? pair.games[1].castleWinner
                                                    : null
                                            }
                                        ];
                                    } else {
                                        BO3_DEFAULT = {
                                            gameId: 1,
                                            castle1: castle1,
                                            castle2: castle2,
                                            gameWinner: null
                                        };
                                    }
                                    return (
                                        <div
                                            key={pairIndex}
                                            className={classes['game-block']}
                                            style={{ position: 'relative' }}
                                        >
                                            {/* Live indicator - top right corner */}
                                            {pair.games && pair.games.some((g) => g.gameStatus === 'In Progress') && (
                                                <div
                                                    className={classes.liveIndicator}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '0.5rem',
                                                        right: '0.5rem',
                                                        margin: 0
                                                    }}
                                                />
                                            )}
                                            {/* Stats button - bottom right */}
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    bottom: '0.5rem',
                                                    right: '0.5rem',
                                                    zIndex: 2
                                                }}
                                            >
                                                {renderShowStatsButton(pair.team1, pair.team2, handleShowStats)}
                                            </div>
                                            {stage !== 'Third Place' && stage !== 'Final' && (
                                                <p>
                                                    {`Match ${pairIndex + 1}`} {`Best of ${stage === 'Final' ? 3 : 1}`}
                                                </p>
                                            )}
                                            {/* TODO: implement the game date */}
                                            {/* <div>Date:</div> */}

                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '0.5rem'
                                                    }}
                                                >
                                                    <PlayerBracket
                                                        pair={pair}
                                                        team={'team1'}
                                                        pairIndex={pairIndex}
                                                        hasTruthyPlayers={hasTruthyPlayers}
                                                        stageIndex={stageIndex}
                                                        setPlayoffPairs={setPlayoffPairs}
                                                        handleCastleChange={handleCastleChange}
                                                        handleScoreChange={handleScoreChange}
                                                        handleBlur={handleBlur}
                                                        handleRadioChange={handleRadioChange}
                                                        stage={stage}
                                                        teamIndex={1}
                                                        getWinner={getWinner}
                                                        clickedRadioButton={clickedRadioButton}
                                                    />
                                                    <PlayerBracket
                                                        pair={pair}
                                                        team={'team2'}
                                                        pairIndex={pairIndex}
                                                        hasTruthyPlayers={hasTruthyPlayers}
                                                        stageIndex={stageIndex}
                                                        setPlayoffPairs={setPlayoffPairs}
                                                        handleCastleChange={handleCastleChange}
                                                        handleScoreChange={handleScoreChange}
                                                        handleBlur={handleBlur}
                                                        handleRadioChange={handleRadioChange}
                                                        stage={stage}
                                                        teamIndex={2}
                                                        getWinner={getWinner}
                                                        isManualScore={isManualScore}
                                                        clickedRadioButton={clickedRadioButton}
                                                    />
                                                </div>
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: '0.5rem',
                                                        right: '0.5rem',
                                                        zIndex: 2
                                                    }}
                                                >
                                                    {renderShowStatsButton(pair.team1, pair.team2, handleShowStats)}
                                                </div>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        gap: '0.5rem',
                                                        alignItems: 'center',
                                                        marginTop: '2.5rem'
                                                    }}
                                                >
                                                    {pair.team1 !== 'TBD' &&
                                                    pair.team2 !== 'TBD' &&
                                                    canViewReportButtonForPair(pair) ? (
                                                        <button
                                                            onClick={() =>
                                                                handleOpenReportGame(pair, stageIndex, pairIndex)
                                                            }
                                                            disabled={
                                                                pair.gameStatus === 'Processed' && !authCtx.isAdmin
                                                            }
                                                            style={{
                                                                padding: '0.5rem 1rem',
                                                                background:
                                                                    pair.gameStatus === 'Processed'
                                                                        ? '#808080'
                                                                        : 'gold',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                color:
                                                                    pair.gameStatus === 'Processed'
                                                                        ? '#ffffff'
                                                                        : 'rgb(62, 32, 192)',
                                                                fontWeight: 'bold',
                                                                cursor:
                                                                    pair.gameStatus === 'Processed' && !authCtx.isAdmin
                                                                        ? 'not-allowed'
                                                                        : 'pointer',
                                                                opacity:
                                                                    pair.gameStatus === 'Processed' && !authCtx.isAdmin
                                                                        ? 0.75
                                                                        : 1,
                                                                fontSize: '0.9rem'
                                                            }}
                                                        >
                                                            {pair.gameStatus === 'Processed' && !authCtx.isAdmin
                                                                ? '🔒 Report Game'
                                                                : pair.gameStatus === 'Processed'
                                                                  ? 'Re-report Game'
                                                                  : 'Report Game'}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Stats Popup - Single instance for all games */}
            {showStats && stats && <StatsPopup stats={stats} onClose={handleCloseStats} />}

            {/* Report Game Modal */}
            {showReportGameModal && selectedStageIndex !== null && selectedPairIndex !== null && (
                <ReportGameModal
                    pair={playoffPairs[selectedStageIndex]?.[selectedPairIndex]}
                    onClose={() => setShowReportGameModal(false)}
                    onSubmit={handleSubmitGameReport}
                    playoffPairs={playoffPairs}
                />
            )}
        </div>
    );
};

const handleBlur = (stageName, pairIndex, setPlayoffPairs) => {
    const stageMappings = {
        'Quarter-final': 0,
        'Semi-final': 1,
        'Third Place': 2,
        Final: 3
        // Add more stages and their numerical values as needed
    };

    // Map the stage name to a numerical stage value
    const stage = stageMappings[stageName]; // Convert to lowercase for case-insensitive matching

    if (stage === undefined) {
        // Handle the case where an invalid stage name is provided
        console.error(`Invalid stage name: ${stageName}`);
        return;
    }

    setPlayoffPairs((prevPairs) => {
        const updatedPairs = [...prevPairs];
        const pair = updatedPairs[stage][pairIndex];

        console.log('pair', pair);

        if (
            (pair.score1 && pair.score2 && `${pair.score1}-${pair.score2}` === '2-0') ||
            `${pair.score1}-${pair.score2}` === '0-2' ||
            +pair.score1 + +pair.score2 === 3
        ) {
            // if (+pair.score1 + +pair.score2 === 3) {
            pair.totalGames = +pair.score1 + +pair.score2;
            // }
        } else {
            if (pair.score1 && pair.score2) {
                console.log('score', `${pair.score1}-${pair.score2}` === '0-2');
            }
        }

        console.log('updatedPairs', updatedPairs);
        return updatedPairs;
    });
};

function handleCastleChange(stageIndex, pairIndex, teamIndex, castleName, setPlayoffPairs, totalGames, index) {
    setPlayoffPairs((prevPairs) => {
        const updatedPairs = [...prevPairs];
        const pair = updatedPairs[stageIndex][pairIndex];

        if (totalGames.length > 1) {
            pair.games = pair.games ? pair.games : totalGames;

            if (teamIndex === 1) {
                pair.games[index].castle1 = castleName;
                // pair.castle1 = castleName;
            } else if (teamIndex === 2) {
                pair.games[index].castle2 = castleName;
                // pair.castle2 = castleName;
            }

            if (pair.games[index].castle2 && pair.games[index].castle1 && !pair.games[index].castleWinner) {
                pair.games[index].gameStatus = 'In Progress';
            }
        } else {
            if (teamIndex === 1) {
                // pair.castle1 = castleName;
                pair.games[index].castle1 = castleName;
            } else if (teamIndex === 2) {
                pair.games[index].castle2 = castleName;
                // pair.castle2 = castleName;
            }

            if (pair.games[index].castle2 && pair.games[index].castle1 && !pair.games[index].castleWinner) {
                pair.gameStatus = 'In Progress';
            }
        }

        return updatedPairs;
    });
}

function handleRadioChange(gameId, teamIndex, value, setPlayoffPairs, stageIndex, pairIndex, getWinner, checked, type) {
    setPlayoffPairs((prevPairs) => {
        const updatedPairs = [...prevPairs];
        const pair = updatedPairs[stageIndex][pairIndex];
        const game = pair.games[gameId];
        const radioButton1 = document.getElementById(`radio-${stageIndex}-${pairIndex}-${game.gameId}-${1}`);
        const radioButton2 = document.getElementById(`radio-${stageIndex}-${pairIndex}-${game.gameId}-${2}`);
        const radioButtonValue1 = radioButton1.checked;
        const radioButtonValue2 = radioButton2.checked;

        //TODO: check if game.gameWinner set correclty

        // Update the checked attribute for the clicked radio button only
        const radioButtons = document.querySelectorAll(`input[name="radio-${stageIndex}-${pairIndex}-${gameId}"]`);

        radioButtons.forEach((radioButton) => {
            if (radioButton.id === `radio-${stageIndex}-${pairIndex}-${gameId}-${teamIndex}`) {
                clickedRadioButton = radioButton ? radioButton.id : undefined;
            }
            if (radioButton.id === `radio-${stageIndex}-${pairIndex}-${gameId}-${teamIndex}`) {
                radioButton.checked = true;
            } else {
                radioButton.checked = false;
            }
        });

        if (game.gameStatus !== 'Processed') {
            if (teamIndex === 1 && value === 'on' && game.castle1) {
                game.castleWinner = game.castle1;
                game.gameWinner = pair.team1;
                pair.score1 = pair.score1 + 1;

                if (
                    pair.score2 > 0 &&
                    (radioButtonValue1 || radioButtonValue2) &&
                    (pair.games.length === 1 || !game.gameWinner)
                ) {
                    pair.score2 = pair.score2 - 1;
                }
                game.gameStatus = 'Finished';
            } else {
                if (teamIndex === 2 && value === 'on' && game.castle2) {
                    game.castleWinner = game.castle2;
                    game.gameWinner = pair.team2;
                    pair.score2 = pair.score2 + 1;

                    if (
                        pair.score1 > 0 &&
                        (radioButtonValue1 || radioButtonValue2) &&
                        (pair.games.length === 1 || !game.gameWinner)
                    ) {
                        pair.score1 = pair.score1 - 1;
                    }
                    game.gameStatus = 'Finished';
                }
            }
            // console.log('game.gameWinner', game.gameWinner);
            if (
                (pair.score1 + pair.score2 >= 2 && `${pair.score1}-${pair.score2}` !== '1-1') ||
                pair.games.length === 1
            ) {
                getWinner(pair);
            }
        }

        // console.log('updatedPairs', updatedPairs);
        return updatedPairs;
    });
}

export const renderPlayerList = (players) => {
    const playerNames = Object.values(players)
        .filter((player) => player !== null && player.name !== undefined && player.name.trim() !== '')
        .map((player) => player.name);

    playerNames.forEach((name) => {
        if (!uniquePlayerNames.includes(name) && name) {
            uniquePlayerNames.push(name);
        }
    });

    return (
        <>
            <h4>Players:</h4>
            <ul>
                {playerNames.map(function (name, index) {
                    return <li key={index}>{formatPlayerName({ name })}</li>;
                })}
            </ul>
        </>
    );
};
