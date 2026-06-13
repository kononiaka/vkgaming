import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import StarsComponent from '../Stars/Stars';
import classes from './SpinningWheel.module.css';
import { fetchLeaderboard, getAvatar, lookForUserId } from '../../api/api';
import { deriveHotaPlayerSummary, fetchHotaPlayerByLobbyNickname } from '../../api/hotaMeta';
import {
    CHAMPIONS_LEAGUE_GROUP_SIZE,
    buildGroupTablesFromDrawGrid,
    countFilledDrawGridSlots,
    createEmptyGroupDrawGrid,
    getSnakeDrawSlotLabel,
    isGroupDrawGridComplete,
    mapSnakeDrawIndexToSlot
} from '../tournaments/homm3/championsLeagueUtils';

const WHEEL_SIZE = 380;
const WHEEL_CENTER = WHEEL_SIZE / 2;

const getSliceColor = (index) => (index % 2 === 0 ? '#1a222e' : '#222c3a');

const getSliceFontSize = (totalPlayers) => {
    if (totalPlayers > 16) {
        return 11;
    }
    if (totalPlayers > 10) {
        return 13;
    }
    if (totalPlayers > 6) {
        return 15;
    }
    return 17;
};

const getNextSlotLabel = (slotIndex, pairs, isChampionsLeagueDraw, groupCount) => {
    if (isChampionsLeagueDraw) {
        if (!groupCount) {
            return 'Fill the group tables';
        }
        return `Next: ${getSnakeDrawSlotLabel(slotIndex, groupCount)}`;
    }

    const totalPairs = pairs.length;
    if (totalPairs === 0) {
        return 'Fill the draw table';
    }

    if (slotIndex < totalPairs) {
        return `Next: Match ${slotIndex + 1}, first player`;
    }

    const matchIndex = slotIndex - totalPairs;
    return `Next: Match ${matchIndex + 1}, second player`;
};

const buildKickoffPairPlacement = (pairs, slotIndex, playerName) => {
    const updatedPairs = pairs.map((pair) => [...pair]);
    const totalPairs = updatedPairs.length;

    if (slotIndex < totalPairs) {
        if (updatedPairs[slotIndex][0] === 'TBD') {
            updatedPairs[slotIndex][0] = playerName;
        }
        return updatedPairs;
    }

    const opponentIndex = slotIndex - totalPairs;
    if (opponentIndex >= 0 && opponentIndex < updatedPairs.length) {
        if (updatedPairs[opponentIndex][1] === 'TBD') {
            updatedPairs[opponentIndex][1] = playerName;
        }
    }

    return updatedPairs;
};

const buildGroupDrawPlacement = (grid, slotIndex, playerName) => {
    const nextGrid = grid.map((group) => [...group]);
    const groupCount = nextGrid.length;
    const { groupIndex, seatIndex } = mapSnakeDrawIndexToSlot(slotIndex, groupCount);

    if (nextGrid[groupIndex]?.[seatIndex] === 'TBD') {
        nextGrid[groupIndex][seatIndex] = playerName;
    }

    return nextGrid;
};

const countFilledSlots = (pairs) =>
    pairs.reduce(
        (count, pair) => count + (pair[0] !== 'TBD' ? 1 : 0) + (pair[1] !== 'TBD' ? 1 : 0),
        0
    );

