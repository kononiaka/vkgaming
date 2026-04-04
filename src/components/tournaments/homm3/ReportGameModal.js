import React, { useState, useEffect } from 'react';
import classes from './ReportGameModal.module.css';
import { getAvatar, lookForUserId, fetchCastlesList, getPairProgress, savePairProgress } from '../../../api/api';
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

const ReportGameModal = ({ pair, pairId, tournamentId, onClose, onSubmit, playoffPairs }) => {
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

    // All state is initialized only after progress is loaded
    const [latestProcessedStage, setLatestProcessedStage] = useState('');
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

    // When progress is loaded, restore only fields the pair useEffect doesn't already cover
    useEffect(() => {
        if (!progressLoaded) {
            return;
        }
        // latestStage, bannedCastles and castleMarkOverrides are NOT in pair data — restore from progress
        setLatestProcessedStage(initial.latestStage || '');
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
        // For series: restore gameResults from initial.games if present
        if (initial.games && initial.games.length > 1) {
            setGameResults(
                initial.games.map((g, idx) => ({
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
    }, [progressLoaded]);

    // List of all reporting stages in order
    const reportingStages = ['castle_stats', 'ratings', 'game_posted', 'prizes', 'finished'];
    const getBestOfValue = (type) => {
        const normalized = String(type || '')
            .toLowerCase()
            .trim();
        if (normalized === 'bo-5' || normalized === '5' || normalized === 'bo5') {
            return 5;
        }
        if (normalized === 'bo-3' || normalized === '3' || normalized === 'bo3') {
            return 3;
        }
        return 1;
    };

    const bestOf = getBestOfValue(pair.type);
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
    const calculateAvailableCastles = (apiCastles, pairsData) => {
        // API castles already have the correct 'total' count
        const castlesWithLiveGames = apiCastles.map((castle) => {
            let liveGames = 0;
            // Count live games across all stages
            if (pairsData && Array.isArray(pairsData)) {
                pairsData.forEach((stage) => {
                    if (Array.isArray(stage)) {
                        stage.forEach((matchPair) => {
                            if (matchPair.games && Array.isArray(matchPair.games)) {
                                matchPair.games.forEach((game) => {
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
                    }
                });
            }
            return { ...castle, liveGames };
        });
        return [...castlesWithLiveGames].sort((a, b) => a.total - b.total);
    };

    // Get border color for a castle based on availability
    const getCastleBorderColor = (castleName) => {
        // Check for manual marks first (selected or deactivated)
        const manualMark = castleMarkOverrides[castleName];
        if (manualMark === 'selected') {
            return '#4ade80'; // Green for manually selected
        }
        if (manualMark === 'deactivated') {
            return '#f87171'; // Red for manually deactivated
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
                pair.games.map((game, idx) => ({
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
        if (playoffPairs) {
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
        }
    }, [playoffPairs, pair]);

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

        // Auto-add deciding game for incremental series setup (e.g. BO-3 starts with 2, BO-5 with 4).
        const shouldAddDeciderGame =
            isSeriesMatch &&
            updated.length < bestOf &&
            team1Wins === team2Wins &&
            team1Wins + team2Wins === updated.length;

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

        // Auto-select winner if required wins are reached.
        if (team1Wins >= requiredWins) {
            setSelectedWinner(pair.team1);
        } else if (team2Wins >= requiredWins) {
            setSelectedWinner(pair.team2);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

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
            if (selectedWinner) {
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

        // Persist final progress to backend
        savePairProgress(tournamentId, pairId, {
            ...reportData,
            latestStage: 'submitted',
            bannedCastlesBO1_1,
            bannedCastlesBO1_2,
            castleMarkOverrides
        });
        onSubmit(reportData);
    };

    return (
        <div
            className={classes.backdrop}
            onClick={() => {
                onClose();
            }}
        >
            <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
                <button
                    className={classes.closeButton}
                    onClick={() => {
                        onClose();
                    }}
                >
                    ×
                </button>

                {/* Player Header Bar at Top - STICKY (only for series matches) */}
                {isSeriesMatch && (
                    <div
                        style={{
                            position: 'sticky',
                            top: '0',
                            left: '0%',
                            transform: 'translateX(0%)',
                            background: 'linear-gradient(135deg, rgba(62, 32, 192, 0.98), rgba(45, 20, 150, 0.98))',
                            border: '3px solid #FFD700',
                            borderRadius: '0 0 12px 12px',
                            padding: '0.75rem 1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '2rem',
                            boxShadow: '0 4px 20px rgba(255, 215, 0, 0.8), 0 8px 40px rgba(0, 0, 0, 0.5)',
                            zIndex: 100,
                            minWidth: '500px',
                            backdropFilter: 'blur(10px)',
                            marginBottom: '1rem'
                        }}
                    >
                        {/* Player 1 Section */}
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div
                                style={{
                                    width: '58px',
                                    height: '58px',
                                    borderRadius: '50%',
                                    background: avatar1 ? 'transparent' : 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '20px',
                                    fontWeight: 'bold',
                                    color: '#FFD700',
                                    border: '3px solid #FFD700',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), 0 0 15px rgba(255, 215, 0, 0.3)',
                                    textShadow: '0 0 8px rgba(255, 215, 0, 0.8)',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}
                            >
                                {avatar1 ? (
                                    <img
                                        src={avatar1}
                                        alt={pair.team1}
                                        style={{
                                            // width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            borderRadius: '50%'
                                        }}
                                    />
                                ) : (
                                    pair.team1.charAt(0).toUpperCase()
                                )}
                            </div>
                            <span
                                style={{
                                    color: '#00ffff',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    textShadow: '0 0 8px rgba(0, 255, 255, 0.6)'
                                }}
                            >
                                {pair.team1}
                            </span>
                        </div>

                        {/* Center Score Section */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.25rem'
                            }}
                        >
                            <div
                                style={{
                                    color: '#FFD700',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    letterSpacing: '1px'
                                }}
                            >
                                {pair.type.toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div
                                    style={{
                                        color: '#FFD700',
                                        fontSize: '28px',
                                        fontWeight: 'bold',
                                        textShadow: '0 0 10px rgba(255, 215, 0, 0.8)'
                                    }}
                                >
                                    {score1}
                                </div>
                                <div style={{ color: '#FFD700', fontSize: '20px', fontWeight: 'bold' }}>-</div>
                                <div
                                    style={{
                                        color: '#FFD700',
                                        fontSize: '28px',
                                        fontWeight: 'bold',
                                        textShadow: '0 0 10px rgba(255, 215, 0, 0.8)'
                                    }}
                                >
                                    {score2}
                                </div>
                            </div>
                        </div>

                        {/* Player 2 Section */}
                        <div
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                justifyContent: 'flex-end'
                            }}
                        >
                            <span
                                style={{
                                    color: '#00ffff',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    textShadow: '0 0 8px rgba(0, 255, 255, 0.6)'
                                }}
                            >
                                {pair.team2}
                            </span>
                            <div
                                style={{
                                    width: '66px',
                                    height: '58px',
                                    borderRadius: '50%',
                                    background: avatar2 ? 'transparent' : 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '20px',
                                    fontWeight: 'bold',
                                    color: '#FFD700',
                                    border: '3px solid #FFD700',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), 0 0 15px rgba(255, 215, 0, 0.3)',
                                    textShadow: '0 0 8px rgba(255, 215, 0, 0.8)',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}
                            >
                                {avatar2 ? (
                                    <img
                                        src={avatar2}
                                        alt={pair.team2}
                                        style={{
                                            // width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            borderRadius: '50%'
                                        }}
                                    />
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
                            {gameResults.map((game, idx) => (
                                <div
                                    key={idx}
                                    className={classes.gameSection}
                                    style={{
                                        position: 'relative',
                                        overflow: 'hidden',
                                        display:
                                            idx === gameResults.length - 1 &&
                                            gameResults.length === bestOf &&
                                            score1 + score2 < gameResults.length - 1
                                                ? 'none'
                                                : undefined
                                    }}
                                >
                                    {/* Left Side Background - Player 1 for this game */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '50%',
                                            height: '100%',
                                            backgroundColor: 'transparent',
                                            backgroundImage: game.castle1
                                                ? `linear-gradient(to right, rgba(139, 0, 0, ${game.color1 === 'red' ? '0.12' : '0'}), rgba(139, 0, 0, ${game.color1 === 'red' ? '0.03' : '0'})), linear-gradient(to right, rgba(0, 0, 139, ${game.color1 === 'blue' ? '0.12' : '0'}), rgba(0, 0, 139, ${game.color1 === 'blue' ? '0.03' : '0'})), url(${getCastleImageUrl(game.castle1)})`
                                                : game.color1 === 'red'
                                                  ? 'linear-gradient(to right, rgba(139, 0, 0, 0.12), rgba(139, 0, 0, 0.03))'
                                                  : 'linear-gradient(to right, rgba(0, 0, 139, 0.12), rgba(0, 0, 139, 0.03))',
                                            backgroundSize: game.castle1 ? 'auto, auto, cover' : 'auto',
                                            backgroundPosition: game.castle1 ? 'left, left, left' : 'left',
                                            backgroundRepeat: 'no-repeat',
                                            opacity: 0.7,
                                            zIndex: 0,
                                            pointerEvents: 'none'
                                        }}
                                    />
                                    {/* Right Side Background - Player 2 for this game */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            right: 0,
                                            width: '50%',
                                            height: '100%',
                                            backgroundColor: 'transparent',
                                            backgroundImage: game.castle2
                                                ? `linear-gradient(to left, rgba(139, 0, 0, ${game.color2 === 'red' ? '0.12' : '0'}), rgba(139, 0, 0, ${game.color2 === 'red' ? '0.03' : '0'})), linear-gradient(to left, rgba(0, 0, 139, ${game.color2 === 'blue' ? '0.12' : '0'}), rgba(0, 0, 139, ${game.color2 === 'blue' ? '0.03' : '0'})), url(${getCastleImageUrl(game.castle2)})`
                                                : game.color2 === 'red'
                                                  ? 'linear-gradient(to left, rgba(139, 0, 0, 0.12), rgba(139, 0, 0, 0.03))'
                                                  : 'linear-gradient(to left, rgba(0, 0, 139, 0.12), rgba(0, 0, 139, 0.03))',
                                            backgroundSize: game.castle2 ? 'auto, auto, cover' : 'auto',
                                            backgroundPosition: game.castle2 ? 'right, right, right' : 'right',
                                            backgroundRepeat: 'no-repeat',
                                            opacity: 0.7,
                                            zIndex: 0,
                                            pointerEvents: 'none'
                                        }}
                                    />
                                    {/* Center Divider for this game */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: '50%',
                                            width: '2px',
                                            height: '100%',
                                            background:
                                                'linear-gradient(to bottom, #FFD700, rgba(255, 215, 0, 0.2), #FFD700)',
                                            zIndex: 1,
                                            pointerEvents: 'none'
                                        }}
                                    />
                                    <h3 className={classes.gameTitle} style={{ position: 'relative', zIndex: 2 }}>
                                        Game {idx + 1}
                                    </h3>

                                    {/* Compact Score/Winner Section with Color Toggle */}
                                    <div className={classes.formGroup} style={{ position: 'relative', zIndex: 2 }}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '1rem',
                                                marginBottom: '1rem',
                                                padding: '0.75rem',
                                                background:
                                                    game.color1 === 'red'
                                                        ? 'linear-gradient(to right, rgba(255, 100, 100, 0.95) 0%, rgba(255, 200, 200, 0.7) 20%, rgba(255, 255, 255, 0.5) 50%, rgba(200, 200, 255, 0.7) 80%, rgba(100, 100, 255, 0.95) 100%)'
                                                        : 'linear-gradient(to right, rgba(100, 100, 255, 0.95) 0%, rgba(200, 200, 255, 0.7) 20%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 200, 200, 0.7) 80%, rgba(255, 100, 100, 0.95) 100%)',
                                                borderRadius: '8px',
                                                border: '2px solid #FFD700',
                                                boxShadow:
                                                    game.color1 === 'red'
                                                        ? '0 0 15px rgba(255, 0, 0, 0.4), inset -100px 0 50px -50px rgba(139, 0, 0, 0.3)'
                                                        : '0 0 15px rgba(0, 0, 255, 0.4), inset -100px 0 50px -50px rgba(0, 0, 139, 0.3)'
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    flex: 1
                                                }}
                                            >
                                                <div
                                                    onClick={() => {
                                                        const updated = [...gameResults];
                                                        const newColor = game.color1 === 'red' ? 'blue' : 'red';
                                                        const oppositeColor = newColor === 'red' ? 'blue' : 'red';
                                                        updated[idx] = {
                                                            ...updated[idx],
                                                            color1: newColor,
                                                            color2: oppositeColor
                                                        };
                                                        setGameResults(updated);
                                                    }}
                                                    style={{
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <img
                                                        src={game.color1 === 'red' ? redFlagImg : blueFlagImg}
                                                        alt={game.color1 === 'red' ? 'Red flag' : 'Blue flag'}
                                                        style={{
                                                            width: '42px',
                                                            height: '42px',
                                                            objectFit: 'contain',
                                                            filter:
                                                                game.color1 === 'red'
                                                                    ? 'drop-shadow(0 0 3px rgba(255, 0, 0, 0.8))'
                                                                    : 'drop-shadow(0 0 3px rgba(0, 0, 255, 0.8))'
                                                        }}
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
                                                    style={{
                                                        cursor:
                                                            game.gameStatus?.trim() === 'Processed'
                                                                ? 'not-allowed'
                                                                : 'pointer',
                                                        padding: '0.5rem 1rem',
                                                        borderRadius: '6px',
                                                        border:
                                                            game.winner === pair.team1
                                                                ? '3px solid #FFD700'
                                                                : '2px solid transparent',
                                                        background:
                                                            game.winner === pair.team1
                                                                ? 'rgba(255, 215, 0, 0.2)'
                                                                : 'transparent',
                                                        color: '#000000',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold',
                                                        opacity: game.winner === pair.team1 ? 1 : 0.6,
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    {pair.team1}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div
                                                    style={{
                                                        fontSize: '20px',
                                                        fontWeight: 'bold',
                                                        color: '#FFD700'
                                                    }}
                                                >
                                                    {score1}
                                                </div>
                                                <div style={{ color: '#FFD700', fontSize: '20px' }}>⚔️</div>
                                                <div
                                                    style={{
                                                        fontSize: '20px',
                                                        fontWeight: 'bold',
                                                        color: '#FFD700'
                                                    }}
                                                >
                                                    {score2}
                                                </div>
                                            </div>

                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    flex: 1,
                                                    justifyContent: 'flex-end'
                                                }}
                                            >
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
                                                    style={{
                                                        cursor:
                                                            game.gameStatus?.trim() === 'Processed'
                                                                ? 'not-allowed'
                                                                : 'pointer',
                                                        padding: '0.5rem 1rem',
                                                        borderRadius: '6px',
                                                        border:
                                                            game.winner === pair.team2
                                                                ? '3px solid #FFD700'
                                                                : '2px solid transparent',
                                                        background:
                                                            game.winner === pair.team2
                                                                ? 'rgba(255, 215, 0, 0.2)'
                                                                : 'transparent',
                                                        color: '#000000',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold',
                                                        opacity: game.winner === pair.team2 ? 1 : 0.6,
                                                        transition: 'all 0.2s ease',
                                                        textAlign: 'right'
                                                    }}
                                                >
                                                    {pair.team2}
                                                </div>
                                                <div
                                                    onClick={() => {
                                                        const updated = [...gameResults];
                                                        const newColor = game.color2 === 'red' ? 'blue' : 'red';
                                                        const oppositeColor = newColor === 'red' ? 'blue' : 'red';
                                                        updated[idx] = {
                                                            ...updated[idx],
                                                            color2: newColor,
                                                            color1: oppositeColor
                                                        };
                                                        setGameResults(updated);
                                                    }}
                                                    style={{
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <img
                                                        src={game.color2 === 'red' ? redFlagImg : blueFlagImg}
                                                        alt={game.color2 === 'red' ? 'Red flag' : 'Blue flag'}
                                                        style={{
                                                            width: '42px',
                                                            height: '42px',
                                                            objectFit: 'contain',
                                                            filter:
                                                                game.color2 === 'red'
                                                                    ? 'drop-shadow(0 0 3px rgba(255, 0, 0, 0.8))'
                                                                    : 'drop-shadow(0 0 3px rgba(0, 0, 255, 0.8))'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Gold Input for BO-3 */}
                                    <div className={classes.formGroup} style={{ position: 'relative', zIndex: 2 }}>
                                        <label style={{ textAlign: 'center', display: 'block' }}>Gold:</label>
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: '2rem',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                marginBottom: '1rem'
                                            }}
                                        >
                                            <div style={{ textAlign: 'center' }}>
                                                <input
                                                    type="number"
                                                    step="100"
                                                    value={game.gold1 || 0}
                                                    disabled={game.gameStatus?.trim() === 'Processed'}
                                                    onChange={(e) => {
                                                        const value = parseInt(e.target.value) || 0;
                                                        const updated = [...gameResults];
                                                        updated[idx] = { ...updated[idx], gold1: value, gold2: -value };
                                                        setGameResults(updated);
                                                    }}
                                                    style={{
                                                        width: '120px',
                                                        padding: '0.5rem',
                                                        fontSize: '16px',
                                                        textAlign: 'center',
                                                        border: '3px solid #FFD700',
                                                        borderRadius: '8px',
                                                        background:
                                                            'linear-gradient(135deg, rgba(62, 32, 192, 1), rgba(45, 20, 150, 1))',
                                                        color:
                                                            game.gold1 > 0
                                                                ? '#00FF00'
                                                                : game.gold1 < 0
                                                                  ? '#FF0000'
                                                                  : '#FFD700',
                                                        fontWeight: 'bold',
                                                        boxShadow:
                                                            '0 2px 8px rgba(62, 32, 192, 0.3), inset 0 1px 2px rgba(255, 215, 0, 0.1)',
                                                        opacity: game.gameStatus?.trim() === 'Processed' ? 0.5 : 1,
                                                        cursor:
                                                            game.gameStatus?.trim() === 'Processed'
                                                                ? 'not-allowed'
                                                                : 'auto'
                                                    }}
                                                />
                                            </div>
                                            <img
                                                src={goldImg}
                                                alt="Gold"
                                                style={{
                                                    width: '45px',
                                                    height: '35px',
                                                    objectFit: 'contain',
                                                    filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4))'
                                                }}
                                            />
                                            <div style={{ color: '#FFD700', fontSize: '24px', fontWeight: 'bold' }}>
                                                ⚔️
                                            </div>
                                            <img
                                                src={goldImg}
                                                alt="Gold"
                                                style={{
                                                    width: '45px',
                                                    height: '35px',
                                                    objectFit: 'contain',
                                                    filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4))'
                                                }}
                                            />
                                            <div style={{ textAlign: 'center' }}>
                                                <div
                                                    style={{
                                                        marginBottom: '0.5rem',
                                                        color: '#00ffff',
                                                        fontSize: '14px'
                                                    }}
                                                >
                                                    {pair.team2}
                                                </div>
                                                <input
                                                    type="number"
                                                    value={game.gold2 || 0}
                                                    disabled={game.gameStatus?.trim() === 'Processed'}
                                                    onChange={(e) => {
                                                        const value = parseInt(e.target.value) || 0;
                                                        const updated = [...gameResults];
                                                        updated[idx] = { ...updated[idx], gold2: value, gold1: -value };
                                                        setGameResults(updated);
                                                    }}
                                                    style={{
                                                        width: '120px',
                                                        padding: '0.5rem',
                                                        fontSize: '16px',
                                                        textAlign: 'center',
                                                        border: '3px solid #FFD700',
                                                        borderRadius: '8px',
                                                        background:
                                                            'linear-gradient(135deg, rgba(62, 32, 192, 1), rgba(45, 20, 150, 1))',
                                                        color:
                                                            game.gold2 > 0
                                                                ? '#00FF00'
                                                                : game.gold2 < 0
                                                                  ? '#FF0000'
                                                                  : '#FFD700',
                                                        fontWeight: 'bold',
                                                        boxShadow:
                                                            '0 2px 8px rgba(62, 32, 192, 0.3), inset 0 1px 2px rgba(255, 215, 0, 0.1)',
                                                        opacity: game.gameStatus?.trim() === 'Processed' ? 0.5 : 1,
                                                        cursor:
                                                            game.gameStatus?.trim() === 'Processed'
                                                                ? 'not-allowed'
                                                                : 'auto'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Restarts Input for BO-3 */}
                                    <div className={classes.formGroup} style={{ position: 'relative', zIndex: 2 }}>
                                        <label style={{ textAlign: 'center', display: 'block' }}>Restarts:</label>
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: '2rem',
                                                justifyContent: 'center',
                                                marginBottom: '1rem'
                                            }}
                                        >
                                            <div style={{ textAlign: 'center' }}>
                                                <div
                                                    style={{
                                                        marginBottom: '0.5rem',
                                                        color: '#00ffff',
                                                        fontSize: '14px'
                                                    }}
                                                >
                                                    {pair.team1}
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    {/* 111 Restart Boxes */}
                                                    {[0, 1].map((boxIdx) => {
                                                        const isUsed = (game.restart1_111 || 0) > boxIdx;
                                                        const isDisabled =
                                                            (game.restart1_112 || 0) > 0 ||
                                                            game.gameStatus?.trim() === 'Processed';
                                                        return (
                                                            <div
                                                                key={`111-${boxIdx}`}
                                                                onClick={() => {
                                                                    if (isDisabled) {
                                                                        return;
                                                                    }
                                                                    const updated = [...gameResults];
                                                                    const current = updated[idx].restart1_111 || 0;
                                                                    if (isUsed) {
                                                                        // Remove one
                                                                        updated[idx] = {
                                                                            ...updated[idx],
                                                                            restart1_111: current - 1
                                                                        };
                                                                    } else if (current < 2) {
                                                                        // Add one
                                                                        updated[idx] = {
                                                                            ...updated[idx],
                                                                            restart1_111: current + 1
                                                                        };
                                                                    }
                                                                    setGameResults(updated);
                                                                }}
                                                                style={{
                                                                    position: 'relative',
                                                                    width: '50px',
                                                                    height: '50px',
                                                                    border: '2px solid #FFD700',
                                                                    borderRadius: '4px',
                                                                    background: isDisabled
                                                                        ? 'rgba(0, 0, 0, 0.5)'
                                                                        : isUsed
                                                                          ? 'linear-gradient(135deg, rgba(62, 32, 192, 1), rgba(45, 20, 150, 1))'
                                                                          : 'rgba(0, 0, 0, 0.3)',
                                                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    opacity: isDisabled ? 0.4 : isUsed ? 1 : 0.6,
                                                                    boxShadow: isUsed
                                                                        ? '0 0 10px rgba(255, 215, 0, 0.6)'
                                                                        : 'none'
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        color: '#FFD700',
                                                                        fontSize: '14px',
                                                                        fontWeight: 'bold'
                                                                    }}
                                                                >
                                                                    111
                                                                </div>
                                                                {isUsed && (
                                                                    <div
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: '50%',
                                                                            left: '50%',
                                                                            transform: 'translate(-50%, -50%)',
                                                                            color: '#FF0000',
                                                                            fontSize: '40px',
                                                                            fontWeight: 'bold',
                                                                            lineHeight: '1',
                                                                            textShadow: '0 0 4px #000'
                                                                        }}
                                                                    >
                                                                        ✕
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    {/* 112 Restart Box */}
                                                    <div
                                                        onClick={() => {
                                                            const updated = [...gameResults];
                                                            const current = updated[idx].restart1_112 || 0;
                                                            const is111Used = (updated[idx].restart1_111 || 0) > 0;
                                                            if (is111Used || game.gameStatus?.trim() === 'Processed') {
                                                                return;
                                                            }
                                                            updated[idx] = {
                                                                ...updated[idx],
                                                                restart1_112: current === 1 ? 0 : 1
                                                            };
                                                            setGameResults(updated);
                                                        }}
                                                        style={{
                                                            position: 'relative',
                                                            width: '50px',
                                                            height: '50px',
                                                            border: '2px solid #FFD700',
                                                            borderRadius: '4px',
                                                            background:
                                                                (game.restart1_111 || 0) > 0
                                                                    ? 'rgba(0, 0, 0, 0.5)'
                                                                    : (game.restart1_112 || 0) === 1
                                                                      ? 'linear-gradient(135deg, rgba(62, 32, 192, 1), rgba(45, 20, 150, 1))'
                                                                      : 'rgba(0, 0, 0, 0.3)',
                                                            cursor:
                                                                (game.restart1_111 || 0) > 0
                                                                    ? 'not-allowed'
                                                                    : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            opacity:
                                                                (game.restart1_111 || 0) > 0
                                                                    ? 0.4
                                                                    : (game.restart1_112 || 0) === 1
                                                                      ? 1
                                                                      : 0.6,
                                                            boxShadow:
                                                                (game.restart1_112 || 0) === 1
                                                                    ? '0 0 10px rgba(255, 215, 0, 0.6)'
                                                                    : 'none',
                                                            pointerEvents:
                                                                (game.restart1_111 || 0) > 0 ? 'none' : 'auto'
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                color: '#FFD700',
                                                                fontSize: '14px',
                                                                fontWeight: 'bold'
                                                            }}
                                                        >
                                                            112
                                                        </div>
                                                        {((game.restart1_112 || 0) === 1 ||
                                                            (game.restart1_111 || 0) > 0) && (
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '50%',
                                                                    left: '50%',
                                                                    transform: 'translate(-50%, -50%)',
                                                                    color: '#FF0000',
                                                                    fontSize: '40px',
                                                                    fontWeight: 'bold',
                                                                    lineHeight: '1',
                                                                    textShadow: '0 0 4px #000'
                                                                }}
                                                            >
                                                                ✕
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div
                                                    style={{
                                                        marginBottom: '0.5rem',
                                                        color: '#00ffff',
                                                        fontSize: '14px'
                                                    }}
                                                >
                                                    {pair.team2}
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    {/* 111 Restart Boxes */}
                                                    {[0, 1].map((boxIdx) => {
                                                        const isUsed = (game.restart2_111 || 0) > boxIdx;
                                                        const isDisabled =
                                                            (game.restart2_112 || 0) > 0 ||
                                                            game.gameStatus?.trim() === 'Processed';
                                                        return (
                                                            <div
                                                                key={`111-${boxIdx}`}
                                                                onClick={() => {
                                                                    if (isDisabled) {
                                                                        return;
                                                                    }
                                                                    const updated = [...gameResults];
                                                                    const current = updated[idx].restart2_111 || 0;
                                                                    if (isUsed) {
                                                                        // Remove one
                                                                        updated[idx] = {
                                                                            ...updated[idx],
                                                                            restart2_111: current - 1
                                                                        };
                                                                    } else if (current < 2) {
                                                                        // Add one
                                                                        updated[idx] = {
                                                                            ...updated[idx],
                                                                            restart2_111: current + 1
                                                                        };
                                                                    }
                                                                    setGameResults(updated);
                                                                }}
                                                                style={{
                                                                    position: 'relative',
                                                                    width: '50px',
                                                                    height: '50px',
                                                                    border: '2px solid #FFD700',
                                                                    borderRadius: '4px',
                                                                    background: isDisabled
                                                                        ? 'rgba(0, 0, 0, 0.5)'
                                                                        : isUsed
                                                                          ? 'linear-gradient(135deg, rgba(62, 32, 192, 1), rgba(45, 20, 150, 1))'
                                                                          : 'rgba(0, 0, 0, 0.3)',
                                                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    opacity: isDisabled ? 0.4 : isUsed ? 1 : 0.6,
                                                                    boxShadow: isUsed
                                                                        ? '0 0 10px rgba(255, 215, 0, 0.6)'
                                                                        : 'none'
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        color: '#FFD700',
                                                                        fontSize: '14px',
                                                                        fontWeight: 'bold'
                                                                    }}
                                                                >
                                                                    111
                                                                </div>
                                                                {isUsed && (
                                                                    <div
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: '50%',
                                                                            left: '50%',
                                                                            transform: 'translate(-50%, -50%)',
                                                                            color: '#FF0000',
                                                                            fontSize: '40px',
                                                                            fontWeight: 'bold',
                                                                            lineHeight: '1',
                                                                            textShadow: '0 0 4px #000'
                                                                        }}
                                                                    >
                                                                        ✕
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    {/* 112 Restart Box */}
                                                    <div
                                                        onClick={() => {
                                                            const updated = [...gameResults];
                                                            const current = updated[idx].restart2_112 || 0;
                                                            const is111Used = (updated[idx].restart2_111 || 0) > 0;
                                                            if (is111Used || game.gameStatus?.trim() === 'Processed') {
                                                                return;
                                                            }
                                                            updated[idx] = {
                                                                ...updated[idx],
                                                                restart2_112: current === 1 ? 0 : 1
                                                            };
                                                            setGameResults(updated);
                                                        }}
                                                        style={{
                                                            position: 'relative',
                                                            width: '50px',
                                                            height: '50px',
                                                            border: '2px solid #FFD700',
                                                            borderRadius: '4px',
                                                            background:
                                                                (game.restart2_111 || 0) > 0
                                                                    ? 'rgba(0, 0, 0, 0.5)'
                                                                    : (game.restart2_112 || 0) === 1
                                                                      ? 'linear-gradient(135deg, rgba(62, 32, 192, 1), rgba(45, 20, 150, 1))'
                                                                      : 'rgba(0, 0, 0, 0.3)',
                                                            cursor:
                                                                (game.restart2_111 || 0) > 0
                                                                    ? 'not-allowed'
                                                                    : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            opacity:
                                                                (game.restart2_111 || 0) > 0
                                                                    ? 0.4
                                                                    : (game.restart2_112 || 0) === 1
                                                                      ? 1
                                                                      : 0.6,
                                                            boxShadow:
                                                                (game.restart2_112 || 0) === 1
                                                                    ? '0 0 10px rgba(255, 215, 0, 0.6)'
                                                                    : 'none',
                                                            pointerEvents:
                                                                (game.restart2_111 || 0) > 0 ? 'none' : 'auto'
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                color: '#FFD700',
                                                                fontSize: '14px',
                                                                fontWeight: 'bold'
                                                            }}
                                                        >
                                                            112
                                                        </div>
                                                        {((game.restart2_112 || 0) === 1 ||
                                                            (game.restart2_111 || 0) > 0) && (
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '50%',
                                                                    left: '50%',
                                                                    transform: 'translate(-50%, -50%)',
                                                                    color: '#FF0000',
                                                                    fontSize: '40px',
                                                                    fontWeight: 'bold',
                                                                    lineHeight: '1',
                                                                    textShadow: '0 0 4px #000'
                                                                }}
                                                            >
                                                                ✕
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={classes.formGroup} style={{ position: 'relative', zIndex: 2 }}>
                                        <label style={{ textAlign: 'center', display: 'block' }}>Castles:</label>
                                        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div
                                                    style={{
                                                        marginBottom: '0.5rem',
                                                        color: '#00ffff',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {pair.team1}
                                                </div>
                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                                        gap: '0.5rem',
                                                        maxWidth: '400px',
                                                        justifyItems: 'center'
                                                    }}
                                                >
                                                    {castles.map((c) => {
                                                        const isSelected = game.castle1 === c;
                                                        const isGameProcessed =
                                                            game.gameStatus && game.gameStatus.trim() === 'Processed';
                                                        const isBanned = (game.bannedCastles1 || []).includes(c);
                                                        const handleCastle1Toggle = () => {
                                                            if (isGameProcessed) {
                                                                return;
                                                            }
                                                            const updated = [...gameResults];
                                                            const g = updated[idx];
                                                            const banned = g.bannedCastles1 || [];
                                                            if (isBanned) {
                                                                updated[idx] = {
                                                                    ...g,
                                                                    bannedCastles1: banned.filter((x) => x !== c)
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
                                                        };
                                                        return (
                                                            <div
                                                                key={c}
                                                                style={{
                                                                    position: 'relative',
                                                                    width: '105px',
                                                                    height: '60px',
                                                                    cursor: isGameProcessed ? 'not-allowed' : 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                                onClick={handleCastle1Toggle}
                                                            >
                                                                <img
                                                                    src={getCastleImageUrl(c)}
                                                                    alt={c}
                                                                    title={c}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCastle1Toggle();
                                                                    }}
                                                                    style={{
                                                                        width: '105px',
                                                                        height: '60px',
                                                                        border: `3px solid ${getCastleBorderColor(c)}`,
                                                                        borderRadius: '4px',
                                                                        objectFit: 'cover',
                                                                        opacity: game.castle1
                                                                            ? isSelected
                                                                                ? 1
                                                                                : 0.3
                                                                            : getCastleBorderColor(c) === '#f87171'
                                                                              ? 0.4
                                                                              : 1,
                                                                        filter:
                                                                            game.castle1 && !isSelected
                                                                                ? 'grayscale(70%)'
                                                                                : 'none',
                                                                        transform: 'scale(1)',
                                                                        transition: 'all 0.2s ease',
                                                                        boxShadow: `0 0 8px ${getCastleBorderColor(c)}80`
                                                                    }}
                                                                />
                                                                {/* Indicator Overlay for castle1 */}
                                                                {(isSelected || isBanned) && (
                                                                    <div
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: '-8px',
                                                                            right: '-8px',
                                                                            width: '32px',
                                                                            height: '32px',
                                                                            borderRadius: '50%',
                                                                            backgroundColor: isSelected
                                                                                ? '#00CC00'
                                                                                : '#FF3333',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            fontSize: '20px',
                                                                            fontWeight: 'bold',
                                                                            color: 'white',
                                                                            boxShadow: `0 3px 8px rgba(${isSelected ? '0, 204, 0' : '255, 51, 51'}, 0.6)`,
                                                                            border: '2px solid white'
                                                                        }}
                                                                    >
                                                                        {isSelected ? '✓' : '✕'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div
                                                    style={{
                                                        marginBottom: '0.5rem',
                                                        color: '#00ffff',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {pair.team2}
                                                </div>
                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                                        gap: '0.5rem',
                                                        maxWidth: '400px',
                                                        justifyItems: 'center'
                                                    }}
                                                >
                                                    {castles.map((c) => {
                                                        const isSelected = game.castle2 === c;
                                                        const isGameProcessed =
                                                            game.gameStatus && game.gameStatus.trim() === 'Processed';
                                                        const isBanned = (game.bannedCastles2 || []).includes(c);
                                                        const handleCastle2Toggle = () => {
                                                            if (isGameProcessed) {
                                                                return;
                                                            }
                                                            const updated = [...gameResults];
                                                            const g = updated[idx];
                                                            const banned = g.bannedCastles2 || [];
                                                            if (isBanned) {
                                                                updated[idx] = {
                                                                    ...g,
                                                                    bannedCastles2: banned.filter((x) => x !== c)
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
                                                        };
                                                        return (
                                                            <div
                                                                key={c}
                                                                style={{
                                                                    position: 'relative',
                                                                    width: '105px',
                                                                    height: '60px',
                                                                    cursor: isGameProcessed ? 'not-allowed' : 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                                onClick={handleCastle2Toggle}
                                                            >
                                                                <img
                                                                    src={getCastleImageUrl(c)}
                                                                    alt={c}
                                                                    title={c}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCastle2Toggle();
                                                                    }}
                                                                    style={{
                                                                        width: '105px',
                                                                        height: '60px',
                                                                        border: `3px solid ${getCastleBorderColor(c)}`,
                                                                        borderRadius: '4px',
                                                                        objectFit: 'cover',
                                                                        opacity: game.castle2
                                                                            ? isSelected
                                                                                ? 1
                                                                                : 0.3
                                                                            : getCastleBorderColor(c) === '#f87171'
                                                                              ? 0.4
                                                                              : 1,
                                                                        filter:
                                                                            game.castle2 && !isSelected
                                                                                ? 'grayscale(70%)'
                                                                                : 'none',
                                                                        transform: 'scale(1)',
                                                                        transition: 'all 0.2s ease',
                                                                        boxShadow: `0 0 8px ${getCastleBorderColor(c)}80`
                                                                    }}
                                                                />
                                                                {/* Indicator Overlay for castle2 */}
                                                                {(isSelected || isBanned) && (
                                                                    <div
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: '-8px',
                                                                            right: '-8px',
                                                                            width: '32px',
                                                                            height: '32px',
                                                                            borderRadius: '50%',
                                                                            backgroundColor: isSelected
                                                                                ? '#00CC00'
                                                                                : '#FF3333',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            fontSize: '20px',
                                                                            fontWeight: 'bold',
                                                                            color: 'white',
                                                                            boxShadow: `0 3px 8px rgba(${isSelected ? '0, 204, 0' : '255, 51, 51'}, 0.6)`,
                                                                            border: '2px solid white'
                                                                        }}
                                                                    >
                                                                        {isSelected ? '✓' : '✕'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* <div className={classes.formGroup} style={{ position: 'relative', zIndex: 2 }}>
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
                                    <div className={classes.restartConfirmationRow}>
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
                            ))}
                        </div>
                    ) : (
                        <div style={{ position: 'relative', overflow: 'hidden' }}>
                            {/* Left Side Background - Player 1 for BO-1 */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '50%',
                                    height: '100%',
                                    backgroundColor: 'transparent',
                                    backgroundImage: castle1
                                        ? `linear-gradient(to right, rgba(139, 0, 0, ${color1 === 'red' ? '0.12' : '0'}), rgba(139, 0, 0, ${color1 === 'red' ? '0.03' : '0'})), linear-gradient(to right, rgba(0, 0, 139, ${color1 === 'blue' ? '0.12' : '0'}), rgba(0, 0, 139, ${color1 === 'blue' ? '0.03' : '0'})), url(${getCastleImageUrl(castle1)})`
                                        : color1 === 'red'
                                          ? 'linear-gradient(to right, rgba(139, 0, 0, 0.12), rgba(139, 0, 0, 0.03))'
                                          : 'linear-gradient(to right, rgba(0, 0, 139, 0.12), rgba(0, 0, 139, 0.03))',
                                    backgroundSize: castle1 ? 'auto, auto, cover' : 'auto',
                                    backgroundPosition: castle1 ? 'left, left, left' : 'left',
                                    backgroundRepeat: 'no-repeat',
                                    opacity: 0.75,
                                    zIndex: 0,
                                    pointerEvents: 'none'
                                }}
                            />
                            {/* Right Side Background - Player 2 for BO-1 */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    width: '50%',
                                    height: '100%',
                                    backgroundColor: 'transparent',
                                    backgroundImage: castle2
                                        ? `linear-gradient(to left, rgba(139, 0, 0, ${color2 === 'red' ? '0.12' : '0'}), rgba(139, 0, 0, ${color2 === 'red' ? '0.03' : '0'})), linear-gradient(to left, rgba(0, 0, 139, ${color2 === 'blue' ? '0.12' : '0'}), rgba(0, 0, 139, ${color2 === 'blue' ? '0.03' : '0'})), url(${getCastleImageUrl(castle2)})`
                                        : color2 === 'red'
                                          ? 'linear-gradient(to left, rgba(139, 0, 0, 0.12), rgba(139, 0, 0, 0.03))'
                                          : 'linear-gradient(to left, rgba(0, 0, 139, 0.12), rgba(0, 0, 139, 0.03))',
                                    backgroundSize: castle2 ? 'auto, auto, cover' : 'auto',
                                    backgroundPosition: castle2 ? 'right, right, right' : 'right',
                                    backgroundRepeat: 'no-repeat',
                                    opacity: 0.75,
                                    zIndex: 0,
                                    pointerEvents: 'none'
                                }}
                            />
                            {/* Center Divider for BO-1 */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: '50%',
                                    width: '2px',
                                    height: '100%',
                                    background: 'linear-gradient(to bottom, #FFD700, rgba(255, 215, 0, 0.2), #FFD700)',
                                    zIndex: 1,
                                    pointerEvents: 'none'
                                }}
                            />
                            {/* BO-1 Game Result */}

                            {/* Compact Score/Winner Section for BO-1 */}
                            <div className={classes.formGroup} style={{ position: 'relative', zIndex: 2 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '1rem',
                                        marginBottom: '1rem',
                                        padding: '0.75rem',
                                        background:
                                            color1 === 'red'
                                                ? 'linear-gradient(to right, rgba(255, 100, 100, 0.95) 0%, rgba(255, 200, 200, 0.7) 20%, rgba(255, 255, 255, 0.5) 50%, rgba(200, 200, 255, 0.7) 80%, rgba(100, 100, 255, 0.95) 100%)'
                                                : 'linear-gradient(to right, rgba(100, 100, 255, 0.95) 0%, rgba(200, 200, 255, 0.7) 20%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 200, 200, 0.7) 80%, rgba(255, 100, 100, 0.95) 100%)',
                                        borderRadius: '8px',
                                        border: '2px solid #FFD700',
                                        boxShadow:
                                            color1 === 'red'
                                                ? '0 0 15px rgba(255, 0, 0, 0.4), inset -100px 0 50px -50px rgba(139, 0, 0, 0.3)'
                                                : '0 0 15px rgba(0, 0, 255, 0.4), inset -100px 0 50px -50px rgba(0, 0, 139, 0.3)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                        <div
                                            style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '50%',
                                                background: avatar1
                                                    ? 'transparent'
                                                    : 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '16px',
                                                fontWeight: 'bold',
                                                color: '#FFD700',
                                                border: '2px solid #FFD700',
                                                boxShadow:
                                                    '0 2px 8px rgba(0, 0, 0, 0.4), 0 0 10px rgba(255, 215, 0, 0.3)',
                                                textShadow: '0 0 8px rgba(255, 215, 0, 0.8)',
                                                overflow: 'hidden',
                                                position: 'relative'
                                            }}
                                        >
                                            {avatar1 ? (
                                                <img
                                                    src={avatar1}
                                                    alt={pair.team1}
                                                    style={{
                                                        height: '100%',
                                                        objectFit: 'cover',
                                                        borderRadius: '50%'
                                                    }}
                                                />
                                            ) : (
                                                pair.team1.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div
                                            onClick={() => {
                                                const newColor = color1 === 'red' ? 'blue' : 'red';
                                                const oppositeColor = newColor === 'red' ? 'blue' : 'red';
                                                setColor1(newColor);
                                                setColor2(oppositeColor);
                                            }}
                                            style={{
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <img
                                                src={color1 === 'red' ? redFlagImg : blueFlagImg}
                                                alt={color1 === 'red' ? 'Red flag' : 'Blue flag'}
                                                style={{
                                                    width: '42px',
                                                    height: '42px',
                                                    objectFit: 'contain',
                                                    filter:
                                                        color1 === 'red'
                                                            ? 'drop-shadow(0 0 3px rgba(255, 0, 0, 0.8))'
                                                            : 'drop-shadow(0 0 3px rgba(0, 0, 255, 0.8))'
                                                }}
                                            />
                                        </div>
                                        <div
                                            onClick={() => {
                                                setSelectedWinner(pair.team1);
                                                setScore1(1);
                                                setScore2(0);
                                            }}
                                            style={{
                                                cursor: 'pointer',
                                                padding: '0.5rem 1rem',
                                                borderRadius: '6px',
                                                border:
                                                    selectedWinner === pair.team1
                                                        ? '3px solid #FFD700'
                                                        : '2px solid transparent',
                                                background:
                                                    selectedWinner === pair.team1
                                                        ? 'rgba(255, 215, 0, 0.2)'
                                                        : 'transparent',
                                                color: '#000000',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                opacity: selectedWinner === pair.team1 ? 1 : 0.6,
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {pair.team1}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div
                                            style={{
                                                fontSize: '20px',
                                                fontWeight: 'bold',
                                                color: '#FFD700'
                                            }}
                                        >
                                            {score1}
                                        </div>
                                        <div style={{ color: '#FFD700', fontSize: '20px' }}>⚔️</div>
                                        <div
                                            style={{
                                                fontSize: '20px',
                                                fontWeight: 'bold',
                                                color: '#FFD700'
                                            }}
                                        >
                                            {score2}
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            flex: 1,
                                            justifyContent: 'flex-end'
                                        }}
                                    >
                                        <div
                                            onClick={() => {
                                                setSelectedWinner(pair.team2);
                                                setScore1(0);
                                                setScore2(1);
                                            }}
                                            style={{
                                                cursor: 'pointer',
                                                padding: '0.5rem 1rem',
                                                borderRadius: '6px',
                                                border:
                                                    selectedWinner === pair.team2
                                                        ? '3px solid #FFD700'
                                                        : '2px solid transparent',
                                                background:
                                                    selectedWinner === pair.team2
                                                        ? 'rgba(255, 215, 0, 0.2)'
                                                        : 'transparent',
                                                color: '#000000',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                opacity: selectedWinner === pair.team2 ? 1 : 0.6,
                                                transition: 'all 0.2s ease',
                                                textAlign: 'right'
                                            }}
                                        >
                                            {pair.team2}
                                        </div>
                                        <div
                                            onClick={() => {
                                                const newColor = color2 === 'red' ? 'blue' : 'red';
                                                const oppositeColor = newColor === 'red' ? 'blue' : 'red';
                                                setColor2(newColor);
                                                setColor1(oppositeColor);
                                            }}
                                            style={{
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <img
                                                src={color2 === 'red' ? redFlagImg : blueFlagImg}
                                                alt={color2 === 'red' ? 'Red flag' : 'Blue flag'}
                                                style={{
                                                    width: '42px',
                                                    height: '42px',
                                                    objectFit: 'contain',
                                                    filter:
                                                        color2 === 'red'
                                                            ? 'drop-shadow(0 0 3px rgba(255, 0, 0, 0.8))'
                                                            : 'drop-shadow(0 0 3px rgba(0, 0, 255, 0.8))'
                                                }}
                                            />
                                        </div>
                                        <div
                                            style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '50%',
                                                background: avatar2
                                                    ? 'transparent'
                                                    : 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '16px',
                                                fontWeight: 'bold',
                                                color: '#FFD700',
                                                border: '2px solid #FFD700',
                                                boxShadow:
                                                    '0 2px 8px rgba(0, 0, 0, 0.4), 0 0 10px rgba(255, 215, 0, 0.3)',
                                                textShadow: '0 0 8px rgba(255, 215, 0, 0.8)',
                                                overflow: 'hidden',
                                                position: 'relative'
                                            }}
                                        >
                                            {avatar2 ? (
                                                <img
                                                    src={avatar2}
                                                    alt={pair.team2}
                                                    style={{
                                                        height: '100%',
                                                        objectFit: 'cover',
                                                        borderRadius: '50%'
                                                    }}
                                                />
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
                            <div className={classes.formGroup} style={{ position: 'relative', zIndex: 2 }}>
                                <label style={{ textAlign: 'center', display: 'block' }}>Gold:</label>
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '2rem',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        marginBottom: '1rem'
                                    }}
                                >
                                    <div style={{ textAlign: 'center' }}>
                                        <input
                                            type="number"
                                            step="100"
                                            value={gold1}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value) || 0;
                                                setGold1(value);
                                                setGold2(-value);
                                            }}
                                            style={{
                                                width: '120px',
                                                padding: '0.5rem',
                                                fontSize: '16px',
                                                textAlign: 'center',
                                                border: '3px solid #FFD700',
                                                borderRadius: '8px',
                                                background:
                                                    'linear-gradient(135deg, rgba(62, 32, 192, 1), rgba(45, 20, 150, 1))',
                                                color: gold1 > 0 ? '#00FF00' : gold1 < 0 ? '#FF0000' : '#FFD700',
                                                fontWeight: 'bold',
                                                boxShadow:
                                                    '0 2px 8px rgba(62, 32, 192, 0.3), inset 0 1px 2px rgba(255, 215, 0, 0.1)'
                                            }}
                                        />
                                    </div>
                                    <img
                                        src={goldImg}
                                        alt="Gold"
                                        style={{
                                            width: '45px',
                                            height: '35px',
                                            objectFit: 'contain',
                                            filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4))'
                                        }}
                                    />
                                    <div style={{ color: '#FFD700', fontSize: '24px', fontWeight: 'bold' }}>⚔️</div>
                                    <img
                                        src={goldImg}
                                        alt="Gold"
                                        style={{
                                            width: '45px',
                                            height: '35px',
                                            objectFit: 'contain',
                                            filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4))'
                                        }}
                                    />
                                    <div style={{ textAlign: 'center' }}>
                                        {/* <div style={{ marginBottom: '0.5rem', color: '#00ffff', fontSize: '14px' }}>
                                            {pair.team2}
                                        </div> */}
                                        <input
                                            type="number"
                                            value={gold2}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value) || 0;
                                                setGold2(value);
                                                setGold1(-value);
                                            }}
                                            style={{
                                                width: '120px',
                                                padding: '0.5rem',
                                                fontSize: '16px',
                                                textAlign: 'center',
                                                border: '3px solid #FFD700',
                                                borderRadius: '8px',
                                                background:
                                                    'linear-gradient(135deg, rgba(62, 32, 192, 1), rgba(45, 20, 150, 1))',
                                                color: gold2 > 0 ? '#00FF00' : gold2 < 0 ? '#FF0000' : '#FFD700',
                                                fontWeight: 'bold',
                                                boxShadow:
                                                    '0 2px 8px rgba(62, 32, 192, 0.3), inset 0 1px 2px rgba(255, 215, 0, 0.1)'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Restarts Input for BO-1 */}
                            <div className={classes.formGroup} style={{ position: 'relative', zIndex: 2 }}>
                                <label style={{ textAlign: 'center', display: 'block' }}>Restarts:</label>
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '2rem',
                                        justifyContent: 'center',
                                        marginBottom: '1rem'
                                    }}
                                >
                                    <div style={{ textAlign: 'center' }}>
                                        {/* <div style={{ marginBottom: '0.5rem', color: '#00ffff', fontSize: '14px' }}>
                                            {pair.team1}
                                        </div> */}
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            {/* 111 Restart Boxes */}
                                            {[0, 1].map((boxIdx) => {
                                                const isUsed = restart1_111 > boxIdx;
                                                const isDisabled = restart1_112 > 0;
                                                return (
                                                    <div
                                                        key={`111-${boxIdx}`}
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
                                                        style={{
                                                            position: 'relative',
                                                            width: '50px',
                                                            height: '50px',
                                                            border: '2px solid #FFD700',
                                                            borderRadius: '4px',
                                                            background: isDisabled
                                                                ? 'rgba(0, 0, 0, 0.5)'
                                                                : isUsed
                                                                  ? 'linear-gradient(135deg, rgba(62, 32, 192, 1), rgba(45, 20, 150, 1))'
                                                                  : 'rgba(0, 0, 0, 0.3)',
                                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            opacity: isDisabled ? 0.4 : isUsed ? 1 : 0.6,
                                                            boxShadow: isUsed
                                                                ? '0 0 10px rgba(255, 215, 0, 0.6)'
                                                                : 'none'
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                color: '#FFD700',
                                                                fontSize: '14px',
                                                                fontWeight: 'bold'
                                                            }}
                                                        >
                                                            111
                                                        </div>
                                                        {(isUsed || isDisabled) && (
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '50%',
                                                                    left: '50%',
                                                                    transform: 'translate(-50%, -50%)',
                                                                    color: '#FF0000',
                                                                    fontSize: '40px',
                                                                    fontWeight: 'bold',
                                                                    lineHeight: '1',
                                                                    textShadow: '0 0 4px #000'
                                                                }}
                                                            >
                                                                ✕
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {/* 112 Restart Box */}
                                            <div
                                                onClick={() => {
                                                    if (restart1_111 > 0) {
                                                        return;
                                                    }
                                                    setRestart1_112(restart1_112 === 1 ? 0 : 1);
                                                }}
                                                style={{
                                                    position: 'relative',
                                                    width: '50px',
                                                    height: '50px',
                                                    border: '2px solid #FFD700',
                                                    borderRadius: '4px',
                                                    background:
                                                        restart1_111 > 0
                                                            ? 'rgba(0, 0, 0, 0.5)'
                                                            : restart1_112 === 1
                                                              ? 'linear-gradient(135deg, rgba(62, 32, 192, 1), rgba(45, 20, 150, 1))'
                                                              : 'rgba(0, 0, 0, 0.3)',
                                                    cursor: restart1_111 > 0 ? 'not-allowed' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    opacity: restart1_111 > 0 ? 0.4 : restart1_112 === 1 ? 1 : 0.6,
                                                    boxShadow:
                                                        restart1_112 === 1 ? '0 0 10px rgba(255, 215, 0, 0.6)' : 'none',
                                                    pointerEvents: restart1_111 > 0 ? 'none' : 'auto'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        color: '#FFD700',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    112
                                                </div>
                                                {(restart1_112 === 1 || restart1_111 > 0) && (
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            left: '50%',
                                                            transform: 'translate(-50%, -50%)',
                                                            color: '#FF0000',
                                                            fontSize: '40px',
                                                            fontWeight: 'bold',
                                                            lineHeight: '1',
                                                            textShadow: '0 0 4px #000'
                                                        }}
                                                    >
                                                        ✕
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        {/* <div style={{ marginBottom: '0.5rem', color: '#00ffff', fontSize: '14px' }}>
                                            {pair.team2}
                                        </div> */}
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            {/* 111 Restart Boxes */}
                                            {[0, 1].map((boxIdx) => {
                                                const isUsed = restart2_111 > boxIdx;
                                                const isDisabled = restart2_112 > 0;
                                                return (
                                                    <div
                                                        key={`111-${boxIdx}`}
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
                                                        style={{
                                                            position: 'relative',
                                                            width: '50px',
                                                            height: '50px',
                                                            border: '2px solid #FFD700',
                                                            borderRadius: '4px',
                                                            background: isDisabled
                                                                ? 'rgba(0, 0, 0, 0.5)'
                                                                : isUsed
                                                                  ? 'linear-gradient(135deg, rgba(62, 32, 192, 1), rgba(45, 20, 150, 1))'
                                                                  : 'rgba(0, 0, 0, 0.3)',
                                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            opacity: isDisabled ? 0.4 : isUsed ? 1 : 0.6,
                                                            boxShadow: isUsed
                                                                ? '0 0 10px rgba(255, 215, 0, 0.6)'
                                                                : 'none'
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                color: '#FFD700',
                                                                fontSize: '14px',
                                                                fontWeight: 'bold'
                                                            }}
                                                        >
                                                            111
                                                        </div>
                                                        {isUsed && (
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '50%',
                                                                    left: '50%',
                                                                    transform: 'translate(-50%, -50%)',
                                                                    color: '#FF0000',
                                                                    fontSize: '40px',
                                                                    fontWeight: 'bold',
                                                                    lineHeight: '1',
                                                                    textShadow: '0 0 4px #000'
                                                                }}
                                                            >
                                                                ✕
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {/* 112 Restart Box */}
                                            <div
                                                onClick={() => {
                                                    if (restart2_111 > 0) {
                                                        return;
                                                    }
                                                    setRestart2_112(restart2_112 === 1 ? 0 : 1);
                                                }}
                                                style={{
                                                    position: 'relative',
                                                    width: '50px',
                                                    height: '50px',
                                                    border: '2px solid #FFD700',
                                                    borderRadius: '4px',
                                                    background:
                                                        restart2_111 > 0
                                                            ? 'rgba(0, 0, 0, 0.5)'
                                                            : restart2_112 === 1
                                                              ? 'linear-gradient(135deg, rgba(62, 32, 192, 1), rgba(45, 20, 150, 1))'
                                                              : 'rgba(0, 0, 0, 0.3)',
                                                    cursor: restart2_111 > 0 ? 'not-allowed' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    opacity: restart2_111 > 0 ? 0.4 : restart2_112 === 1 ? 1 : 0.6,
                                                    boxShadow:
                                                        restart2_112 === 1 ? '0 0 10px rgba(255, 215, 0, 0.6)' : 'none',
                                                    pointerEvents: restart2_111 > 0 ? 'none' : 'auto'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        color: '#FFD700',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    112
                                                </div>
                                                {(restart2_112 === 1 || restart2_111 > 0) && (
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            left: '50%',
                                                            transform: 'translate(-50%, -50%)',
                                                            color: '#FF0000',
                                                            fontSize: '40px',
                                                            fontWeight: 'bold',
                                                            lineHeight: '1',
                                                            textShadow: '0 0 4px #000'
                                                        }}
                                                    >
                                                        ✕
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={classes.formGroup} style={{ position: 'relative', zIndex: 2 }}>
                                <label style={{ textAlign: 'center', display: 'block' }}>Castles:</label>
                                <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        {/* <div
                                            style={{
                                                marginBottom: '0.5rem',
                                                color: '#00ffff',
                                                fontSize: '14px',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            {pair.team1}
                                        </div> */}
                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, 1fr)',
                                                gap: '0.5rem',
                                                maxWidth: '400px',
                                                justifyItems: 'center'
                                            }}
                                        >
                                            {castles.map((c) => {
                                                const isGameFinished = pair.winner;
                                                const isBanned = bannedCastlesBO1_1.includes(c);
                                                const isSelected = castle1 === c;
                                                const handleBO1C1Toggle = () => {
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
                                                };
                                                return (
                                                    <div
                                                        key={c}
                                                        style={{
                                                            position: 'relative',
                                                            width: '105px',
                                                            height: '70px',
                                                            cursor: isGameFinished ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onClick={handleBO1C1Toggle}
                                                    >
                                                        <img
                                                            src={getCastleImageUrl(c)}
                                                            alt={c}
                                                            title={c}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleBO1C1Toggle();
                                                            }}
                                                            style={{
                                                                width: '105px',
                                                                height: '70px',
                                                                border: `3px solid ${getCastleBorderColor(c)}`,
                                                                borderRadius: '4px',
                                                                objectFit: 'cover',
                                                                opacity: castle1
                                                                    ? isSelected
                                                                        ? 1
                                                                        : 0.3
                                                                    : getCastleBorderColor(c) === '#f87171'
                                                                      ? 0.4
                                                                      : 1,
                                                                filter:
                                                                    castle1 && !isSelected ? 'grayscale(70%)' : 'none',
                                                                transform: 'scale(1)',
                                                                transition: 'all 0.2s ease',
                                                                boxShadow: `0 0 8px ${getCastleBorderColor(c)}80`
                                                            }}
                                                        />
                                                        {/* Indicator Overlay */}
                                                        {(isSelected || isBanned) && (
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '-8px',
                                                                    right: '-8px',
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: isSelected ? '#00CC00' : '#FF3333',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '20px',
                                                                    fontWeight: 'bold',
                                                                    color: 'white',
                                                                    boxShadow: `0 3px 8px rgba(${isSelected ? '0, 204, 0' : '255, 51, 51'}, 0.6)`,
                                                                    border: '2px solid white'
                                                                }}
                                                            >
                                                                {isSelected ? '✓' : '✕'}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        {/* <div
                                            style={{
                                                marginBottom: '0.5rem',
                                                color: '#00ffff',
                                                fontSize: '14px',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            {pair.team2}
                                        </div> */}
                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, 1fr)',
                                                gap: '0.5rem',
                                                maxWidth: '400px',
                                                justifyItems: 'center'
                                            }}
                                        >
                                            {castles.map((c) => {
                                                const isGameFinished = pair.winner;
                                                const isBanned = bannedCastlesBO1_2.includes(c);
                                                const isSelected = castle2 === c;
                                                const handleBO1C2Toggle = () => {
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
                                                };
                                                return (
                                                    <div
                                                        key={c}
                                                        style={{
                                                            position: 'relative',
                                                            width: '105px',
                                                            height: '70px',
                                                            cursor: isGameFinished ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onClick={handleBO1C2Toggle}
                                                    >
                                                        <img
                                                            src={getCastleImageUrl(c)}
                                                            alt={c}
                                                            title={c}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleBO1C2Toggle();
                                                            }}
                                                            style={{
                                                                width: '105px',
                                                                height: '70px',
                                                                border: `3px solid ${getCastleBorderColor(c)}`,
                                                                borderRadius: '4px',
                                                                objectFit: 'cover',
                                                                opacity: castle2
                                                                    ? isSelected
                                                                        ? 1
                                                                        : 0.3
                                                                    : getCastleBorderColor(c) === '#f87171'
                                                                      ? 0.4
                                                                      : 1,
                                                                filter:
                                                                    castle2 && !isSelected ? 'grayscale(70%)' : 'none',
                                                                transform: 'scale(1)',
                                                                transition: 'all 0.2s ease',
                                                                boxShadow: `0 0 8px ${getCastleBorderColor(c)}80`
                                                            }}
                                                        />
                                                        {/* Indicator Overlay */}
                                                        {(isSelected || isBanned) && (
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '-8px',
                                                                    right: '-8px',
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: isSelected ? '#00CC00' : '#FF3333',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '20px',
                                                                    fontWeight: 'bold',
                                                                    color: 'white',
                                                                    boxShadow: `0 3px 8px rgba(${isSelected ? '0, 204, 0' : '255, 51, 51'}, 0.6)`,
                                                                    border: '2px solid white'
                                                                }}
                                                            >
                                                                {isSelected ? '✓' : '✕'}
                                                            </div>
                                                        )}
                                                    </div>
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
                        <div className={classes.restartConfirmationRow}>
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

                    <div className={classes.buttonGroup} style={{ position: 'relative', zIndex: 2 }}>
                        <button type="submit" className={classes.submitButton}>
                            Submit Result
                        </button>
                        <button type="button" onClick={onClose} className={classes.cancelButton}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default ReportGameModal;
