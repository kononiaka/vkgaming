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
    const [fadingPlayer, setFadingPlayer] = useState(null);

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
            ctx.fillText(
                `${player} (${Math.floor(index * sliceAngle)}° - ${Math.floor((index + 1) * sliceAngle - 1)}°)`,
                radius - 10,
                5
            );
            ctx.restore(); // Restore the canvas state
        });
    };

    // Spin the wheel
    const spinWheel = () => {
        if (isSpinning || remainingPlayers.length === 0) {
            console.log('Spin attempt blocked: Either the wheel is already spinning or no players remain.');
            return;
        }

        console.log('--- Starting Spin ---');
        setIsSpinning(true);

        const totalPlayers = remainingPlayers.length;
        const sliceAngle = 360 / totalPlayers;

        // Randomize the number of full spins between 3 and 7
        const fullSpins = Math.floor(Math.random() * (7 - 3 + 1) + 3) * 360;

        // Calculate the stop angle
        const selectedIndex = Math.floor(Math.random() * totalPlayers);
        const stopAngle = 360 - selectedIndex * sliceAngle - sliceAngle / 2;

        // Add pointer offset
        const pointerOffset = 270;
        const adjustedStopAngle = (stopAngle + pointerOffset) % 360;

        // Total rotation angle
        const rotationAngle = fullSpins + adjustedStopAngle;

        // Apply the rotation to the wheel
        const wheel = document.querySelector(`.${classes.spinningWheelCanvas}`);

        // Force repaint
        wheel.style.transition = 'none';
        wheel.style.transform = 'rotate(0deg)';
        void wheel.offsetWidth; // Trigger a repaint
        wheel.style.transition = `transform ${spinDuration}s cubic-bezier(0.17, 0.67, 0.83, 0.67)`;
        wheel.style.transform = `rotate(${rotationAngle}deg)`;

        // Stop the wheel after the animation
        setTimeout(() => {
            const selected = remainingPlayers[selectedIndex];

            // Calculate the player's range for clarity
            const playerStartAngle = Math.floor(selectedIndex * sliceAngle);
            const playerEndAngle = Math.floor((selectedIndex + 1) * sliceAngle - 1);
            const playerRange = `${playerStartAngle}° - ${playerEndAngle}°`;

            setFadingPlayer(selected);

            // Delay the confirmation dialog by 1 second
            // setTimeout(() => {
            // const confirmMove = window.confirm(
            //     `Do you want to move ${selected} (Final Angle: ${adjustedStopAngle}°, Player Range: ${playerRange}) to the Pre-Bracket Table?`
            // );
            // if (!confirmMove) {
            //     setIsSpinning(false); // If the user cancels, stop spinning and do nothing
            //     return;
            // }

            // Trigger the fade-out animation
            setFadingPlayer(selected);

            // Wait for the fade-out animation to complete before updating the state
            setRemainingPlayers((prevPlayers) => prevPlayers.filter((player) => player !== selected));
            setFadingPlayer(null); // Reset the fading player

            // Move to the next slot
            setCurrentSlotIndex((prevIndex) => prevIndex + 1);

            setIsSpinning(false);
            console.log('--- Spin Complete ---');

            // Update the pre-bracket pairs
            setPreBracketPairs((prevPairs) => {
                const updatedPairs = [...prevPairs];
                const totalPairs = updatedPairs.length;

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
        }, spinDuration * 1000); // Match the spin duration
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
