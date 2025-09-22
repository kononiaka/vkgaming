import React, { useState, useEffect, useRef } from 'react';
import classes from './SpinningWheel.module.css';

const SpinningWheel = ({ players, onStartTournament }) => {
    const [remainingPlayers, setRemainingPlayers] = useState([]);
    const [preBracketPairs, setPreBracketPairs] = useState([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [spinDuration, setSpinDuration] = useState(5); // Default spin duration (in seconds)
    const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
    const canvasRef = useRef(null);

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

            console.log(`Drawing segment for ${player} (${index * sliceAngle}° - ${(index + 1) * sliceAngle - 1}°)`);

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
            ctx.textAlign = 'right';
            ctx.fillStyle = '#000'; // Set text color
            ctx.font = '10px Arial'; // Set font size and family
            ctx.fillText(`${player} (${index * sliceAngle}° - ${(index + 1) * sliceAngle - 1}°)`, radius - 10, 5);
            ctx.restore(); // Restore the canvas state
        });
    };

    // Spin the wheel
    const spinWheel = () => {
        if (isSpinning) {
            return;
        }

        const totalPlayers = remainingPlayers.length;
        console.log('Total Players:', totalPlayers);
        const sliceAngle = 360 / totalPlayers; // Angle per segment
        console.log('Slice Angle:', sliceAngle);
        const randomIndex = Math.floor(Math.random() * totalPlayers); // Randomly select a segment
        console.log('Random Index:', randomIndex);
        const targetAngle = randomIndex * sliceAngle; // Angle to land on the selected segment
        console.log('Target Angle:', targetAngle);
        const spinAngle = 3600 + targetAngle; // 10 full rotations + target angle
        console.log('Spin Angle:', spinAngle);
        const spinDurationMs = spinDuration * 1000; // Convert seconds to milliseconds
        // console.log('Spin Duration (ms):', spinDurationMs);

        let startTime = null;

        const animateSpin = (timestamp) => {
            if (!startTime) {
                startTime = timestamp;
            }
            const elapsed = timestamp - startTime;
            // console.log('Elapsed Time:', elapsed);
            const progress = Math.min(elapsed / spinDurationMs, 1);
            // console.log('Progress:', progress);
            const easing = easeOutCubic(progress);
            // console.log('Easing:', easing);
            const currentAngle = easing * spinAngle;
            // console.log('Current Angle:', currentAngle);

            // Draw the wheel with rotation
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((currentAngle * Math.PI) / 180);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);
            drawWheel();
            ctx.restore();

            if (progress < 1) {
                requestAnimationFrame(animateSpin);
            } else {
                // Normalize the final angle
                const finalAngle = currentAngle % 360;
                // console.log('Final Angle:', finalAngle);

                // Ensure the angle is within 0–360 degrees
                const normalizedAngle = (finalAngle + 360) % 360;
                // console.log('Normalized Angle:', normalizedAngle);

                // Determine the selected segment
                const selectedIndex = Math.floor(normalizedAngle / sliceAngle); // Select the segment based on the angle
                console.log('Selected Index:', selectedIndex);

                // Add randomness within the segment
                const randomOffset = Math.random() * sliceAngle; // Random offset within the segment
                const randomAngle = (selectedIndex * sliceAngle + randomOffset) % 360;
                console.log('Random Angle within Segment:', randomAngle);

                // Rotate the wheel to the random angle
                const wheel = document.querySelector(`.${classes.wheel}`);
                const pointerOffset = 270; // Adjust for the pointer being at the top
                const rotationAngle = (randomAngle + pointerOffset) % 360; // Adjust for pointer alignment

                console.log('Before Rotation:', wheel.style.transform); // Log the current rotation
                wheel.style.transition = `transform ${spinDuration}s cubic-bezier(0.17, 0.67, 0.83, 0.67)`;
                wheel.style.transform = `rotate(${rotationAngle}deg)`; // Apply the rotation
                console.log('After Rotation:', wheel.style.transform); // Log the updated rotation

                // Select the player based on the segment
                const selected = remainingPlayers[selectedIndex];
                console.log('Selected Player:', selected);
                setSelectedPlayer(selected);

                // Show confirmation window before updating the Pre-Bracket Table
                const confirmMove = window.confirm(
                    `Do you want to move ${selected} (Final Angle: ${randomAngle}°) to the Pre-Bracket Table?`
                );
                if (!confirmMove) {
                    setIsSpinning(false); // If the user cancels, stop spinning and do nothing
                    return;
                }

                // Update the pre-bracket pairs
                setPreBracketPairs((prevPairs) => {
                    const updatedPairs = [...prevPairs];
                    const totalPairs = updatedPairs.length;

                    // const totalPlayers = remainingPlayers.length;
                    // const sliceAngle = 360 / totalPlayers; // Calculate the angle range for each player
                    const minAngle = Math.floor(currentSlotIndex * sliceAngle);
                    const maxAngle = Math.floor((currentSlotIndex + 1) * sliceAngle - 1);
                    const angleRange = `${minAngle}° - ${maxAngle}°`; // Format the angle range
                    console.log(`Placing ${selected} in slot ${currentSlotIndex} (Angle Range: ${angleRange})`);

                    if (currentSlotIndex < totalPairs) {
                        // Fill the first players (i.e., left side of the bracket)
                        updatedPairs[currentSlotIndex][0] = selected;
                    } else {
                        // Fill the opponents (i.e., right side of the bracket)
                        const opponentIndex = currentSlotIndex - totalPairs;
                        updatedPairs[opponentIndex][1] = selected;
                    }

                    return updatedPairs;
                });

                // Remove the selected player from the remaining players
                setRemainingPlayers((prevPlayers) => prevPlayers.filter((player) => player !== selected));

                // Move to the next slot
                setCurrentSlotIndex((prevIndex) => prevIndex + 1);

                setIsSpinning(false);
            }
        };

        requestAnimationFrame(animateSpin);
    };

    // Easing function for smooth deceleration
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

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
