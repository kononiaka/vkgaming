import React, { useState, useEffect } from 'react';
import classes from './ReportGameModal.module.css';
import { getAvatar, lookForUserId, fetchCastlesList, getPairProgress, savePairProgress } from '../../../api/api';
import { calculateAvailableCastlesFromBracket } from '../../../utils/tournamentBracketNavigation';
import { getGamesPerMatch, normalizeGameType } from './swissUtils';

const getMatchFormatLabel = (type) => {
    const normalized = normalizeGameType(type);
    if (normalized === 'bo-5') {
        return 'BO5';
    }
    if (normalized === 'bo-3') {
        return 'BO3';
    }
    if (normalized === 'bo-2') {
        return 'BO2';
    }
    return 'BO1';
};

const isSeriesGameHidden = (game, idx, score1, score2, requiredWins) =>
    (!game.castle1 && !game.castle2 && !game.winner && Math.max(score1, score2) >= requiredWins) ||
    idx >= Math.min(score1, score2) + requiredWins;
// Import local castle images
import castleImg from '../../../image/castles/castle.jpeg';
import rampartImg from '../../../image/castles/rampart.jpeg';
import towerImg from '../../../image/castles/tower.jpeg';
import infernoImg from '../../../image/castles/inferno.jpeg';
import necropolisImg from '../../../image/castles/necropolis.jpeg';
import dungeonImg from '../../../image/castles/dungeon.jpeg';
import strongholdImg from '../../../image/castles/stronghold.jpeg';
import fortressImg from '../../../image/castles/fortress.jpeg';
import confluxImg from '../../../image/castles/conflux.jpeg';
import coveImg from '../../../image/castles/cove.jpeg';
import factoryImg from '../../../image/castles/factory.jpeg';
import kronverkImg from '../../../image/castles/kronverk.jpeg';
import redFlagImg from '../../../image/flags/red.jpg';
import blueFlagImg from '../../../image/flags/blue.jpg';
import goldImg from '../../../image/gold-removebg.png';