const DrawSeatPlayer = ({ seatLabel, playerData, waiting = false }) => {
    const [avatarUrl, setAvatarUrl] = useState(null);

    useEffect(() => {
        if (!playerData?.name) {
            setAvatarUrl(null);
            return undefined;
        }

        let cancelled = false;

        const loadAvatar = async () => {
            try {
                let userId = playerData.siteUserId || null;
                if (!userId) {
                    userId = await lookForUserId(playerData.name);
                }

                if (userId && !cancelled) {
                    const avatar = await getAvatar(userId);
                    if (!cancelled && avatar) {
                        setAvatarUrl(avatar);
                    }
                }
            } catch {
                // Avatar is optional.
            }
        };

        loadAvatar();

        return () => {
            cancelled = true;
        };
    }, [playerData?.name, playerData?.siteUserId]);

    if (waiting || !playerData?.name) {
        return (
            <div className={classes.groupSlot}>
                <span className={classes.groupSeatLabel}>{seatLabel}</span>
                <span className={`${classes.groupSlotWaiting} ${classes.playerNameTbd}`}>Waiting…</span>
            </div>
        );
    }

    const stars = Number(playerData.stars) || 0;

    return (
        <div className={`${classes.groupSlot} ${classes.playerInfoFilled}`}>
            <span className={classes.groupSeatLabel}>{seatLabel}</span>
            <div className={classes.groupSlotBody}>
                {avatarUrl ? (
                    <img src={avatarUrl} alt="" className={classes.groupSlotAvatar} />
                ) : (
                    <div className={classes.groupSlotAvatarFallback} aria-hidden="true">
                        {playerData.name.charAt(0).toUpperCase()}
                    </div>
                )}
                <span className={classes.groupSlotName}>{playerData.name}</span>
                {stars > 0 ? (
                    <span className={classes.groupSlotStars}>
                        <StarsComponent stars={stars} />
                    </span>
                ) : null}
            </div>
        </div>
    );
};

