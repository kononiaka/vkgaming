import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import classes from './SpinningWheel.module.css';

const SpinningWheel = ({ players, onStartTournament }) => {
    const wheelRef = useRef(null);
    const [remainingPlayers, setRemainingPlayers] = useState([]);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [isSpinning, setIsSpinning] = useState(false);

    // Initialize remaining players
    useEffect(() => {
        const playerNames = Object.values(players).map((player) => player.name);
        setRemainingPlayers(playerNames);
    }, [players]);

    // Create the spinning wheel
    useEffect(() => {
        if (!wheelRef.current) return;

        const data = new Array(remainingPlayers.length).fill(16); // Equal slice sizes
        const pieColors = remainingPlayers.map((_, index) => (index % 2 === 0 ? '#8b35bc' : '#b163da'));

        const wheelChart = new Chart(wheelRef.current, {
            plugins: [ChartDataLabels],
            type: 'pie',
            data: {
                labels: remainingPlayers,
                datasets: [
                    {
                        backgroundColor: pieColors,
                        data: data
                    }
                ]
            },
            options: {
                responsive: true,
                animation: { duration: 0 },
                plugins: {
                    tooltip: false,
                    legend: { display: false },
                    datalabels: {
                        color: '#ffffff',
                        formatter: (_, context) => context.chart.data.labels[context.dataIndex],
                        font: { size: 14 }
                    }
                }
            }
        });

        return () => {
            wheelChart.destroy();
        };
    }, [remainingPlayers]);

    // Spin the wheel
    const spinWheel = () => {
        if (isSpinning) return;

        setIsSpinning(true);
        const totalPlayers = remainingPlayers.length;
        const sliceAngle = 360 / totalPlayers;

        // Map players to degree ranges
        const rotationValues = remainingPlayers.map((player, index) => ({
            minDegree: index * sliceAngle,
            maxDegree: (index + 1) * sliceAngle - 1,
            player
        }));

        // Generate random degree to stop at
        const randomDegree = Math.floor(Math.random() * 360);

        // Spinner count and result value
        let count = 0;
        let resultValue = 101;

        // Rotation animation
        const rotationInterval = setInterval(() => {
            const wheelChart = Chart.getChart(wheelRef.current);
            if (!wheelChart) return;

            // Rotate the wheel
            wheelChart.options.rotation = (wheelChart.options.rotation || 0) + resultValue;
            wheelChart.update();

            // Reset rotation if it exceeds 360 degrees
            if (wheelChart.options.rotation >= 360) {
                count += 1;
                resultValue -= 5;
                wheelChart.options.rotation = 0;
            }

            // Stop the wheel
            if (count > 15 && wheelChart.options.rotation === randomDegree) {
                // Determine the selected player
                const selected = rotationValues.find(
                    (range) => randomDegree >= range.minDegree && randomDegree <= range.maxDegree
                )?.player;

                setSelectedPlayer(selected);
                setRemainingPlayers((prev) => prev.filter((player) => player !== selected));
                clearInterval(rotationInterval);
                setIsSpinning(false);
            }
        }, 10);
    };

    return (
        <div className={classes.spinningWheelContainer}>
            {/* Pointer Arrow */}
            <div className={classes.pointer}></div>
            {/* Canvas for the spinning wheel */}
            <canvas ref={wheelRef} className={classes.spinningWheelCanvas}></canvas>
            <button
                onClick={spinWheel}
                disabled={isSpinning}
                className={`${classes.spinButton} ${isSpinning ? classes.disabled : ''}`}
            >
                {isSpinning ? 'Spinning...' : 'Spin'}
            </button>
            {selectedPlayer && <p className={classes.selectedPlayer}>Selected Player: {selectedPlayer}</p>}
        </div>
    );
};

export default SpinningWheel;