const ReportGameModal = ({
    pair,
    pairId,
    tournamentId,
    onClose,
    onSubmit,
    playoffPairs,
    initialGameId,
    strictCastlePick = false
}) => {
    // Use backend progress instead of localStorage
    const [initial, setInitial] = useState({});
    const [progressLoaded, setProgressLoaded] = useState(false);

    // On mount, fetch progress from backend
    useEffect(() => {
        let mounted = true;
        async function fetchProgress() {
            if (!pairId || !tournamentId) {
                setProgressLoaded(true);
                return;
            }
            const progress = await getPairProgress(tournamentId, pairId);
            if (mounted) {
                setInitial(progress || {});
                setProgressLoaded(true);
            }
        }
        fetchProgress();
        return () => {
            mounted = false;
        };
    }, [pairId, tournamentId]);

    // Scroll to the target game section once content is ready
    useEffect(() => {
        if (initialGameId == null || !progressLoaded) {
            return;
        }
        const timer = setTimeout(() => {
            const el = document.getElementById(`report-game-section-${initialGameId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [initialGameId, progressLoaded]);

    // All state is initialized only after progress is loaded
    const [selectedWinner, setSelectedWinner] = useState('');
    const [castle1, setCastle1] = useState('');
    const [castle2, setCastle2] = useState('');
    const [bannedCastlesBO1_1, setBannedCastlesBO1_1] = useState([]);
    const [bannedCastlesBO1_2, setBannedCastlesBO1_2] = useState([]);
    const [score1, setScore1] = useState(0);
    const [score2, setScore2] = useState(0);
    const [gameResults, setGameResults] = useState([]);
    const [color1, setColor1] = useState('red');
    const [color2, setColor2] = useState('blue');
    const [gold1, setGold1] = useState(0);
    const [gold2, setGold2] = useState(0);
    const [restart1_111, setRestart1_111] = useState(0);
    const [restart1_112, setRestart1_112] = useState(0);
    const [restart2_111, setRestart2_111] = useState(0);
    const [restart2_112, setRestart2_112] = useState(0);
    const [restartsFinished, setRestartsFinished] = useState(false);
    const [avatar1, setAvatar1] = useState(null);
    const [avatar2, setAvatar2] = useState(null);
    const [availableCastles, setAvailableCastles] = useState([]);
    const [castleMarkOverrides, setCastleMarkOverrides] = useState({});
    const [mockMode, setMockMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // When progress is loaded, restore only fields the pair useEffect doesn't already cover
    useEffect(() => {
        if (!progressLoaded) {
            return;
        }
        // latestStage, bannedCastles and castleMarkOverrides are NOT in pair data — restore from progress
        if (initial.bannedCastlesBO1_1) {
            setBannedCastlesBO1_1(initial.bannedCastlesBO1_1);
        }
        if (initial.bannedCastlesBO1_2) {
            setBannedCastlesBO1_2(initial.bannedCastlesBO1_2);
        }
        if (initial.castleMarkOverrides) {
            setCastleMarkOverrides(initial.castleMarkOverrides);
        }
        // Restore form fields only if saved progress has them (don't overwrite pair useEffect values with empty)
        if (initial.winner !== undefined) {
            setSelectedWinner(initial.winner);
        }
        if (initial.score1 !== undefined) {
            setScore1(initial.score1);
        }
        if (initial.score2 !== undefined) {
            setScore2(initial.score2);
        }
        if (initial.color1) {
            setColor1(initial.color1);
        }
        if (initial.color2) {
            setColor2(initial.color2);
        }
        // For BO-1: castle and game fields are nested in initial.games[0]
        const g0 = initial.games?.[0];
        if (g0) {
            if (g0.castle1) {
                setCastle1(g0.castle1);
            }
            if (g0.castle2) {
                setCastle2(g0.castle2);
            }
            if (g0.gold1 !== undefined) {
                setGold1(g0.gold1);
            }
            if (g0.gold2 !== undefined) {
                setGold2(g0.gold2);
            }
            if (g0.restart1_111 !== undefined) {
                setRestart1_111(g0.restart1_111);
            }
            if (g0.restart1_112 !== undefined) {
                setRestart1_112(g0.restart1_112);
            }
            if (g0.restart2_111 !== undefined) {
                setRestart2_111(g0.restart2_111);
            }
            if (g0.restart2_112 !== undefined) {
                setRestart2_112(g0.restart2_112);
            }
            if (g0.restartsFinished !== undefined) {
                setRestartsFinished(g0.restartsFinished);
            }
        }
        // For series: restore gameResults from saved progress (never for BO-1)
        const savedBestOf = getGamesPerMatch(normalizeGameType(pair.type));
        if (savedBestOf > 1 && initial.games && initial.games.length > 0) {
            setGameResults(
                initial.games.slice(0, savedBestOf).map((g, idx) => ({
                    gameId: idx,
                    castle1: g.castle1 || '',
                    castle2: g.castle2 || '',
                    winner: g.gameWinner || '',
                    gameStatus: g.gameStatus || 'Not Started',
                    color1: g.color1 || 'red',
                    color2: g.color2 || 'blue',
                    gold1: g.gold1 || 0,
                    gold2: g.gold2 || 0,
                    restart1_111: g.restart1_111 || 0,
                    restart1_112: g.restart1_112 || 0,
                    restart2_111: g.restart2_111 || 0,
                    restart2_112: g.restart2_112 || 0,
                    restartsFinished: g.restartsFinished || false
                }))
            );
        }
    }, [progressLoaded, pair.type]);

    const bestOf = getGamesPerMatch(normalizeGameType(pair.type));
    const requiredWins = Math.floor(bestOf / 2) + 1;
    const isSeriesMatch = bestOf > 1;

    // Available castles - using database format with Russian names
    const castles = [
        'Castle-Замок',
        'Rampart-Оплот',
        'Tower-Башня',
        'Inferno-Инферно',
        'Necropolis-Некрополис',
        'Dungeon-Подземелье',
        'Stronghold-Цитадель',
        'Fortress-Болото',
        'Conflux-Сопряжение',
        'Cove-Пиратская бухта',
        'Factory-Фабрика',
        'Kronverk-Кронверк'
    ];

    // Map castle names to imported images
    const getCastleImageUrl = (castleName) => {
        // Extract English name from "Castle-Замок" format
        const englishName = castleName.split('-')[0];
        const castleImages = {
            Castle: castleImg,
            Rampart: rampartImg,
            Tower: towerImg,
            Inferno: infernoImg,
            Necropolis: necropolisImg,
            Dungeon: dungeonImg,
            Stronghold: strongholdImg,
            Fortress: fortressImg,
            Conflux: confluxImg,
            Cove: coveImg,
            Factory: factoryImg,
            Kronverk: kronverkImg
        };
        return castleImages[englishName] || '';
    };

    // Calculate available castles statistics - using exact same logic as Get Available Castles modal
    const calculateAvailableCastles = (apiCastles, pairsData) =>
        calculateAvailableCastlesFromBracket(apiCastles, pairsData);

    // Get border color for a castle based on availability
    const getCastleBorderColor = (castleName) => {
        if (mockMode) {
            const manualMark = castleMarkOverrides[castleName];
            if (manualMark === 'selected') {
                return '#4ade80';
            }
            if (manualMark === 'deactivated') {
                return '#f87171';
            }
            return '#CCCCCC';
        }

        const manualMark = castleMarkOverrides[castleName];
        if (manualMark === 'selected') {
            return '#4ade80';
        }
        if (manualMark === 'deactivated') {
            return '#f87171';
        }

        if (!strictCastlePick) {
            return '#CCCCCC';
        }

        // If in 11/12 state (castleMarkOverrides has keys with null values), color by min/max
        if (Object.keys(castleMarkOverrides).some((key) => castleMarkOverrides[key] === null)) {
            if (availableCastles && availableCastles.length > 0) {
                const castle = availableCastles.find((c) => c.name === castleName);
                if (castle) {
                    const totals = availableCastles.map((c) => c.total + (c.liveGames || 0));
                    const minTotal = Math.min(...totals);
                    const maxTotal = Math.max(...totals);
                    const castleTotal = castle.total + (castle.liveGames || 0);
                    if (castleTotal === minTotal) {
                        return '#4ade80';
                    } // Green for least played
                    if (castleTotal === maxTotal) {
                        return '#FFD700';
                    } // Yellow for most played
                }
            }
            return '#CCCCCC'; // Gray fallback
        }

        if (!availableCastles || availableCastles.length === 0) {
            return '#CCCCCC'; // Default gray if no data
        }

        const castle = availableCastles.find((c) => c.name === castleName);
        if (!castle) {
            console.warn(
                `Castle not found: ${castleName}. Available castles:`,
                availableCastles.map((c) => c.name)
            );
            return '#CCCCCC'; // Default gray if castle not found
        }

        const totals = availableCastles.map((c) => c.total + (c.liveGames || 0));
        const minTotal = Math.min(...totals);
        const maxTotal = Math.max(...totals);

        const castleTotal = castle.total + (castle.liveGames || 0);
        const color =
            castleTotal === minTotal
                ? '#4ade80' // Green (less games played)
                : castleTotal === maxTotal
                  ? '#f87171' // Red (more games played)
                  : '#FFD700'; // Yellow (equal)

        return color;
    };

    // Initialize game results for bo-3
    React.useEffect(() => {
        // Fetch avatars for both players
        const fetchAvatars = async () => {
            try {
                if (pair.team1 && pair.team1 !== 'TBD') {
                    const uid1 = await lookForUserId(pair.team1);
                    if (uid1) {
                        const avatar = await getAvatar(uid1);
                        setAvatar1(avatar);
                    } else {
                        console.log('No UID found for team1:', pair.team1);
                    }
                }
                if (pair.team2 && pair.team2 !== 'TBD') {
                    const uid2 = await lookForUserId(pair.team2);
                    if (uid2) {
                        const avatar = await getAvatar(uid2);
                        setAvatar2(avatar);
                    } else {
                        console.log('No UID found for team2:', pair.team2);
                    }
                }
            } catch (error) {
                console.error('Error fetching avatars:', error);
            }
        };

        fetchAvatars();

        // Initialize winner and scores from pair
        setSelectedWinner(pair.winner || '');
        setScore1(pair.score1 || 0);
        setScore2(pair.score2 || 0);
        setRestartsFinished(false);

        // Initialize colors from pair data if available
        if (pair.color1) {
            setColor1(pair.color1);
        }
        if (pair.color2) {
            setColor2(pair.color2);
        }

        if (isSeriesMatch) {
            setGameResults(
                pair.games.slice(0, bestOf).map((game, idx) => ({
                    gameId: idx,
                    castle1: game.castle1 || '',
                    castle2: game.castle2 || '',
                    bannedCastles1: [],
                    bannedCastles2: [],
                    winner: game.gameWinner || '',
                    gameStatus: game.gameStatus || 'Not Started',
                    color1: game.color1 || 'red',
                    color2: game.color2 || 'blue',
                    gold1: game.gold1 || 0,
                    gold2: game.gold2 || 0,
                    restart1_111: game.restart1_111 || 0,
                    restart1_112: game.restart1_112 || 0,
                    restart2_111: game.restart2_111 || 0,
                    restart2_112: game.restart2_112 || 0,
                    restartsFinished: game.restartsFinished || false
                }))
            );
        } else {
            // Initialize bo-1 with existing castle data if available
            if (pair.games && pair.games[0]) {
                setRestartsFinished(Boolean(pair.games[0].restartsFinished));
                setCastle1(pair.games[0].castle1 || '');
                setCastle2(pair.games[0].castle2 || '');
                if (pair.games[0].color1) {
                    setColor1(pair.games[0].color1);
                }
                if (pair.games[0].color2) {
                    setColor2(pair.games[0].color2);
                }
                if (pair.games[0].gold1) {
                    setGold1(pair.games[0].gold1);
                }
                if (pair.games[0].gold2) {
                    setGold2(pair.games[0].gold2);
                }
                if (pair.games[0].restart1_111) {
                    setRestart1_111(pair.games[0].restart1_111);
                }
                if (pair.games[0].restart1_112) {
                    setRestart1_112(pair.games[0].restart1_112);
                }
                if (pair.games[0].restart2_111) {
                    setRestart2_111(pair.games[0].restart2_111);
                }
                if (pair.games[0].restart2_112) {
                    setRestart2_112(pair.games[0].restart2_112);
                }
            }
        }
    }, [pair]);

    // Calculate available castles when playoffPairs changes
    React.useEffect(() => {
        if (!strictCastlePick || !playoffPairs) {
            setAvailableCastles([]);
            return;
        }

        const fetchAndCalculate = async () => {
            try {
                const apiCastles = await fetchCastlesList();
                const stats = calculateAvailableCastles(apiCastles, playoffPairs);
                setAvailableCastles(stats);

                // For series matches: check if any game hasn't started
                let shouldAutoMark = false;
                if (isSeriesMatch && pair.games) {
                    const hasUnstartedGame = pair.games.some(
                        (g) => !g.castle1 || !g.castle2 || g.gameStatus === 'Not Started'
                    );
                    shouldAutoMark = hasUnstartedGame;
                    console.log('Series match has unstarted game?', shouldAutoMark);
                }

                if (shouldAutoMark) {
                    // Check each game and apply 11/12 logic to unstarted ones
                    if (pair.games && pair.games.length > 0) {
                        pair.games.forEach((game, idx) => {
                            // Only apply 11/12 logic to games that are "Not Started!" AND have no castles selected
                            // Skip "Processed" or any other finished games
                            const isGameNotStarted = game.gameStatus && game.gameStatus.trim() === 'Not Started!';
                            const noCastlesSelected = !game.castle1 || !game.castle2;
                            const isGameProcessed = game.gameStatus && game.gameStatus.trim() === 'Processed';

                            console.log(
                                `Game ${idx}: gameStatus='${game.gameStatus}', castle1=${game.castle1}, castle2=${game.castle2}, notStarted=${isGameNotStarted}, noCastlesSelected=${noCastlesSelected}, processed=${isGameProcessed}`
                            );

                            if (isGameNotStarted && noCastlesSelected && !isGameProcessed) {
                                // On fresh game load, assume no manual marks and proceed with 11/12 detection
                                const gameCounts = {};
                                castles.forEach((castle) => {
                                    const castleData = stats.find((c) => c.name === castle);
                                    const total = castleData?.total || 0;
                                    const liveGames = castleData?.liveGames || 0;
                                    gameCounts[castle] = total + liveGames;
                                });

                                const minCount = Math.min(...Object.values(gameCounts));
                                const maxCount = Math.max(...Object.values(gameCounts));
                                const castlesWithMaxCount = Object.keys(gameCounts).filter(
                                    (castle) => gameCounts[castle] === maxCount
                                );

                                console.log(
                                    `Game ${idx} 11/12 check: castlesWithMaxCount.length=${castlesWithMaxCount.length}, minCount=${minCount}, maxCount=${maxCount}, gameCounts=`,
                                    gameCounts
                                );

                                // Check for 11/12 degenerate state: 11 castles with same count, 1 with different count
                                // This can be either 11 with max and 1 with min, or 11 with min and 1 with max
                                const castlesWithMinCount = Object.keys(gameCounts).filter(
                                    (castle) => gameCounts[castle] === minCount
                                );

                                const is11MaxAnd1Min =
                                    castlesWithMaxCount.length === 11 &&
                                    castlesWithMinCount.length === 1 &&
                                    maxCount > minCount;
                                const is11MinAnd1Max =
                                    castlesWithMinCount.length === 11 &&
                                    castlesWithMaxCount.length === 1 &&
                                    maxCount > minCount;

                                // If 11 castles have max count or 11 castles have min count, clear all marks (11/12 state detected)
                                if (is11MaxAnd1Min || is11MinAnd1Max) {
                                    console.log(
                                        `11/12 state detected in Game ${idx + 1}! Clearing marks. Max count: ${maxCount}, Min count: ${minCount}, is11Max=${is11MaxAnd1Min}, is11Min=${is11MinAnd1Max}`
                                    );
                                    const clearMarks = {};
                                    castles.forEach((castle) => {
                                        clearMarks[castle] = null;
                                    });
                                    setCastleMarkOverrides(clearMarks);
                                }
                            } else {
                                console.log(`⊘ Game ${idx} (status: ${game.gameStatus}) - skipping 11/12 check`);
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('Error fetching castles:', error);
            }
        };
        fetchAndCalculate();
    }, [playoffPairs, pair, strictCastlePick]);

    // Reset castle marks when pair changes (new game opened)
    React.useEffect(() => {
        setCastleMarkOverrides({});
    }, [pair.id]);

    const handleGameResultChange = (gameIdx, field, value) => {
        const updated = [...gameResults];
        updated[gameIdx] = { ...updated[gameIdx], [field]: value };

        // Auto-calculate scores based on winners
        const team1Wins = updated.filter((g) => g.winner === pair.team1).length;
        const team2Wins = updated.filter((g) => g.winner === pair.team2).length;
        setScore1(team1Wins);
        setScore2(team2Wins);

        // Auto-add next game when all current games are decided but neither player has won enough yet.
        const shouldAddDeciderGame =
            isSeriesMatch &&
            updated.length < bestOf &&
            team1Wins + team2Wins === updated.length &&
            Math.max(team1Wins, team2Wins) < requiredWins;

        if (shouldAddDeciderGame) {
            updated.push({
                gameId: updated.length,
                castle1: '',
                castle2: '',
                bannedCastles1: [],
                bannedCastles2: [],
                winner: '',
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

        setGameResults(updated);

        // Auto-select winner if required wins are reached; detect draw for bo-2 (1-1).
        if (bestOf === 2 && team1Wins === 1 && team2Wins === 1) {
            setSelectedWinner('draw');
        } else if (team1Wins >= requiredWins) {
            setSelectedWinner(pair.team1);
        } else if (team2Wins >= requiredWins) {
            setSelectedWinner(pair.team2);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) {
            return;
        }

        // const hasUsedRestarts = isSeriesMatch
        //     ? gameResults.some(
        //           (game) =>
        //               (Number(game.restart1_111) || 0) > 0 ||
        //               (Number(game.restart1_112) || 0) > 0 ||
        //               (Number(game.restart2_111) || 0) > 0 ||
        //               (Number(game.restart2_112) || 0) > 0
        //       )
        //     : restart1_111 > 0 || restart1_112 > 0 || restart2_111 > 0 || restart2_112 > 0;

        // if (hasUsedRestarts && !restartsFinished) {
        //     alert('Please confirm that restarts are finished and the main game has started.');
        //     return;
        // }

        // Validate based on what's being reported
        if (isSeriesMatch) {
            const hasAnyCompleteGame = gameResults.some((game) => game.castle1 && game.castle2);
            if (!hasAnyCompleteGame) {
                alert(
                    `${pair.type.toUpperCase()}: At least one game must have both castles selected before submitting.`
                );
                return;
            }

            // For series matches, validate each game that has any data filled in.
            for (let i = 0; i < gameResults.length; i++) {
                const game = gameResults[i];
                // If game has a winner, it must have castles
                if (game.winner && (!game.castle1 || !game.castle2)) {
                    alert(`Game ${i + 1}: Please select castles for both players before selecting a winner`);
                    return;
                }
                // If game has castles selected, it should be complete (have both castles)
                if ((game.castle1 || game.castle2) && (!game.castle1 || !game.castle2)) {
                    alert(`Game ${i + 1}: Please select castles for both players`);
                    return;
                }
            }

            // If overall winner is selected, validate the series is properly concluded
            if (selectedWinner && selectedWinner !== 'draw') {
                const hasValidSeriesWinner =
                    (score1 === requiredWins && score2 < requiredWins) ||
                    (score2 === requiredWins && score1 < requiredWins);
                if (!hasValidSeriesWinner) {
                    alert(
                        `Invalid score for ${pair.type.toUpperCase()}. One player must have exactly ${requiredWins} wins to determine a match winner.`
                    );
                    return;
                }
            }
            if (selectedWinner === 'draw' && !(score1 === 1 && score2 === 1 && bestOf === 2)) {
                alert('Draw is only valid for BO-2 with a 1-1 score.');
                return;
            }
        } else {
            // Validate bo-1
            if (selectedWinner) {
                if (!castle1 || !castle2) {
                    alert('Please select castles for both players');
                    return;
                }
                if (score1 + score2 !== 1) {
                    alert('Score must be 1-0 or 0-1 for BO-1');
                    return;
                }
            }
        }

        const reportData = {
            winner: selectedWinner || null,
            score1: score1,
            score2: score2,
            color1: color1,
            color2: color2,
            mockMode,
            games: isSeriesMatch
                ? gameResults.map((g) => ({
                      castle1: g.castle1 || '',
                      castle2: g.castle2 || '',
                      castleWinner: g.winner ? (g.winner === pair.team1 ? g.castle1 : g.castle2) : '',
                      gameWinner: g.winner || '',
                      gameStatus: g.gameStatus === 'Processed' ? 'Processed' : g.winner ? 'Finished' : 'In Progress',
                      gameId: g.gameId,
                      color1: g.color1 || color1,
                      color2: g.color2 || color2,
                      gold1: g.gold1 || 0,
                      gold2: g.gold2 || 0,
                      restart1_111: g.restart1_111 || 0,
                      restart1_112: g.restart1_112 || 0,
                      restart2_111: g.restart2_111 || 0,
                      restart2_112: g.restart2_112 || 0,
                      restartsFinished: g.restartsFinished || false
                  }))
                : [
                      {
                          castle1: castle1 || '',
                          castle2: castle2 || '',
                          castleWinner: selectedWinner ? (selectedWinner === pair.team1 ? castle1 : castle2) : '',
                          gameWinner: selectedWinner || '',
                          gameStatus: selectedWinner ? 'Finished' : 'In Progress',
                          gameId: 0,
                          color1: color1,
                          color2: color2,
                          gold1: gold1,
                          gold2: gold2,
                          restart1_111: restart1_111,
                          restart1_112: restart1_112,
                          restart2_111: restart2_111,
                          restart2_112: restart2_112,
                          restartsFinished: restartsFinished
                      }
                  ]
        };

        setIsSubmitting(true);
        try {
            // Persist final progress to backend before handing off (skipped in mock mode)
            if (!mockMode) {
                await savePairProgress(tournamentId, pairId, {
                    ...reportData,
                    latestStage: 'submitted',
                    bannedCastlesBO1_1,
                    bannedCastlesBO1_2,
                    castleMarkOverrides
                });
            }
            await onSubmit(reportData);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getRestartBoxClass = (isUsed, isDisabled) => {
        if (isDisabled) {
            return `${classes.restartBox} ${classes.restartBoxDisabled}`;
        }
        if (isUsed) {
            return `${classes.restartBox} ${classes.restartBoxUsed}`;
        }
        return `${classes.restartBox} ${classes.restartBoxIdle}`;
    };

    const RestartBox = ({ code, isUsed, isDisabled, showMark, onClick, blockPointer }) => (
        <div
            className={getRestartBoxClass(isUsed, isDisabled)}
            onClick={onClick}
            style={blockPointer ? { pointerEvents: 'none' } : undefined}
        >
            <span className={classes.restartCode}>{code}</span>
            {showMark && <span className={classes.restartMark}>✕</span>}
        </div>
    );

    const CastleTile = ({ castleName, isSelected, isBanned, isDisabled, hasSelection, onToggle }) => {
        const borderColor = getCastleBorderColor(castleName);
        const isRestricted = !hasSelection && borderColor === '#f87171';
        const imageClass = [
            classes.castleImg,
            isSelected && classes.castleImgSelected,
            hasSelection && !isSelected && classes.castleImgDimmed,
            isRestricted && classes.castleImgRestricted
        ]
            .filter(Boolean)
            .join(' ');

        return (
            <div
                className={`${classes.castleTile} ${isDisabled ? classes.castleTileDisabled : ''}`}
                onClick={() => {
                    if (!isDisabled) {
                        onToggle();
                    }
                }}
            >
                <img
                    src={getCastleImageUrl(castleName)}
                    alt={castleName}
                    title={castleName}
                    className={imageClass}
                    style={{
                        borderColor,
                        boxShadow: `0 0 6px ${borderColor}55`
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isDisabled) {
                            onToggle();
                        }
                    }}
                />
                {(isSelected || isBanned) && (
                    <span
                        className={`${classes.castleBadge} ${
                            isSelected ? classes.castleBadgePick : classes.castleBadgeBan
                        }`}
                    >
                        {isSelected ? '✓' : '✕'}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div
            className={classes.backdrop}
            onClick={() => {
                if (isSubmitting) {
                    return;
                }
                onClose();
            }}
        >
            <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
                <button
                    className={classes.closeButton}
                    disabled={isSubmitting}
                    onClick={() => {
                        onClose();
                    }}
                >
                    ×
                </button>

                {mockMode && (
                    <div className={classes.mockModeBanner}>
                        Test mode — saves bracket and promotions only. Global castle totals, availability counts, ELO,
                        and player stats are not updated.
                    </div>
                )}

                {/* Player Header Bar at Top - STICKY (only for series matches) */}
                {isSeriesMatch && (
                    <div className={classes.matchHeader}>
                        <div className={classes.matchHeaderPlayer}>
                            <div className={classes.avatar}>
                                {avatar1 ? (
                                    <img src={avatar1} alt={pair.team1} className={classes.avatarImg} />
                                ) : (
                                    pair.team1.charAt(0).toUpperCase()
                                )}
                            </div>
                            <span className={classes.playerName}>{pair.team1}</span>
                        </div>

                        <div className={classes.matchHeaderCenter}>
                            <div className={classes.matchType}>{getMatchFormatLabel(pair.type)}</div>
                            <div className={classes.matchScoreRow}>
                                <div className={classes.matchScore}>{score1}</div>
                                <div className={classes.matchScoreDash}>-</div>
                                <div className={classes.matchScore}>{score2}</div>
                            </div>
                        </div>

                        <div className={`${classes.matchHeaderPlayer} ${classes.matchHeaderPlayerEnd}`}>
                            <span className={classes.playerName}>{pair.team2}</span>
                            <div className={classes.avatar}>
                                {avatar2 ? (
                                    <img src={avatar2} alt={pair.team2} className={classes.avatarImg} />
                                ) : (
                                    pair.team2.charAt(0).toUpperCase()
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className={classes.form} style={{ position: 'relative' }}>
                    {/* Game Results */}
                    {isSeriesMatch ? (
                        <div style={{ position: 'relative', zIndex: 2 }}>
                            {/* Series match game results */}
                            {gameResults.map((game, idx) => {
                                if (isSeriesGameHidden(game, idx, score1, score2, requiredWins)) {
                                    return null;
                                }

                                return (
                                    <div key={idx} className={classes.gameBlock}>
                                        <div
                                            id={`report-game-section-${idx}`}
                                            className={classes.gameSection}
                                            style={{
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {/* Left Side Background - Player 1 for this game */}
                                            <div
                                                className={classes.gameBgLeft}
                                                style={{
                                                    backgroundImage: game.castle1
                                                        ? `linear-gradient(to right, rgba(139, 0, 0, ${game.color1 === 'red' ? '0.12' : '0'}), rgba(139, 0, 0, ${game.color1 === 'red' ? '0.03' : '0'})), linear-gradient(to right, rgba(0, 0, 139, ${game.color1 === 'blue' ? '0.12' : '0'}), rgba(0, 0, 139, ${game.color1 === 'blue' ? '0.03' : '0'})), url(${getCastleImageUrl(game.castle1)})`
                                                        : game.color1 === 'red'
                                                          ? 'linear-gradient(to right, rgba(139, 0, 0, 0.12), rgba(139, 0, 0, 0.03))'
                                                          : 'linear-gradient(to right, rgba(0, 0, 139, 0.12), rgba(0, 0, 139, 0.03))',
                                                    backgroundSize: game.castle1 ? 'auto, auto, cover' : 'auto',
                                                    backgroundPosition: game.castle1 ? 'left, left, left' : 'left'
                                                }}
                                            />
                                            {/* Right Side Background - Player 2 for this game */}
                                            <div
                                                className={classes.gameBgRight}
                                                style={{
                                                    backgroundImage: game.castle2
                                                        ? `linear-gradient(to left, rgba(139, 0, 0, ${game.color2 === 'red' ? '0.12' : '0'}), rgba(139, 0, 0, ${game.color2 === 'red' ? '0.03' : '0'})), linear-gradient(to left, rgba(0, 0, 139, ${game.color2 === 'blue' ? '0.12' : '0'}), rgba(0, 0, 139, ${game.color2 === 'blue' ? '0.03' : '0'})), url(${getCastleImageUrl(game.castle2)})`
                                                        : game.color2 === 'red'
                                                          ? 'linear-gradient(to left, rgba(139, 0, 0, 0.12), rgba(139, 0, 0, 0.03))'
                                                          : 'linear-gradient(to left, rgba(0, 0, 139, 0.12), rgba(0, 0, 139, 0.03))',
                                                    backgroundSize: game.castle2 ? 'auto, auto, cover' : 'auto',
                                                    backgroundPosition: game.castle2 ? 'right, right, right' : 'right'
                                                }}
                                            />
                                            {/* Center Divider for this game */}
                                            <div className={classes.gameDivider} />
                                            <h3 className={`${classes.gameTitle} ${classes.layered}`}>
                                                Game {idx + 1}
                                            </h3>

                                            {/* Compact Score/Winner Section with Color Toggle */}
                                            <div className={`${classes.formGroup} ${classes.layered}`}>
                                                <div
                                                    className={`${classes.scoreBar} ${
                                                        game.color1 === 'red'
                                                            ? classes.scoreBarRedLead
                                                            : classes.scoreBarBlueLead
                                                    }`}
                                                >
                                                    <div className={classes.playerRow}>
                                                        <div
                                                            className={classes.flagToggle}
                                                            onClick={() => {
                                                                const updated = [...gameResults];
                                                                const newColor = game.color1 === 'red' ? 'blue' : 'red';
                                                                const oppositeColor =
                                                                    newColor === 'red' ? 'blue' : 'red';
                                                                updated[idx] = {
                                                                    ...updated[idx],
                                                                    color1: newColor,
                                                                    color2: oppositeColor
                                                                };
                                                                setGameResults(updated);
                                                            }}
                                                        >
                                                            <img
                                                                src={game.color1 === 'red' ? redFlagImg : blueFlagImg}
                                                                alt={game.color1 === 'red' ? 'Red flag' : 'Blue flag'}
                                                                className={`${classes.flagImg} ${
                                                                    game.color1 === 'red'
                                                                        ? classes.flagImgRed
                                                                        : classes.flagImgBlue
                                                                }`}
                                                            />
                                                        </div>
                                                        <div
                                                            onClick={() => {
                                                                if (game.gameStatus?.trim() !== 'Processed') {
                                                                    handleGameResultChange(
                                                                        idx,
                                                                        'winner',
                                                                        game.winner === pair.team1 ? '' : pair.team1
                                                                    );
                                                                }
                                                            }}
                                                            className={`${classes.winnerPick} ${
                                                                game.winner === pair.team1
                                                                    ? classes.winnerPickSelected
                                                                    : ''
                                                            } ${
                                                                game.gameStatus?.trim() === 'Processed'
                                                                    ? classes.winnerPickDisabled
                                                                    : ''
                                                            }`}
                                                        >
                                                            {pair.team1}
                                                        </div>
                                                    </div>

                                                    <div className={classes.scoreRow}>
                                                        <div className={classes.scoreValue}>{score1}</div>
                                                        <div className={classes.scoreDivider}>⚔️</div>
                                                        <div className={classes.scoreValue}>{score2}</div>
                                                    </div>

                                                    <div className={`${classes.playerRow} ${classes.playerRowEnd}`}>
                                                        <div
                                                            onClick={() => {
                                                                if (game.gameStatus?.trim() !== 'Processed') {
                                                                    handleGameResultChange(
                                                                        idx,
                                                                        'winner',
                                                                        game.winner === pair.team2 ? '' : pair.team2
                                                                    );
                                                                }
                                                            }}
                                                            className={`${classes.winnerPick} ${
                                                                game.winner === pair.team2
                                                                    ? classes.winnerPickSelected
                                                                    : ''
                                                            } ${
                                                                game.gameStatus?.trim() === 'Processed'
                                                                    ? classes.winnerPickDisabled
                                                                    : ''
                                                            }`}
                                                        >
                                                            {pair.team2}
                                                        </div>
                                                        <div
                                                            className={classes.flagToggle}
                                                            onClick={() => {
                                                                const updated = [...gameResults];
                                                                const newColor = game.color2 === 'red' ? 'blue' : 'red';
                                                                const oppositeColor =
                                                                    newColor === 'red' ? 'blue' : 'red';
                                                                updated[idx] = {
                                                                    ...updated[idx],
                                                                    color2: newColor,
                                                                    color1: oppositeColor
                                                                };
                                                                setGameResults(updated);
                                                            }}
                                                        >
                                                            <img
                                                                src={game.color2 === 'red' ? redFlagImg : blueFlagImg}
                                                                alt={game.color2 === 'red' ? 'Red flag' : 'Blue flag'}
                                                                className={`${classes.flagImg} ${
                                                                    game.color2 === 'red'
                                                                        ? classes.flagImgRed
                                                                        : classes.flagImgBlue
                                                                }`}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Gold Input for BO-3 */}
                                            <div className={`${classes.formGroup} ${classes.layered}`}>
                                                <label className={classes.centerLabel}>Gold:</label>
                                                <div className={classes.goldRow}>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <input
                                                            type="number"
                                                            step="100"
                                                            value={game.gold1 || 0}
                                                            disabled={game.gameStatus?.trim() === 'Processed'}
                                                            onChange={(e) => {
                                                                const value = parseInt(e.target.value) || 0;
                                                                const updated = [...gameResults];
                                                                updated[idx] = {
                                                                    ...updated[idx],
                                                                    gold1: value,
                                                                    gold2: -value
                                                                };
                                                                setGameResults(updated);
                                                            }}
                                                            className={`${classes.goldInput} ${
                                                                game.gold1 > 0
                                                                    ? classes.goldPositive
                                                                    : game.gold1 < 0
                                                                      ? classes.goldNegative
                                                                      : ''
                                                            }`}
                                                        />
                                                    </div>
                                                    <img src={goldImg} alt="Gold" className={classes.goldIcon} />
                                                    <div className={classes.scoreDivider}>⚔️</div>
                                                    <img src={goldImg} alt="Gold" className={classes.goldIcon} />
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div className={classes.goldPlayerLabel}>{pair.team2}</div>
                                                        <input
                                                            type="number"
                                                            value={game.gold2 || 0}
                                                            disabled={game.gameStatus?.trim() === 'Processed'}
                                                            onChange={(e) => {
                                                                const value = parseInt(e.target.value) || 0;
                                                                const updated = [...gameResults];
                                                                updated[idx] = {
                                                                    ...updated[idx],
                                                                    gold2: value,
                                                                    gold1: -value
                                                                };
                                                                setGameResults(updated);
                                                            }}
                                                            className={`${classes.goldInput} ${
                                                                game.gold2 > 0
                                                                    ? classes.goldPositive
                                                                    : game.gold2 < 0
                                                                      ? classes.goldNegative
                                                                      : ''
                                                            }`}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Restarts Input for BO-3 */}
                                            <div className={`${classes.formGroup} ${classes.layered}`}>
                                                <label className={classes.centerLabel}>Restarts:</label>
                                                <div className={classes.dualRow}>
                                                    <div className={classes.playerColumn}>
                                                        <div className={classes.goldPlayerLabel}>{pair.team1}</div>
                                                        <div className={classes.restartGroup}>
                                                            {[0, 1].map((boxIdx) => {
                                                                const isUsed = (game.restart1_111 || 0) > boxIdx;
                                                                const isDisabled =
                                                                    (game.restart1_112 || 0) > 0 ||
                                                                    game.gameStatus?.trim() === 'Processed';
                                                                return (
                                                                    <RestartBox
                                                                        key={`p1-111-${boxIdx}`}
                                                                        code="111"
                                                                        isUsed={isUsed}
                                                                        isDisabled={isDisabled}
                                                                        showMark={isUsed}
                                                                        onClick={() => {
                                                                            if (isDisabled) {
                                                                                return;
                                                                            }
                                                                            const updated = [...gameResults];
                                                                            const current =
                                                                                updated[idx].restart1_111 || 0;
                                                                            if (isUsed) {
                                                                                updated[idx] = {
                                                                                    ...updated[idx],
                                                                                    restart1_111: current - 1
                                                                                };
                                                                            } else if (current < 2) {
                                                                                updated[idx] = {
                                                                                    ...updated[idx],
                                                                                    restart1_111: current + 1
                                                                                };
                                                                            }
                                                                            setGameResults(updated);
                                                                        }}
                                                                    />
                                                                );
                                                            })}
                                                            <RestartBox
                                                                code="112"
                                                                isUsed={(game.restart1_112 || 0) === 1}
                                                                isDisabled={
                                                                    (game.restart1_111 || 0) > 0 ||
                                                                    game.gameStatus?.trim() === 'Processed'
                                                                }
                                                                showMark={
                                                                    (game.restart1_112 || 0) === 1 ||
                                                                    (game.restart1_111 || 0) > 0
                                                                }
                                                                blockPointer={(game.restart1_111 || 0) > 0}
                                                                onClick={() => {
                                                                    const updated = [...gameResults];
                                                                    const current = updated[idx].restart1_112 || 0;
                                                                    const is111Used =
                                                                        (updated[idx].restart1_111 || 0) > 0;
                                                                    if (
                                                                        is111Used ||
                                                                        game.gameStatus?.trim() === 'Processed'
                                                                    ) {
                                                                        return;
                                                                    }
                                                                    updated[idx] = {
                                                                        ...updated[idx],
                                                                        restart1_112: current === 1 ? 0 : 1
                                                                    };
                                                                    setGameResults(updated);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className={classes.playerColumn}>
                                                        <div className={classes.goldPlayerLabel}>{pair.team2}</div>
                                                        <div className={classes.restartGroup}>
                                                            {[0, 1].map((boxIdx) => {
                                                                const isUsed = (game.restart2_111 || 0) > boxIdx;
                                                                const isDisabled =
                                                                    (game.restart2_112 || 0) > 0 ||
                                                                    game.gameStatus?.trim() === 'Processed';
                                                                return (
                                                                    <RestartBox
                                                                        key={`p2-111-${boxIdx}`}
                                                                        code="111"
                                                                        isUsed={isUsed}
                                                                        isDisabled={isDisabled}
                                                                        showMark={isUsed}
                                                                        onClick={() => {
                                                                            if (isDisabled) {
                                                                                return;
                                                                            }
                                                                            const updated = [...gameResults];
                                                                            const current =
                                                                                updated[idx].restart2_111 || 0;
                                                                            if (isUsed) {
                                                                                updated[idx] = {
                                                                                    ...updated[idx],
                                                                                    restart2_111: current - 1
                                                                                };
                                                                            } else if (current < 2) {
                                                                                updated[idx] = {
                                                                                    ...updated[idx],
                                                                                    restart2_111: current + 1
                                                                                };
                                                                            }
                                                                            setGameResults(updated);
                                                                        }}
                                                                    />
                                                                );
                                                            })}
                                                            <RestartBox
                                                                code="112"
                                                                isUsed={(game.restart2_112 || 0) === 1}
                                                                isDisabled={
                                                                    (game.restart2_111 || 0) > 0 ||
                                                                    game.gameStatus?.trim() === 'Processed'
                                                                }
                                                                showMark={
                                                                    (game.restart2_112 || 0) === 1 ||
                                                                    (game.restart2_111 || 0) > 0
                                                                }
                                                                blockPointer={(game.restart2_111 || 0) > 0}
                                                                onClick={() => {
                                                                    const updated = [...gameResults];
                                                                    const current = updated[idx].restart2_112 || 0;
                                                                    const is111Used =
                                                                        (updated[idx].restart2_111 || 0) > 0;
                                                                    if (
                                                                        is111Used ||
                                                                        game.gameStatus?.trim() === 'Processed'
                                                                    ) {
                                                                        return;
                                                                    }
                                                                    updated[idx] = {
                                                                        ...updated[idx],
                                                                        restart2_112: current === 1 ? 0 : 1
                                                                    };
                                                                    setGameResults(updated);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={`${classes.formGroup} ${classes.layered}`}>
                                                <label className={classes.centerLabel}>Castles:</label>
                                                <div className={classes.castleDualRow}>
                                                    <div className={classes.playerColumn}>
                                                        <div className={classes.goldPlayerLabel}>{pair.team1}</div>
                                                        <div className={classes.castleGrid}>
                                                            {castles.map((c) => {
                                                                const isSelected = game.castle1 === c;
                                                                const isGameProcessed =
                                                                    game.gameStatus &&
                                                                    game.gameStatus.trim() === 'Processed';
                                                                const isBanned = (game.bannedCastles1 || []).includes(
                                                                    c
                                                                );
                                                                return (
                                                                    <CastleTile
                                                                        key={c}
                                                                        castleName={c}
                                                                        isSelected={isSelected}
                                                                        isBanned={isBanned}
                                                                        isDisabled={isGameProcessed}
                                                                        hasSelection={Boolean(game.castle1)}
                                                                        onToggle={() => {
                                                                            if (isGameProcessed) {
                                                                                return;
                                                                            }
                                                                            const updated = [...gameResults];
                                                                            const g = updated[idx];
                                                                            const banned = g.bannedCastles1 || [];
                                                                            if (isBanned) {
                                                                                updated[idx] = {
                                                                                    ...g,
                                                                                    bannedCastles1: banned.filter(
                                                                                        (x) => x !== c
                                                                                    )
                                                                                };
                                                                            } else if (isSelected) {
                                                                                updated[idx] = {
                                                                                    ...g,
                                                                                    castle1: '',
                                                                                    bannedCastles1: [...banned, c]
                                                                                };
                                                                            } else {
                                                                                updated[idx] = { ...g, castle1: c };
                                                                            }
                                                                            setGameResults(updated);
                                                                        }}
                                                                    />
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                    <div className={classes.playerColumn}>
                                                        <div className={classes.goldPlayerLabel}>{pair.team2}</div>
                                                        <div className={classes.castleGrid}>
                                                            {castles.map((c) => {
                                                                const isSelected = game.castle2 === c;
                                                                const isGameProcessed =
                                                                    game.gameStatus &&
                                                                    game.gameStatus.trim() === 'Processed';
                                                                const isBanned = (game.bannedCastles2 || []).includes(
                                                                    c
                                                                );
                                                                return (
                                                                    <CastleTile
                                                                        key={c}
                                                                        castleName={c}
                                                                        isSelected={isSelected}
                                                                        isBanned={isBanned}
                                                                        isDisabled={isGameProcessed}
                                                                        hasSelection={Boolean(game.castle2)}
                                                                        onToggle={() => {
                                                                            if (isGameProcessed) {
                                                                                return;
                                                                            }
                                                                            const updated = [...gameResults];
                                                                            const g = updated[idx];
                                                                            const banned = g.bannedCastles2 || [];
                                                                            if (isBanned) {
                                                                                updated[idx] = {
                                                                                    ...g,
                                                                                    bannedCastles2: banned.filter(
                                                                                        (x) => x !== c
                                                                                    )
                                                                                };
                                                                            } else if (isSelected) {
                                                                                updated[idx] = {
                                                                                    ...g,
                                                                                    castle2: '',
                                                                                    bannedCastles2: [...banned, c]
                                                                                };
                                                                            } else {
                                                                                updated[idx] = { ...g, castle2: c };
                                                                            }
                                                                            setGameResults(updated);
                                                                        }}
                                                                    />
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* <div className={`${classes.formGroup} ${classes.layered}`}>
                                        <label>Winner:</label>
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: '1rem',
                                                justifyContent: 'center',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div
                                                onClick={() => handleGameResultChange(idx, 'winner', pair.team1)}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    padding: '1rem',
                                                    border:
                                                        game.winner === pair.team1
                                                            ? '3px solid #FFD700'
                                                            : '2px solid #00ffff',
                                                    borderRadius: '8px',
                                                    background:
                                                        game.winner === pair.team1
                                                            ? 'rgba(255, 215, 0, 0.1)'
                                                            : 'rgba(0, 255, 255, 0.05)',
                                                    opacity: game.winner === pair.team1 ? 1 : 0.6,
                                                    transform: game.winner === pair.team1 ? 'scale(1.05)' : 'scale(1)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: '60px',
                                                        height: '60px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '24px',
                                                        fontWeight: 'bold',
                                                        color: '#FFD700',
                                                        marginBottom: '0.5rem',
                                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                                                    }}
                                                >
                                                    {pair.team1.charAt(0).toUpperCase()}
                                                </div>
                                                <div
                                                    style={{
                                                        color: '#00ffff',
                                                        fontSize: '12px',
                                                        textAlign: 'center'
                                                    }}
                                                >
                                                    {pair.team1}
                                                </div>
                                            </div>
                                            <div
                                                onClick={() => handleGameResultChange(idx, 'winner', pair.team2)}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    padding: '1rem',
                                                    border:
                                                        game.winner === pair.team2
                                                            ? '3px solid #FFD700'
                                                            : '2px solid #00ffff',
                                                    borderRadius: '8px',
                                                    background:
                                                        game.winner === pair.team2
                                                            ? 'rgba(255, 215, 0, 0.1)'
                                                            : 'rgba(0, 255, 255, 0.05)',
                                                    opacity: game.winner === pair.team2 ? 1 : 0.6,
                                                    transform: game.winner === pair.team2 ? 'scale(1.05)' : 'scale(1)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: '60px',
                                                        height: '60px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '24px',
                                                        fontWeight: 'bold',
                                                        color: '#FFD700',
                                                        marginBottom: '0.5rem',
                                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                                                    }}
                                                >
                                                    {pair.team2.charAt(0).toUpperCase()}
                                                </div>
                                                <div
                                                    style={{
                                                        color: '#00ffff',
                                                        fontSize: '12px',
                                                        textAlign: 'center'
                                                    }}
                                                >
                                                    {pair.team2}
                                                </div>
                                            </div>
                                        </div>
                                    </div> */}
                                        </div>
                                        <div className={`${classes.restartConfirmationRow} ${classes.layered}`}>
                                            <label className={classes.restartConfirmationLabel}>
                                                <input
                                                    type="checkbox"
                                                    checked={game.restartsFinished || false}
                                                    onChange={(e) => {
                                                        const updated = [...gameResults];
                                                        updated[idx] = {
                                                            ...updated[idx],
                                                            restartsFinished: e.target.checked
                                                        };
                                                        setGameResults(updated);
                                                    }}
                                                />
                                                Restarts finished / main game started
                                            </label>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className={classes.gameSection}>
                            {/* Left Side Background - Player 1 for BO-1 */}
                            <div
                                className={classes.gameBgLeft}
                                style={{
                                    backgroundImage: castle1
                                        ? `linear-gradient(to right, rgba(139, 0, 0, ${color1 === 'red' ? '0.12' : '0'}), rgba(139, 0, 0, ${color1 === 'red' ? '0.03' : '0'})), linear-gradient(to right, rgba(0, 0, 139, ${color1 === 'blue' ? '0.12' : '0'}), rgba(0, 0, 139, ${color1 === 'blue' ? '0.03' : '0'})), url(${getCastleImageUrl(castle1)})`
                                        : color1 === 'red'
                                          ? 'linear-gradient(to right, rgba(139, 0, 0, 0.12), rgba(139, 0, 0, 0.03))'
                                          : 'linear-gradient(to right, rgba(0, 0, 139, 0.12), rgba(0, 0, 139, 0.03))',
                                    backgroundSize: castle1 ? 'auto, auto, cover' : 'auto',
                                    backgroundPosition: castle1 ? 'left, left, left' : 'left'
                                }}
                            />
                            {/* Right Side Background - Player 2 for BO-1 */}
                            <div
                                className={classes.gameBgRight}
                                style={{
                                    backgroundImage: castle2
                                        ? `linear-gradient(to left, rgba(139, 0, 0, ${color2 === 'red' ? '0.12' : '0'}), rgba(139, 0, 0, ${color2 === 'red' ? '0.03' : '0'})), linear-gradient(to left, rgba(0, 0, 139, ${color2 === 'blue' ? '0.12' : '0'}), rgba(0, 0, 139, ${color2 === 'blue' ? '0.03' : '0'})), url(${getCastleImageUrl(castle2)})`
                                        : color2 === 'red'
                                          ? 'linear-gradient(to left, rgba(139, 0, 0, 0.12), rgba(139, 0, 0, 0.03))'
                                          : 'linear-gradient(to left, rgba(0, 0, 139, 0.12), rgba(0, 0, 139, 0.03))',
                                    backgroundSize: castle2 ? 'auto, auto, cover' : 'auto',
                                    backgroundPosition: castle2 ? 'right, right, right' : 'right'
                                }}
                            />
                            {/* Center Divider for BO-1 */}
                            <div className={classes.gameDivider} />
                            {/* BO-1 Game Result */}

                            {/* Compact Score/Winner Section for BO-1 */}
                            <div className={`${classes.formGroup} ${classes.layered}`}>
                                <div
                                    className={`${classes.scoreBar} ${
                                        color1 === 'red' ? classes.scoreBarRedLead : classes.scoreBarBlueLead
                                    }`}
                                >
                                    <div className={classes.playerRow}>
                                        <div className={`${classes.avatar} ${classes.avatarSm}`}>
                                            {avatar1 ? (
                                                <img src={avatar1} alt={pair.team1} className={classes.avatarImg} />
                                            ) : (
                                                pair.team1.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div
                                            className={classes.flagToggle}
                                            onClick={() => {
                                                const newColor = color1 === 'red' ? 'blue' : 'red';
                                                const oppositeColor = newColor === 'red' ? 'blue' : 'red';
                                                setColor1(newColor);
                                                setColor2(oppositeColor);
                                            }}
                                        >
                                            <img
                                                src={color1 === 'red' ? redFlagImg : blueFlagImg}
                                                alt={color1 === 'red' ? 'Red flag' : 'Blue flag'}
                                                className={`${classes.flagImg} ${
                                                    color1 === 'red' ? classes.flagImgRed : classes.flagImgBlue
                                                }`}
                                            />
                                        </div>
                                        <div
                                            onClick={() => {
                                                setSelectedWinner(pair.team1);
                                                setScore1(1);
                                                setScore2(0);
                                            }}
                                            className={`${classes.winnerPick} ${
                                                selectedWinner === pair.team1 ? classes.winnerPickSelected : ''
                                            }`}
                                        >
                                            {pair.team1}
                                        </div>
                                    </div>

                                    <div className={classes.scoreRow}>
                                        <div className={classes.scoreValue}>{score1}</div>
                                        <div className={classes.scoreDivider}>⚔️</div>
                                        <div className={classes.scoreValue}>{score2}</div>
                                    </div>

                                    <div className={`${classes.playerRow} ${classes.playerRowEnd}`}>
                                        <div
                                            onClick={() => {
                                                setSelectedWinner(pair.team2);
                                                setScore1(0);
                                                setScore2(1);
                                            }}
                                            className={`${classes.winnerPick} ${
                                                selectedWinner === pair.team2 ? classes.winnerPickSelected : ''
                                            }`}
                                        >
                                            {pair.team2}
                                        </div>
                                        <div
                                            className={classes.flagToggle}
                                            onClick={() => {
                                                const newColor = color2 === 'red' ? 'blue' : 'red';
                                                const oppositeColor = newColor === 'red' ? 'blue' : 'red';
                                                setColor2(newColor);
                                                setColor1(oppositeColor);
                                            }}
                                        >
                                            <img
                                                src={color2 === 'red' ? redFlagImg : blueFlagImg}
                                                alt={color2 === 'red' ? 'Red flag' : 'Blue flag'}
                                                className={`${classes.flagImg} ${
                                                    color2 === 'red' ? classes.flagImgRed : classes.flagImgBlue
                                                }`}
                                            />
                                        </div>
                                        <div className={`${classes.avatar} ${classes.avatarSm}`}>
                                            {avatar2 ? (
                                                <img src={avatar2} alt={pair.team2} className={classes.avatarImg} />
                                            ) : (
                                                pair.team2.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Color Selection for BO-1 */}
                            {/* <div className={classes.formGroup}>
                                <label>Player Colors:</label>
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '2rem',
                                        justifyContent: 'center',
                                        marginBottom: '1rem'
                                    }}
                                >
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ marginBottom: '0.5rem', color: '#00ffff', fontSize: '14px' }}>
                                            {pair.team1}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <div
                                                onClick={() => {
                                                    setColor1('red');
                                                    setColor2('blue');
                                                }}
                                                style={{
                                                    width: '60px',
                                                    height: '60px',
                                                    borderRadius: '8px',
                                                    background: 'linear-gradient(135deg, #8B0000, #FF0000, #DC143C)',
                                                    border:
                                                        color1 === 'red' ? '4px solid #FFD700' : '3px solid #4a0000',
                                                    cursor: 'pointer',
                                                    boxShadow:
                                                        color1 === 'red'
                                                            ? '0 0 20px rgba(255, 0, 0, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.2)'
                                                            : '0 4px 8px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.1)',
                                                    transform: color1 === 'red' ? 'scale(1.1)' : 'scale(1)',
                                                    transition: 'all 0.2s ease',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                {color1 === 'red' && (
                                                    <span
                                                        style={{
                                                            color: '#FFD700',
                                                            fontSize: '24px',
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        ✓
                                                    </span>
                                                )}
                                            </div>
                                            <div
                                                onClick={() => {
                                                    setColor1('blue');
                                                    setColor2('red');
                                                }}
                                                style={{
                                                    width: '60px',
                                                    height: '60px',
                                                    borderRadius: '8px',
                                                    background: 'linear-gradient(135deg, #00008B, #0000FF, #4169E1)',
                                                    border:
                                                        color1 === 'blue' ? '4px solid #FFD700' : '3px solid #000045',
                                                    cursor: 'pointer',
                                                    boxShadow:
                                                        color1 === 'blue'
                                                            ? '0 0 20px rgba(0, 0, 255, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.2)'
                                                            : '0 4px 8px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.1)',
                                                    transform: color1 === 'blue' ? 'scale(1.1)' : 'scale(1)',
                                                    transition: 'all 0.2s ease',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                {color1 === 'blue' && (
                                                    <span
                                                        style={{
                                                            color: '#FFD700',
                                                            fontSize: '24px',
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        ✓
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ marginBottom: '0.5rem', color: '#00ffff', fontSize: '14px' }}>
                                            {pair.team2}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <div
                                                onClick={() => {
                                                    setColor2('red');
                                                    setColor1('blue');
                                                }}
                                                style={{
                                                    width: '60px',
                                                    height: '60px',
                                                    borderRadius: '8px',
                                                    background: 'linear-gradient(135deg, #8B0000, #FF0000, #DC143C)',
                                                    border:
                                                        color2 === 'red' ? '4px solid #FFD700' : '3px solid #4a0000',
                                                    cursor: 'pointer',
                                                    boxShadow:
                                                        color2 === 'red'
                                                            ? '0 0 20px rgba(255, 0, 0, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.2)'
                                                            : '0 4px 8px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.1)',
                                                    transform: color2 === 'red' ? 'scale(1.1)' : 'scale(1)',
                                                    transition: 'all 0.2s ease',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                {color2 === 'red' && (
                                                    <span
                                                        style={{
                                                            color: '#FFD700',
                                                            fontSize: '24px',
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        ✓
                                                    </span>
                                                )}
                                            </div>
                                            <div
                                                onClick={() => {
                                                    setColor2('blue');
                                                    setColor1('red');
                                                }}
                                                style={{
                                                    width: '60px',
                                                    height: '60px',
                                                    borderRadius: '8px',
                                                    background: 'linear-gradient(135deg, #00008B, #0000FF, #4169E1)',
                                                    border:
                                                        color2 === 'blue' ? '4px solid #FFD700' : '3px solid #000045',
                                                    cursor: 'pointer',
                                                    boxShadow:
                                                        color2 === 'blue'
                                                            ? '0 0 20px rgba(0, 0, 255, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.2)'
                                                            : '0 4px 8px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.1)',
                                                    transform: color2 === 'blue' ? 'scale(1.1)' : 'scale(1)',
                                                    transition: 'all 0.2s ease',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                {color2 === 'blue' && (
                                                    <span
                                                        style={{
                                                            color: '#FFD700',
                                                            fontSize: '24px',
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        ✓
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div> */}

                            {/* Gold Input for BO-1 */}
                            <div className={`${classes.formGroup} ${classes.layered}`}>
                                <label className={classes.centerLabel}>Gold:</label>
                                <div className={classes.goldRow}>
                                    <div className={classes.playerColumn}>
                                        <input
                                            type="number"
                                            step="100"
                                            value={gold1}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value) || 0;
                                                setGold1(value);
                                                setGold2(-value);
                                            }}
                                            className={`${classes.goldInput} ${
                                                gold1 > 0 ? classes.goldPositive : gold1 < 0 ? classes.goldNegative : ''
                                            }`}
                                        />
                                    </div>
                                    <img src={goldImg} alt="Gold" className={classes.goldIcon} />
                                    <div className={classes.scoreDivider}>⚔️</div>
                                    <img src={goldImg} alt="Gold" className={classes.goldIcon} />
                                    <div className={classes.playerColumn}>
                                        {/* <div style={{ marginBottom: '0.5rem', color: '#00ffff', fontSize: '14px' }}>
                                            {pair.team2}
                                        </div> */}
                                        <input
                                            type="number"
                                            step="100"
                                            value={gold2}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value) || 0;
                                                setGold2(value);
                                                setGold1(-value);
                                            }}
                                            className={`${classes.goldInput} ${
                                                gold2 > 0 ? classes.goldPositive : gold2 < 0 ? classes.goldNegative : ''
                                            }`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Restarts Input for BO-1 */}
                            <div className={`${classes.formGroup} ${classes.layered}`}>
                                <label className={classes.centerLabel}>Restarts:</label>
                                <div className={classes.dualRow}>
                                    <div className={classes.playerColumn}>
                                        <div className={classes.restartGroup}>
                                            {[0, 1].map((boxIdx) => {
                                                const isUsed = restart1_111 > boxIdx;
                                                const isDisabled = restart1_112 > 0;
                                                return (
                                                    <RestartBox
                                                        key={`bo1-p1-111-${boxIdx}`}
                                                        code="111"
                                                        isUsed={isUsed}
                                                        isDisabled={isDisabled}
                                                        showMark={isUsed || isDisabled}
                                                        onClick={() => {
                                                            if (isDisabled) {
                                                                return;
                                                            }
                                                            if (isUsed) {
                                                                setRestart1_111(restart1_111 - 1);
                                                            } else if (restart1_111 < 2) {
                                                                setRestart1_111(restart1_111 + 1);
                                                            }
                                                        }}
                                                    />
                                                );
                                            })}
                                            <RestartBox
                                                code="112"
                                                isUsed={restart1_112 === 1}
                                                isDisabled={restart1_111 > 0}
                                                showMark={restart1_112 === 1 || restart1_111 > 0}
                                                blockPointer={restart1_111 > 0}
                                                onClick={() => {
                                                    if (restart1_111 > 0) {
                                                        return;
                                                    }
                                                    setRestart1_112(restart1_112 === 1 ? 0 : 1);
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className={classes.playerColumn}>
                                        <div className={classes.restartGroup}>
                                            {[0, 1].map((boxIdx) => {
                                                const isUsed = restart2_111 > boxIdx;
                                                const isDisabled = restart2_112 > 0;
                                                return (
                                                    <RestartBox
                                                        key={`bo1-p2-111-${boxIdx}`}
                                                        code="111"
                                                        isUsed={isUsed}
                                                        isDisabled={isDisabled}
                                                        showMark={isUsed}
                                                        onClick={() => {
                                                            if (isDisabled) {
                                                                return;
                                                            }
                                                            if (isUsed) {
                                                                setRestart2_111(restart2_111 - 1);
                                                            } else if (restart2_111 < 2) {
                                                                setRestart2_111(restart2_111 + 1);
                                                            }
                                                        }}
                                                    />
                                                );
                                            })}
                                            <RestartBox
                                                code="112"
                                                isUsed={restart2_112 === 1}
                                                isDisabled={restart2_111 > 0}
                                                showMark={restart2_112 === 1 || restart2_111 > 0}
                                                blockPointer={restart2_111 > 0}
                                                onClick={() => {
                                                    if (restart2_111 > 0) {
                                                        return;
                                                    }
                                                    setRestart2_112(restart2_112 === 1 ? 0 : 1);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={`${classes.formGroup} ${classes.layered}`}>
                                <label className={classes.centerLabel}>Castles:</label>
                                <div className={classes.castleDualRow}>
                                    <div className={classes.playerColumn}>
                                        <div className={classes.castleGrid}>
                                            {castles.map((c) => {
                                                const isGameFinished = pair.winner;
                                                const isBanned = bannedCastlesBO1_1.includes(c);
                                                const isSelected = castle1 === c;
                                                return (
                                                    <CastleTile
                                                        key={c}
                                                        castleName={c}
                                                        isSelected={isSelected}
                                                        isBanned={isBanned}
                                                        isDisabled={Boolean(isGameFinished)}
                                                        hasSelection={Boolean(castle1)}
                                                        onToggle={() => {
                                                            if (isGameFinished) {
                                                                return;
                                                            }
                                                            if (isBanned) {
                                                                setBannedCastlesBO1_1(
                                                                    bannedCastlesBO1_1.filter((x) => x !== c)
                                                                );
                                                            } else if (isSelected) {
                                                                setCastle1('');
                                                                setBannedCastlesBO1_1([...bannedCastlesBO1_1, c]);
                                                            } else {
                                                                setCastle1(c);
                                                            }
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className={classes.playerColumn}>
                                        <div className={classes.castleGrid}>
                                            {castles.map((c) => {
                                                const isGameFinished = pair.winner;
                                                const isBanned = bannedCastlesBO1_2.includes(c);
                                                const isSelected = castle2 === c;
                                                return (
                                                    <CastleTile
                                                        key={c}
                                                        castleName={c}
                                                        isSelected={isSelected}
                                                        isBanned={isBanned}
                                                        isDisabled={Boolean(isGameFinished)}
                                                        hasSelection={Boolean(castle2)}
                                                        onToggle={() => {
                                                            if (isGameFinished) {
                                                                return;
                                                            }
                                                            if (isBanned) {
                                                                setBannedCastlesBO1_2(
                                                                    bannedCastlesBO1_2.filter((x) => x !== c)
                                                                );
                                                            } else if (isSelected) {
                                                                setCastle2('');
                                                                setBannedCastlesBO1_2([...bannedCastlesBO1_2, c]);
                                                            } else {
                                                                setCastle2(c);
                                                            }
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* <div className={classes.formGroup}>
                                <label>Winner:</label>
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '1rem',
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div
                                        onClick={() => {
                                            setSelectedWinner(pair.team1);
                                            setScore1(1);
                                            setScore2(0);
                                        }}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            padding: '1rem',
                                            border:
                                                selectedWinner === pair.team1
                                                    ? '3px solid #FFD700'
                                                    : '2px solid #00ffff',
                                            borderRadius: '8px',
                                            background:
                                                selectedWinner === pair.team1
                                                    ? 'rgba(255, 215, 0, 0.1)'
                                                    : 'rgba(0, 255, 255, 0.05)',
                                            opacity: selectedWinner === pair.team1 ? 1 : 0.6,
                                            transform: selectedWinner === pair.team1 ? 'scale(1.05)' : 'scale(1)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '24px',
                                                fontWeight: 'bold',
                                                color: '#FFD700',
                                                marginBottom: '0.5rem',
                                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                                            }}
                                        >
                                            {pair.team1.charAt(0).toUpperCase()}
                                        </div>
                                        <div
                                            style={{
                                                color: '#00ffff',
                                                fontSize: '12px',
                                                textAlign: 'center'
                                            }}
                                        >
                                            {pair.team1}
                                        </div>
                                    </div>
                                    <div
                                        onClick={() => {
                                            setSelectedWinner(pair.team2);
                                            setScore1(0);
                                            setScore2(1);
                                        }}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            padding: '1rem',
                                            border:
                                                selectedWinner === pair.team2
                                                    ? '3px solid #FFD700'
                                                    : '2px solid #00ffff',
                                            borderRadius: '8px',
                                            background:
                                                selectedWinner === pair.team2
                                                    ? 'rgba(255, 215, 0, 0.1)'
                                                    : 'rgba(0, 255, 255, 0.05)',
                                            opacity: selectedWinner === pair.team2 ? 1 : 0.6,
                                            transform: selectedWinner === pair.team2 ? 'scale(1.05)' : 'scale(1)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '24px',
                                                fontWeight: 'bold',
                                                color: '#FFD700',
                                                marginBottom: '0.5rem',
                                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                                            }}
                                        >
                                            {pair.team2.charAt(0).toUpperCase()}
                                        </div>
                                        <div
                                            style={{
                                                color: '#00ffff',
                                                fontSize: '12px',
                                                textAlign: 'center'
                                            }}
                                        >
                                            {pair.team2}
                                        </div>
                                    </div>
                                </div>
                            </div> */}
                        </div>
                    )}

                    {!isSeriesMatch && (
                        <div className={`${classes.restartConfirmationRow} ${classes.layered}`}>
                            <label className={classes.restartConfirmationLabel}>
                                <input
                                    type="checkbox"
                                    checked={restartsFinished}
                                    onChange={(e) => setRestartsFinished(e.target.checked)}
                                />
                                Restarts finished / main game started
                            </label>
                        </div>
                    )}

                    <div className={classes.mockModeRow}>
                        <label className={classes.mockModeLabel}>
                            <input
                                type="checkbox"
                                checked={mockMode}
                                onChange={(event) => setMockMode(event.target.checked)}
                            />
                            Mock result (test — bracket + promotion only, no stats or castle availability)
                        </label>
                    </div>

                    <div className={`${classes.buttonGroup} ${classes.layered}`}>
                        <button
                            type="submit"
                            className={`${classes.submitButton} ${mockMode ? classes.submitButtonMock : ''}`}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <span className={classes.submitLoadingLabel}>
                                    <span className={classes.submitSpinner} aria-hidden="true" />
                                    Reporting result...
                                </span>
                            ) : mockMode ? (
                                'Submit (bracket only)'
                            ) : (
                                'Submit Result'
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className={classes.cancelButton}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default ReportGameModal;