const SpinningWheel = ({ players, onStartTournament, mode = 'kickoff' }) => {
    const isChampionsLeagueDraw = mode === 'champions-league';
    const tableTitle = isChampionsLeagueDraw ? 'Group Tables' : 'Pre-Bracket Pairings';
    const startButtonLabel = isChampionsLeagueDraw ? 'Start group stage' : 'Start tournament';
    const drawTitle = isChampionsLeagueDraw ? 'Group stage draw' : 'Random bracket draw';
    const drawSubtitle = isChampionsLeagueDraw
        ? 'Players are placed round-robin across tables: Table A seat 1, then Table B seat 1, then Table A seat 2, and so on.'
        : 'Spin the wheel to randomly assign players into opening bracket matches.';
    const [remainingPlayers, setRemainingPlayers] = useState([]);
    const [preBracketPairs, setPreBracketPairs] = useState([]);
    const [groupDrawGrid, setGroupDrawGrid] = useState([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [spinDuration, setSpinDuration] = useState(5); // Default spin duration (in seconds)
    const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const canvasRef = useRef(null);
    const [fadingSlice, setFadingSlice] = useState(null);
    const [fadingOpacity, setFadingOpacity] = useState(1);
    const [particles, setParticles] = useState([]);
    const [pairDetails, setPairDetails] = useState({});
    const [resultAvatarUrl, setResultAvatarUrl] = useState(null);
    const [resultEloDisplay, setResultEloDisplay] = useState(null);

    const groupCount = groupDrawGrid.length;
    const totalDrawSlots = isChampionsLeagueDraw
        ? groupCount * CHAMPIONS_LEAGUE_GROUP_SIZE
        : preBracketPairs.length * 2;
    const filledDrawSlots = useMemo(
        () =>
            isChampionsLeagueDraw
                ? countFilledDrawGridSlots(groupDrawGrid)
                : countFilledSlots(preBracketPairs),
        [isChampionsLeagueDraw, groupDrawGrid, preBracketPairs]
    );
    const drawProgress = totalDrawSlots > 0 ? Math.round((filledDrawSlots / totalDrawSlots) * 100) : 0;
    const nextSlotLabel = getNextSlotLabel(
        currentSlotIndex,
        preBracketPairs,
        isChampionsLeagueDraw,
        groupCount
    );
    const groupTables = useMemo(
        () => (isChampionsLeagueDraw ? buildGroupTablesFromDrawGrid(groupDrawGrid) : []),
        [isChampionsLeagueDraw, groupDrawGrid]
    );
    const selectedPlayerData = selectedPlayer
        ? Object.values(players).find((player) => player.name === selectedPlayer)
        : null;

    useEffect(() => {
        if (!selectedPlayer) {
            setResultAvatarUrl(null);
            setResultEloDisplay(null);
            return undefined;
        }

        let cancelled = false;
        const konoplayRating =
            selectedPlayerData?.ratings != null && selectedPlayerData.ratings !== ''
                ? String(selectedPlayerData.ratings)
                : null;

        const setKonoplayFallback = () => {
            if (konoplayRating && !cancelled) {
                setResultEloDisplay({ value: konoplayRating, label: 'ELO' });
            }
        };

        const loadResultProfile = async () => {
            setResultAvatarUrl(null);
            setResultEloDisplay(null);

            try {
                const hotaResult = await fetchHotaPlayerByLobbyNickname(selectedPlayer);
                if (cancelled) {
                    return;
                }

                if (hotaResult.status === 'ok') {
                    const summary = deriveHotaPlayerSummary(hotaResult.profile);
                    if (summary?.rating != null && Number.isFinite(Number(summary.rating))) {
                        setResultEloDisplay({
                            value: Number(summary.rating).toFixed(0),
                            label: 'HotA ELO'
                        });
                    } else {
                        setKonoplayFallback();
                    }
                } else {
                    setKonoplayFallback();
                }
            } catch {
                if (!cancelled) {
                    setKonoplayFallback();
                }
            }

            try {
                let userId = selectedPlayerData?.siteUserId || null;
                if (!userId) {
                    userId = await lookForUserId(selectedPlayer);
                }

                if (userId && !cancelled) {
                    const avatar = await getAvatar(userId);
                    if (!cancelled && avatar) {
                        setResultAvatarUrl(avatar);
                    }
                }
            } catch {
                // Avatar is optional.
            }
        };

        loadResultProfile();

        return () => {
            cancelled = true;
        };
    }, [selectedPlayer, selectedPlayerData]);

    // Initialize remaining players and draw structures
    useEffect(() => {
        const playerNames = Object.values(players).map((player) => player.name);

        setRemainingPlayers(playerNames);
        setCurrentSlotIndex(0);

        if (isChampionsLeagueDraw) {
            setGroupDrawGrid(createEmptyGroupDrawGrid(playerNames.length));
            setPreBracketPairs([]);
        } else {
            setGroupDrawGrid([]);
            setPreBracketPairs(Array.from({ length: playerNames.length / 2 }, () => ['TBD', 'TBD']));
        }
    }, [players, isChampionsLeagueDraw]);

    // Fetch head-to-head history between two players
    const fetchHeadToHead = async (player1, player2) => {
        if (player1 === 'TBD' || player2 === 'TBD') {
            return null;
        }
        try {
            const response = await fetch(`${FIREBASE_DATABASE_URL}/games/heroes3.json`);
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            if (!data) {
                return null;
            }

            const games = Object.values(data).filter(
                (game) =>
                    (game.opponent1 === player1 && game.opponent2 === player2) ||
                    (game.opponent1 === player2 && game.opponent2 === player1)
            );

            const total = games.length;
            const player1Wins = games.filter((g) => g.winner === player1).length;
            const player2Wins = games.filter((g) => g.winner === player2).length;

            return { total, player1Wins, player2Wins };
        } catch (error) {
            console.error('Error fetching head-to-head:', error);
            return null;
        }
    };

    // Update pair details when pre-bracket pairs changes (kick-off only)
    useEffect(() => {
        if (isChampionsLeagueDraw) {
            setPairDetails({});
            return;
        }

        const updatePairDetails = async () => {
            const details = {};
            for (let i = 0; i < preBracketPairs.length; i++) {
                const [player1, player2] = preBracketPairs[i];
                if (player1 !== 'TBD' && player2 !== 'TBD') {
                    const player1Data = Object.values(players).find((p) => p.name === player1);
                    const player2Data = Object.values(players).find((p) => p.name === player2);
                    const [history, player1Place, player2Place] = await Promise.all([
                        fetchHeadToHead(player1, player2),
                        fetchLeaderboard({ enteredNickname: player1 }),
                        fetchLeaderboard({ enteredNickname: player2 })
                    ]);
                    details[i] = {
                        player1Stars: player1Data?.stars || 0,
                        player2Stars: player2Data?.stars || 0,
                        player1Place: player1Place || null,
                        player2Place: player2Place || null,
                        history
                    };
                }
            }
            setPairDetails(details);
        };
        updatePairDetails();
    }, [preBracketPairs, players, isChampionsLeagueDraw]);

    // Draw the wheel on the canvas
    const drawWheel = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return; // Exit if canvas is not rendered (hidden)
        }
        const ctx = canvas.getContext('2d');
        const totalPlayers = remainingPlayers.length;
        if (totalPlayers === 0) {
            return; // Exit if there are no players
        }
        const sliceAngle = 360 / totalPlayers;
        const centerX = WHEEL_CENTER;
        const centerY = WHEEL_CENTER;
        const radius = WHEEL_CENTER;
        const fontSize = getSliceFontSize(totalPlayers);

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw each segment

        remainingPlayers.forEach((player, index) => {
            const startAngle = index * sliceAngle * (Math.PI / 180); // Convert degrees to radians
            const endAngle = (index + 1) * sliceAngle * (Math.PI / 180); // Convert degrees to radians

            // Set the opacity for the fading slice
            if (player === fadingSlice) {
                ctx.globalAlpha = fadingOpacity; // Apply fading opacity
            } else {
                ctx.globalAlpha = 1; // Full opacity for other slices
            }

            // Draw the segment
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = getSliceColor(index);
            ctx.fill();
            ctx.strokeStyle = 'rgba(201, 162, 39, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Add text to the segment
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + (sliceAngle / 2) * (Math.PI / 180));
            ctx.fillStyle = '#e8ecf1';
            ctx.font = `600 ${fontSize}px var(--font-body), sans-serif`;
            ctx.textAlign = 'right';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            const label = player.length > 14 ? `${player.slice(0, 13)}…` : player;
            ctx.fillText(label, radius - 16, fontSize * 0.35);
            ctx.restore();
        });

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.11, 0, Math.PI * 2);
        ctx.fillStyle = '#141a24';
        ctx.fill();
        ctx.strokeStyle = 'rgba(201, 162, 39, 0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Reset global alpha
        ctx.globalAlpha = 1;

        // Draw particles
        particles.forEach((particle) => {
            ctx.globalAlpha = particle.opacity;
            ctx.fillStyle = particle.color;
            ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
        });
        ctx.globalAlpha = 1;
    };

    const handleModalYes = () => {
        setFadingSlice(selectedPlayer); // Set the slice to break
        setIsModalVisible(false); // Hide the modal immediately

        // Create particles from the selected slice
        const selectedIndex = remainingPlayers.indexOf(selectedPlayer);
        const totalPlayers = remainingPlayers.length;
        const sliceAngle = (360 / totalPlayers) * (Math.PI / 180);
        const startAngle = selectedIndex * sliceAngle;
        const centerX = WHEEL_CENTER;
        const centerY = WHEEL_CENTER;
        const radius = WHEEL_CENTER;

        // Generate particles
        const newParticles = [];
        const particleCount = 300; // Number of particles

        for (let i = 0; i < particleCount; i++) {
            const angle = startAngle + Math.random() * sliceAngle;
            const distance = Math.random() * radius * 0.8 + radius * 0.2;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;

            newParticles.push({
                x,
                y,
                vx: Math.cos(angle) * (2 + Math.random() * 3),
                vy: Math.sin(angle) * (2 + Math.random() * 3),
                size: 3 + Math.random() * 5,
                opacity: 1,
                color: getSliceColor(selectedIndex)
            });
        }
        setParticles(newParticles);

        // Animate particles
        const animateParticles = () => {
            setParticles((prevParticles) => {
                const updatedParticles = prevParticles
                    .map((p) => ({
                        ...p,
                        x: p.x + p.vx,
                        y: p.y + p.vy,
                        vx: p.vx * 0.98, // Slow down
                        vy: p.vy * 0.98,
                        opacity: p.opacity - 0.02
                    }))
                    .filter((p) => p.opacity > 0);

                if (updatedParticles.length > 0) {
                    requestAnimationFrame(animateParticles);
                } else {
                    // Remove the selected player
                    setRemainingPlayers((prevPlayers) => {
                        const updatedPlayers = prevPlayers.filter((player) => player !== selectedPlayer);
                        console.log('Updated Remaining Players:', updatedPlayers); // Log all remaining players
                        return updatedPlayers;
                    });

                    // Place the selected player into the draw
                    if (isChampionsLeagueDraw) {
                        setGroupDrawGrid((prevGrid) =>
                            buildGroupDrawPlacement(prevGrid, currentSlotIndex, selectedPlayer)
                        );
                    } else {
                        setPreBracketPairs((prevPairs) =>
                            buildKickoffPairPlacement(prevPairs, currentSlotIndex, selectedPlayer)
                        );
                    }

                    setCurrentSlotIndex((prevIndex) => prevIndex + 1);

                    // Handle the last player logic after 1 second
                    setTimeout(() => {
                        setRemainingPlayers((prevPlayers) => {
                            if (prevPlayers.length === 1) {
                                const lastPlayer = prevPlayers[0];
                                const updatedSlotIndex = currentSlotIndex + 1;

                                if (isChampionsLeagueDraw) {
                                    setGroupDrawGrid((prevGrid) =>
                                        buildGroupDrawPlacement(prevGrid, updatedSlotIndex, lastPlayer)
                                    );
                                } else {
                                    setPreBracketPairs((prevPairs) =>
                                        buildKickoffPairPlacement(prevPairs, updatedSlotIndex, lastPlayer)
                                    );
                                }

                                setCurrentSlotIndex(updatedSlotIndex + 1);
                                setRemainingPlayers([]);
                            }

                            return prevPlayers;
                        });
                    }, 1000);

                    // All particles faded, clean up
                    setIsSpinning(false);
                    setFadingSlice(null);
                    setParticles([]);
                }

                return updatedParticles;
            });
        };
        animateParticles();
    };

    const handleModalNo = () => {
        // Handle "No" action
        setIsModalVisible(false); // Hide the modal
        setIsSpinning(false);
        console.log('User canceled the action.');
    };

    // Spin the wheel
    const spinWheel = () => {
        if (isSpinning || remainingPlayers.length === 0) {
            console.log('Spin attempt blocked: Either the wheel is already spinning or no players remain.');
            return;
        }

        setIsSpinning(true);

        const totalPlayers = remainingPlayers.length;

        if (totalPlayers === 0) {
            console.error('No players remaining to spin.');
            setIsSpinning(false);
            return;
        }

        const sliceAngle = 360 / totalPlayers;

        // Calculate the stop angle
        const selectedIndex = Math.floor(Math.random() * totalPlayers);
        const selected = remainingPlayers[selectedIndex];

        // Calculate the stop angle to land on the selected player
        const stopAngle = 360 - selectedIndex * sliceAngle - sliceAngle / 2;

        // Generate a random offset within the slice
        const randomOffset = (Math.random() - 0.5) * sliceAngle; // Random value between -sliceAngle/2 and +sliceAngle/2

        // Add pointer offset
        const pointerOffset = 270;
        const adjustedStopAngle = (stopAngle + pointerOffset + randomOffset) % 360;

        // Calculate the total rotation angle based on the spin duration
        const fullSpins = Math.floor(spinDuration) * 360; // 1 full spin per second
        const totalRotation = fullSpins + adjustedStopAngle;

        // Total rotation angle
        const rotationAngle = fullSpins + adjustedStopAngle;

        // Apply the rotation to the wheel
        const wheel = document.querySelector(`.${classes.spinningWheelCanvas}`);
        if (!wheel) {
            console.error('Wheel element not found.');
            setIsSpinning(false);
            return;
        }

        // Reset the wheel's transition and transform properties
        wheel.style.transition = 'none';
        wheel.style.transform = `rotate(0deg)`;
        void wheel.offsetWidth; // Force a reflow to apply the reset

        wheel.style.transition = `transform ${spinDuration}s cubic-bezier(0.25, 0.1, 0.25, 1)`;
        wheel.style.transform = `rotate(${totalRotation}deg)`;

        // Stop the wheel after the animation
        setTimeout(() => {
            // Calculate the player's range for clarity
            const playerStartAngle = Math.floor(selectedIndex * sliceAngle);
            const playerEndAngle = Math.floor((selectedIndex + 1) * sliceAngle - 1);
            const playerRange = `${playerStartAngle}° - ${playerEndAngle}°`;

            setTimeout(() => {
                setModalMessage(`Place ${selected} — ${nextSlotLabel.replace('Next: ', '')}?`);
                setSelectedPlayer(selected);
                setIsModalVisible(true);

                setIsSpinning(false);
            }, 1000);
        }, spinDuration * 1000); // Match the spin duration
    };

    // Redraw the wheel whenever the remaining players, fading state, or particles change
    useEffect(() => {
        drawWheel();
    }, [remainingPlayers, fadingOpacity, fadingSlice, particles]);

    // Automatically add the last remaining player to the draw
    useEffect(() => {
        if (remainingPlayers.length === 1 && !isSpinning) {
            const lastPlayer = remainingPlayers[0];

            setTimeout(() => {
                if (isChampionsLeagueDraw) {
                    setGroupDrawGrid((prevGrid) =>
                        buildGroupDrawPlacement(prevGrid, currentSlotIndex, lastPlayer)
                    );
                } else {
                    setPreBracketPairs((prevPairs) =>
                        buildKickoffPairPlacement(prevPairs, currentSlotIndex, lastPlayer)
                    );
                }

                setCurrentSlotIndex((prevIndex) => prevIndex + 1);
                setRemainingPlayers([]);
            }, 500);
        }
    }, [remainingPlayers, isSpinning, currentSlotIndex, isChampionsLeagueDraw]);

    const isBracketComplete = isChampionsLeagueDraw
        ? isGroupDrawGridComplete(groupDrawGrid)
        : preBracketPairs.every((pair) => pair[0] !== 'TBD' && pair[1] !== 'TBD');

    return (
        <div className={classes.spinningWheelContainer}>
            <header className={classes.header}>
                <p className={classes.eyebrow}>{isChampionsLeagueDraw ? 'Champions League' : 'Tournament draw'}</p>
                <h1 className={classes.title}>{drawTitle}</h1>
                <p className={classes.subtitle}>{drawSubtitle}</p>

                <div className={classes.progressBlock}>
                    <div className={classes.progressMeta}>
                        <span>
                            <strong>{filledDrawSlots}</strong> of <strong>{totalDrawSlots}</strong> slots filled
                        </span>
                        <span>{remainingPlayers.length} players left on wheel</span>
                    </div>
                    <div className={classes.progressTrack}>
                        <div className={classes.progressFill} style={{ width: `${drawProgress}%` }} />
                    </div>
                </div>
            </header>

            <div
                className={`${classes.mainLayout} ${
                    remainingPlayers.length === 0 ? classes.mainLayoutSingle : ''
                }`}
            >
                {remainingPlayers.length > 0 && (
                    <div className={classes.wheelSection}>
                        <div className={classes.wheelFrame}>
                            <div className={classes.pointer} aria-hidden="true" />
                            <canvas
                                ref={canvasRef}
                                width={WHEEL_SIZE}
                                height={WHEEL_SIZE}
                                className={`${classes.spinningWheelCanvas} ${isSpinning ? classes.spinning : ''}`}
                            />
                        </div>

                        <div className={classes.controls}>
                            <button
                                type="button"
                                onClick={spinWheel}
                                disabled={isSpinning}
                                className={classes.spinButton}
                            >
                                {isSpinning
                                    ? 'Spinning…'
                                    : `Spin wheel (${remainingPlayers.length} left)`}
                            </button>

                            <div className={classes.durationControl}>
                                <div className={classes.durationLabelRow}>
                                    <label htmlFor="spin-duration">Spin speed</label>
                                    <span className={classes.durationValue}>{spinDuration}s</span>
                                </div>
                                <input
                                    id="spin-duration"
                                    type="range"
                                    min="2"
                                    max="10"
                                    step="1"
                                    value={spinDuration}
                                    disabled={isSpinning}
                                    onChange={(event) => setSpinDuration(Number(event.target.value))}
                                    className={classes.durationSlider}
                                />
                            </div>

                            <div className={classes.hintCard}>
                                <strong>{nextSlotLabel}</strong>
                                <div>Confirm each result to place the player, or spin again if you want a reroll.</div>
                            </div>

                            {selectedPlayer && (
                                <div className={classes.selectedPlayerDisplay}>
                                    <h3>Last spin</h3>
                                    <div className={classes.selectedPlayerInfo}>
                                        <span className={classes.selectedPlayerName}>{selectedPlayer}</span>
                                        {selectedPlayerData?.stars ? (
                                            <StarsComponent stars={selectedPlayerData.stars} />
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div
                    className={`${classes.preBracketTable} ${
                        remainingPlayers.length === 0 ? classes.preBracketTableExpanded : ''
                    }`}
                >
                    <div className={classes.tableHeader}>
                        <h2>{tableTitle}</h2>
                        <span className={classes.tableCount}>
                            {isChampionsLeagueDraw
                                ? `${groupTables.length} tables · ${CHAMPIONS_LEAGUE_GROUP_SIZE} players each`
                                : `${preBracketPairs.length} matches`}
                        </span>
                    </div>

                    <div className={classes.pairList}>
                        {isChampionsLeagueDraw
                            ? groupTables.map((group) => (
                                  <div
                                      key={group.label}
                                      className={`${classes.groupTable} ${
                                          group.isComplete ? classes.groupTableComplete : ''
                                      }`}
                                  >
                                      <div className={classes.matchLabel}>Table {group.label}</div>
                                      <div className={classes.groupTableGrid}>
                                          {group.slots.map((slot) => {
                                              const playerData = slot.filled
                                                  ? Object.values(players).find(
                                                        (player) => player.name === slot.name
                                                    )
                                                  : null;

                                              return (
                                                  <DrawSeatPlayer
                                                      key={`${group.label}-${slot.drawOrder}`}
                                                      seatLabel={`Seat ${slot.drawOrder}`}
                                                      playerData={playerData}
                                                      waiting={!slot.filled}
                                                  />
                                              );
                                          })}
                                      </div>
                                  </div>
                              ))
                            : preBracketPairs.map((pair, index) => {
                                  const details = pairDetails[index];
                                  const [player1, player2] = pair;
                                  const isPairComplete = player1 !== 'TBD' && player2 !== 'TBD';

                                  return (
                                      <div
                                          key={index}
                                          className={`${classes.bracketPair} ${
                                              isPairComplete ? classes.bracketPairComplete : ''
                                          }`}
                                      >
                                          <div className={classes.matchLabel}>Match {index + 1}</div>
                                          <div className={classes.pairContainer}>
                                              <div
                                                  className={`${classes.playerInfo} ${
                                                      player1 !== 'TBD' ? classes.playerInfoFilled : ''
                                                  }`}
                                              >
                                                  <span
                                                      className={`${classes.playerName} ${
                                                          player1 === 'TBD' ? classes.playerNameTbd : ''
                                                      }`}
                                                  >
                                                      {player1 === 'TBD' ? 'Waiting…' : player1}
                                                  </span>
                                                  {details?.player1Place != null && player1 !== 'TBD' && (
                                                      <span className={classes.leaderboardPlace}>
                                                          #{details.player1Place}
                                                      </span>
                                                  )}
                                                  {remainingPlayers.length === 0 &&
                                                      details?.player1Stars &&
                                                      player1 !== 'TBD' && (
                                                          <StarsComponent stars={details.player1Stars} />
                                                      )}
                                              </div>
                                              <span className={classes.vsText}>vs</span>
                                              <div
                                                  className={`${classes.playerInfo} ${
                                                      player2 !== 'TBD' ? classes.playerInfoFilled : ''
                                                  }`}
                                              >
                                                  <span
                                                      className={`${classes.playerName} ${
                                                          player2 === 'TBD' ? classes.playerNameTbd : ''
                                                      }`}
                                                  >
                                                      {player2 === 'TBD' ? 'Waiting…' : player2}
                                                  </span>
                                                  {details?.player2Place != null && player2 !== 'TBD' && (
                                                      <span className={classes.leaderboardPlace}>
                                                          #{details.player2Place}
                                                      </span>
                                                  )}
                                                  {remainingPlayers.length === 0 &&
                                                      details?.player2Stars &&
                                                      player2 !== 'TBD' && (
                                                          <StarsComponent stars={details.player2Stars} />
                                                      )}
                                              </div>
                                          </div>
                                          {remainingPlayers.length === 0 && details?.history && (
                                              <div className={classes.historyInfo}>
                                                  <span>
                                                      Head-to-head: {details.history.player1Wins} –{' '}
                                                      {details.history.player2Wins}
                                                  </span>
                                                  <span className={classes.totalGames}>
                                                      ({details.history.total} games)
                                                  </span>
                                              </div>
                                          )}
                                      </div>
                                  );
                              })}
                    </div>
                </div>
            </div>

            {isBracketComplete && (
                <div className={classes.footer}>
                    <button
                        type="button"
                        onClick={() =>
                            onStartTournament(isChampionsLeagueDraw ? groupDrawGrid : preBracketPairs)
                        }
                        className={classes.startTournamentButton}
                    >
                        {startButtonLabel}
                    </button>
                </div>
            )}

            {isModalVisible && (
                <div className={classes.confirmOverlay} role="presentation">
                    <div className={classes.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="wheel-result-title">
                        <span className={classes.confirmKicker}>Wheel result</span>
                        <div className={classes.confirmPlayerCard}>
                            {resultAvatarUrl ? (
                                <img src={resultAvatarUrl} alt="" className={classes.confirmAvatar} />
                            ) : (
                                <div className={classes.confirmAvatarFallback} aria-hidden="true">
                                    {selectedPlayer.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className={classes.confirmPlayerDetails}>
                                <h3 id="wheel-result-title" className={classes.confirmTitle}>
                                    {selectedPlayer}
                                </h3>
                                <div className={classes.confirmPlayerMeta}>
                                    {selectedPlayerData?.stars ? (
                                        <StarsComponent stars={selectedPlayerData.stars} />
                                    ) : null}
                                    {resultEloDisplay != null && (
                                        <span className={classes.confirmElo}>
                                            {resultEloDisplay.value} {resultEloDisplay.label}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <p className={classes.confirmMessage}>{modalMessage}</p>
                        <div className={classes.modalButtons}>
                            <button type="button" onClick={handleModalYes} className={classes.confirmAddBtn}>
                                {isChampionsLeagueDraw ? 'Add to table' : 'Add to bracket'}
                            </button>
                            <button type="button" onClick={handleModalNo} className={classes.confirmRetryBtn}>
                                Spin again
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpinningWheel;
