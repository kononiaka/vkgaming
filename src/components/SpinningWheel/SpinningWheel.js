import React, { useState, useEffect, useRef } from 'react';
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

    // Initialize remaining players and pre-bracket pairs
    useEffect(() => {
        const playerNames = Object.values(players).map((player) => player.name);
        setRemainingPlayers(playerNames);
        const pairs = Array.from({ length: playerNames.length / 2 }, () => ['TBD', 'TBD']);
        setPreBracketPairs(pairs);
    }, [players]);

    // Draw the wheel on the canvas
    const drawWheel = () => {
        const canvas = canvasRef.current;
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
            // Draw the text
            ctx.fillStyle = 'white';
            ctx.font = '14px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(`${player}`, radius - 10, 5);
            ctx.restore(); // Restore the canvas state
        });

        // Reset global alpha
        ctx.globalAlpha = 1;
    };

    const handleModalYes = () => {
        setFadingSlice(selectedPlayer); // Set the slice to fade out

        let opacity = 1; // Initial opacity
        const fadeOut = () => {
            drawWheel(opacity); // Redraw the wheel with the fading slice
            opacity -= 0.05; // Reduce opacity
            if (opacity > 0) {
                requestAnimationFrame(fadeOut); // Continue the animation
            } else {
                // Remove the slice after the animation completes
                setRemainingPlayers((prevPlayers) => prevPlayers.filter((player) => player !== selectedPlayer));

                // Update the pre-bracket pairs
                setPreBracketPairs((prevPairs) => {
                    const updatedPairs = [...prevPairs];
                    const totalPairs = updatedPairs.length;

                    if (currentSlotIndex < totalPairs) {
                        updatedPairs[currentSlotIndex][0] = selectedPlayer;
                    } else {
                        const opponentIndex = currentSlotIndex - totalPairs;
                        console.log('Opponent Index:', opponentIndex);
                        updatedPairs[opponentIndex][1] = selectedPlayer;
                    }

                    return updatedPairs;
                });

                // Move to the next slot
                setCurrentSlotIndex((prevIndex) => prevIndex + 1);

                // Reset the fading state after the animation completes
                setIsModalVisible(false); // Hide the modal
                setIsSpinning(false);
                setFadingSlice(null); // Reset the fading slice
            }
        };
        fadeOut();
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
                setModalMessage(
                    `Do you want to move ${selected} (Final Angle: ${adjustedStopAngle}°, Player Range: ${playerRange}) to the Pre-Bracket Table?`
                );
                setSelectedPlayer(selected);
                setIsModalVisible(true);

                setIsSpinning(false);
            }, 1000); // 1-second delay
        }, spinDuration * 1000); // Match the spin duration
    };

    // Redraw the wheel whenever the remaining players change
    useEffect(() => {
        drawWheel();
    }, [remainingPlayers]);

    // Check if the bracket is complete
    const isBracketComplete = preBracketPairs.every((pair) => pair[0] !== 'TBD' && pair[1] !== 'TBD');

    return (
        <div className={classes.spinningWheelContainer}>
            {/* Pointer */}
            <div className={classes.pointer}></div>
            {/* Canvas for the spinning wheel */}
            <canvas ref={canvasRef} width="300" height="300" className={classes.spinningWheelCanvas}></canvas>
            {/* Spin button */}
            {remainingPlayers.length > 0 && (
                <button
                    onClick={spinWheel}
                    disabled={isSpinning}
                    className={`${classes.spinButton} ${isSpinning ? classes.disabled : ''}`}
                >
                    {isSpinning ? 'Spinning...' : 'Spin'}
                </button>
            )}
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
            {isModalVisible && (
                <div className={classes.modal}>
                    <p>{modalMessage}</p>
                    <div className={classes.modalButtons}>
                        <button onClick={handleModalYes}>Yes</button>
                        <button onClick={handleModalNo}>No</button>
                    </div>
                </div>
            )}

            {/* Selected player */}
            {selectedPlayer && <p className={classes.selectedPlayer}>Selected Player: {selectedPlayer}</p>}
            {/* Pre-Bracket Table */}
            <div className={classes.preBracketTable}>
                <h2>Pre-Bracket Table</h2>
                {preBracketPairs.map((pair, index) => (
                    <div key={index} className={classes.bracketPair}>
                        {pair[0]} vs {pair[1]}
                    </div>
                ))}
            </div>
            {/* Start Tournament Button */}
            {isBracketComplete && (
                <button onClick={() => onStartTournament(preBracketPairs)} className={classes.startTournamentButton}>
                    Start Tournament
                </button>
            )}
        </div>
    );
};

export default SpinningWheel;
