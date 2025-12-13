import React, { useState, useEffect, useRef } from 'react';
import StarsComponent from '../Stars/Stars';
import classes from './SpinningWheel.module.css';

const SpinningWheel = ({ players, onStartTournament }) => {
    const [remainingPlayers, setRemainingPlayers] = useState([]);
    const [preBracketPairs, setPreBracketPairs] = useState([]);
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

    // Initialize remaining players and pre-bracket pairs
    useEffect(() => {
        const playerNames = Object.values(players).map((player) => player.name);
        setRemainingPlayers(playerNames);
        const pairs = Array.from({ length: playerNames.length / 2 }, () => ['TBD', 'TBD']);
        setPreBracketPairs(pairs);
    }, [players]);

    // Fetch head-to-head history between two players
    const fetchHeadToHead = async (player1, player2) => {
        if (player1 === 'TBD' || player2 === 'TBD') return null;
        try {
            const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3.json');
            if (!response.ok) return null;
            const data = await response.json();
            if (!data) return null;

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

    // Update pair details when preBracketPairs changes
    useEffect(() => {
        const updatePairDetails = async () => {
            const details = {};
            for (let i = 0; i < preBracketPairs.length; i++) {
                const [player1, player2] = preBracketPairs[i];
                if (player1 !== 'TBD' && player2 !== 'TBD') {
                    const player1Data = Object.values(players).find((p) => p.name === player1);
                    const player2Data = Object.values(players).find((p) => p.name === player2);
                    const history = await fetchHeadToHead(player1, player2);
                    details[i] = {
                        player1Stars: player1Data?.stars || 0,
                        player2Stars: player2Data?.stars || 0,
                        history
                    };
                }
            }
            setPairDetails(details);
        };
        updatePairDetails();
    }, [preBracketPairs, players]);

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
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = canvas.width / 2;

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
            ctx.fillStyle = `hsl(${(index * 360) / totalPlayers}, 70%, 70%)`;
            ctx.fill();

            // Add text to the segment
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + (sliceAngle / 2) * (Math.PI / 180)); // Rotate to the middle of the slice
            // Draw the text with shadow
            ctx.fillStyle = 'white';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'right';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.fillText(`${player}`, radius - 20, 8);
            ctx.restore(); // Restore the canvas state
        });

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
        const centerX = 250; // Canvas center
        const centerY = 250;
        const radius = 250;

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
                color: `hsl(${(selectedIndex * 360) / totalPlayers}, 70%, 70%)`
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

                    // Update the pre-bracket pairs for the selected player
                    setPreBracketPairs((prevPairs) => {
                        const updatedPairs = [...prevPairs];
                        const totalPairs = updatedPairs.length;

                        // Determine the correct slot to update
                        if (currentSlotIndex < totalPairs) {
                            // Fill the first column of the current row
                            if (updatedPairs[currentSlotIndex][0] === 'TBD') {
                                updatedPairs[currentSlotIndex][0] = selectedPlayer;
                            } else {
                                console.error(`Row ${currentSlotIndex}, Column 0 is already filled!`);
                            }
                        } else {
                            if (
                                currentSlotIndex != null &&
                                !isNaN(currentSlotIndex) &&
                                totalPairs != null &&
                                !isNaN(totalPairs)
                            ) {
                                const opponentIndex = currentSlotIndex - totalPairs;

                                // Ensure opponentIndex is valid
                                if (opponentIndex >= 0 && opponentIndex < updatedPairs.length) {
                                    if (updatedPairs[opponentIndex][1] === 'TBD') {
                                        updatedPairs[opponentIndex][1] = selectedPlayer;
                                    } else {
                                        console.error(`Row ${opponentIndex}, Column 1 is already filled!`);
                                    }
                                } else {
                                    console.error('Invalid Opponent Index:', opponentIndex);
                                }
                            } else {
                                console.error('Invalid Current Slot Index or Total Pairs:', {
                                    currentSlotIndex,
                                    totalPairs
                                });
                            }
                        }

                        // Increment the current slot index AFTER updating the pairs
                        setCurrentSlotIndex((prevIndex) => {
                            const newIndex = prevIndex + 1;
                            return newIndex;
                        });

                        return updatedPairs;
                    });

                    // Handle the last player logic after 1 second
                    setTimeout(() => {
                        setRemainingPlayers((prevPlayers) => {
                            if (prevPlayers.length === 1) {
                                const lastPlayer = prevPlayers[0];

                                // Manually calculate the updated slot index
                                const updatedSlotIndex = currentSlotIndex + 1;

                                // Add the last player to the pre-bracket table
                                setPreBracketPairs((prevPairs) => {
                                    const updatedPairs = [...prevPairs];
                                    const totalPairs = updatedPairs.length;

                                    // Determine the correct slot to update
                                    if (updatedSlotIndex < totalPairs) {
                                        // Fill the first column of the current row
                                        if (updatedPairs[updatedSlotIndex][0] === 'TBD') {
                                            updatedPairs[updatedSlotIndex][0] = lastPlayer;
                                        } else {
                                            console.error(`Row ${updatedSlotIndex}, Column 0 is already filled!`);
                                        }
                                    } else {
                                        // Calculate the opponent index for the second column
                                        const opponentIndex = updatedSlotIndex - totalPairs;

                                        // Ensure opponentIndex is valid
                                        if (opponentIndex >= 0 && opponentIndex < updatedPairs.length) {
                                            if (updatedPairs[opponentIndex][1] === 'TBD') {
                                                updatedPairs[opponentIndex][1] = lastPlayer;
                                            } else {
                                                console.error(`Row ${opponentIndex}, Column 1 is already filled!`);
                                            }
                                        } else {
                                            console.error('Invalid Opponent Index:', opponentIndex);
                                        }
                                    }

                                    return updatedPairs;
                                });

                                // Clear the remaining players
                                setRemainingPlayers([]);
                            }

                            return prevPlayers;
                        });
                    }, 1000); // 1-second delay

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
                setModalMessage(`Add ${selected} to the Pre-Bracket Table?`);
                setSelectedPlayer(selected);
                setIsModalVisible(true);

                setIsSpinning(false);
            }, 1000); // 1-second delay
        }, spinDuration * 1000); // Match the spin duration
    };

    // Redraw the wheel whenever the remaining players, fading state, or particles change
    useEffect(() => {
        drawWheel();
    }, [remainingPlayers, fadingOpacity, fadingSlice, particles]);

    // Automatically add the last remaining player to the bracket
    useEffect(() => {
        if (remainingPlayers.length === 1 && !isSpinning) {
            const lastPlayer = remainingPlayers[0];
            console.log('Last remaining player detected:', lastPlayer);

            // Add the last player to the pre-bracket table after a short delay
            setTimeout(() => {
                setPreBracketPairs((prevPairs) => {
                    const updatedPairs = [...prevPairs];
                    const totalPairs = updatedPairs.length;

                    // Determine the correct slot to update
                    if (currentSlotIndex < totalPairs) {
                        // Fill the first column of the current row
                        if (updatedPairs[currentSlotIndex][0] === 'TBD') {
                            updatedPairs[currentSlotIndex][0] = lastPlayer;
                            console.log(`Added ${lastPlayer} to Row ${currentSlotIndex}, Column 0`);
                        } else {
                            console.error(`Row ${currentSlotIndex}, Column 0 is already filled!`);
                        }
                    } else {
                        // Calculate the opponent index for the second column
                        const opponentIndex = currentSlotIndex - totalPairs;

                        // Ensure opponentIndex is valid
                        if (opponentIndex >= 0 && opponentIndex < updatedPairs.length) {
                            if (updatedPairs[opponentIndex][1] === 'TBD') {
                                updatedPairs[opponentIndex][1] = lastPlayer;
                                console.log(`Added ${lastPlayer} to Row ${opponentIndex}, Column 1`);
                            } else {
                                console.error(`Row ${opponentIndex}, Column 1 is already filled!`);
                            }
                        } else {
                            console.error('Invalid Opponent Index:', opponentIndex);
                        }
                    }

                    return updatedPairs;
                });

                // Clear the remaining players
                setRemainingPlayers([]);
            }, 500); // Small delay to ensure smooth transition
        }
    }, [remainingPlayers, isSpinning, currentSlotIndex]);

    // Check if the bracket is complete
    const isBracketComplete = preBracketPairs.every((pair) => pair[0] !== 'TBD' && pair[1] !== 'TBD');

    return (
        <div className={classes.spinningWheelContainer}>
            {/* Spinning wheel section - hide when all players are assigned */}
            {remainingPlayers.length > 0 && (
                <div className={classes.wheelSection}>
                    {/* Pointer */}
                    <div className={classes.pointer}></div>
                    {/* Canvas for the spinning wheel */}
                    <canvas ref={canvasRef} width="500" height="500" className={classes.spinningWheelCanvas}></canvas>
                    {/* Spin button */}
                    <button
                        onClick={spinWheel}
                        disabled={isSpinning}
                        className={`${classes.spinButton} ${isSpinning ? classes.disabled : ''}`}
                    >
                        {isSpinning ? 'Spinning...' : 'Spin'}
                    </button>
                    {/* Spin duration input */}
                    <div className={classes.spinDurationContainer}>
                        <label htmlFor="spin-duration">Spin Duration (seconds):</label>
                        <input
                            id="spin-duration"
                            type="number"
                            min="1"
                            max="20"
                            value={spinDuration}
                            onChange={(e) => setSpinDuration(Number(e.target.value))}
                            className={classes.spinDurationInput}
                        />
                    </div>
                </div>
            )}
            {/* Pre-Bracket Table */}
            <div
                className={`${classes.preBracketTable} ${remainingPlayers.length === 0 ? classes.preBracketTableExpanded : ''}`}
            >
                <h2>Pre-Bracket Table</h2>
                {preBracketPairs.map((pair, index) => {
                    const details = pairDetails[index];
                    const [player1, player2] = pair;
                    return (
                        <div key={index} className={classes.bracketPair}>
                            <div className={classes.pairContainer}>
                                <div className={classes.playerInfo}>
                                    <span className={classes.playerName}>{player1}</span>
                                    {remainingPlayers.length === 0 && details?.player1Stars && player1 !== 'TBD' && (
                                        <StarsComponent stars={details.player1Stars} />
                                    )}
                                </div>
                                <span className={classes.vsText}>vs</span>
                                <div className={classes.playerInfo}>
                                    <span className={classes.playerName}>{player2}</span>
                                    {remainingPlayers.length === 0 && details?.player2Stars && player2 !== 'TBD' && (
                                        <StarsComponent stars={details.player2Stars} />
                                    )}
                                </div>
                            </div>
                            {remainingPlayers.length === 0 && details?.history && (
                                <div className={classes.historyInfo}>
                                    <span>
                                        History: {details.history.player1Wins} - {details.history.player2Wins}
                                    </span>
                                    <span className={classes.totalGames}>({details.history.total} games)</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {/* Start Tournament Button */}
            {isBracketComplete && (
                <button onClick={() => onStartTournament(preBracketPairs)} className={classes.startTournamentButton}>
                    Start Tournament
                </button>
            )}

            {/* Modal */}
            {isModalVisible && (
                <div className={classes.modal}>
                    <p>{modalMessage}</p>
                    <div className={classes.modalButtons}>
                        <button onClick={handleModalYes}>Yes</button>
                        <button onClick={handleModalNo}>No</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpinningWheel;
