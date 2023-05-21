import React, { useState, useEffect, useRef } from 'react';
import { addScoreToUser, lookForUserId, lookForUserPrevScore } from '../../api/api';
import Modal from '../Modal/Modal';

import classes from './modalAddGame.module.css';

function AddGameModal(props) {
    const [date, setDate] = useState('');
    const [opponent1, setOpponent1] = useState('');
    const [opponent1Castle, setOpponent1Castle] = useState('');
    const [opponent1Score, setOpponent1Score] = useState('');
    const [opponent2, setOpponent2] = useState('');
    const [opponent2Castle, setOpponent2Castle] = useState('');
    const [opponent2Score, setOpponent2Score] = useState('');
    const [opponentList, setOpponentList] = useState([]);
    const [gameName, setGameName] = useState('');
    const [gameType, setGameType] = useState('');
    const [score, setScore] = useState("");
    const [winner, setWinner] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const castleTypes = [
        "Castle-Замок",
        "Rampart-Оплот",
        "Tower-Башня",
        "Inferno-Инферно",
        "Necropolis-Некрополис",
        "Dungeon-Подземелье",
        "Stronghold-Цитадель",
        "Fortress-Болото",
        "Conflux-Сопряжение",
        "Cove-Пиратская бухта"
    ];

    const gameNameRef = useRef(null);

    useEffect(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        setDate(`${year}-${month}-${day}T${hours}:${minutes}`);

        const fetchOpponentList = async () => {
            try {
                const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
                const data = await response.json();
                const nicknames = Object.values(data).map((user) => user.enteredNickname);
                setOpponentList(nicknames);

                setIsLoading(false);
            } catch (error) {
                console.error(error);
            }
        };

        fetchOpponentList();
    }, []);

    const handleOpponent1Change = (event) => {
        setOpponent1(event.target.value);
    };

    const handleOpponent2Change = (event) => {
        setOpponent2(event.target.value);
    };
    const handleOpponent1CastleChange = (event) => {
        setOpponent1Castle(event.target.value);
    };

    const handleOpponent2CastleChange = (event) => {
        setOpponent2Castle(event.target.value);
    };

    const handleScoreChange = (event) => {
        const selectedScore = event.target.value;
        setScore(selectedScore);

        if (selectedScore) {
            const [score1, score2] = selectedScore.split('-');
            setOpponent1Score(score1);
            setOpponent2Score(score2);
            if (score1 > score2) {
                setWinner(opponent1);
            } else if (score2 > score1) {
                setWinner(opponent2);
            } else {
                setWinner('Tie');
            }
        } else {
            setWinner(null);
        }
    };

    const handleGameNameChange = (event) => {
        setGameName(event.target.value);
    };
    const handleGameTypeChange = (event) => {
        setGameType(event.target.value);
    };

    const handleDateChange = (event) => {
        setDate(event.target.value);
        console.log(date);
    };

    const handleSave = async () => {
        // Save game data to database

        const gameName = gameNameRef.current.value;

        let game = {
            opponent1: opponent1,
            opponent2: opponent2,
            date: date,
            gameName: gameName,
            gameType: gameType,
            opponent1Castle: opponent1Castle,
            opponent2Castle: opponent2Castle,
            score: score,
            winner: winner
        };

        console.log('opponent1Score', opponent1Score);
        console.log('opponent2Score', opponent2Score);

        const opponent1Id = await lookForUserId(opponent1);
        const opponent2Id = await lookForUserId(opponent2);
        console.log('opponent1Id', opponent1Id);
        console.log('opponent2Id', opponent2Id);

        const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/games.json', {
            method: 'POST',
            body: JSON.stringify(game),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        await response.json();

        // Add score to players
        const opponent1PrevScore = await lookForUserPrevScore(opponent1Id);
        const opponent2PrevScore = await lookForUserPrevScore(opponent2Id);

        console.log('score1', opponent1PrevScore);
        console.log('score2', opponent2PrevScore);

        await addScoreToUser(opponent1Id, Number(opponent1PrevScore) + Number(opponent1Score));
        await addScoreToUser(opponent2Id, Number(opponent2PrevScore) + Number(opponent2Score));

        props.onClose();
    };

    return (
        <Modal onClick={props.onClose} addGame={props.addGame}>
            <h2 className={classes['header-text']}>Add Game</h2>
            {isLoading ? (
                <p>Loading...</p>
            ) : (
                <>
                    <label htmlFor="date">Date:</label>
                    <input type="datetime-local" id="date" value={date} onChange={handleDateChange} step={1800} />
                    <br />
                    <label htmlFor="gameName">Game Name:</label>
                    <select id="gameName" onChange={handleGameNameChange} defaultValue="Heroes III" ref={gameNameRef}>
                        <option value="Heroes III">Heroes III</option>
                    </select>
                    <br />
                    <label htmlFor="gameType">Game Type:</label>
                    <select id="gameType" value={gameType} onChange={handleGameTypeChange}>
                        <option value="">Select Game Type</option>
                        <option value="bo-1">bo-1</option>
                        <option value="bo-3">bo-3</option>
                    </select>
                    <br />
                    <label htmlFor="opponent1">Opponent #1:</label>
                    <select id="opponent1" value={opponent1} onChange={handleOpponent1Change} >
                        <option value="">Opponent #1</option>
                        {opponentList.map((opponent) => (
                            <option key={opponent} value={opponent}>
                                {opponent}
                            </option>
                        ))}
                    </select>
                    <select id="opponent1Castle" value={opponent1Castle} onChange={handleOpponent1CastleChange} >
                        <option value="">Castle Opponent #1</option>
                        {castleTypes.map((castle) => (
                            <option key={castle} value={castle}>
                                {castle}
                            </option>
                        ))}
                    </select>
                    <br />
                    <label htmlFor="opponent2">Opponent #2:</label>
                    <select id="opponent2" value={opponent2} onChange={handleOpponent2Change} >
                        <option value="">Opponent #2</option>
                        {opponentList.map((opponent) => (
                            <option key={opponent} value={opponent}>
                                {opponent}
                            </option>
                        ))}
                    </select>
                    <select id="opponent2Castle" value={opponent2Castle} onChange={handleOpponent2CastleChange} >
                        <option value="">Castle Opponent #2</option>
                        {castleTypes.map((castle) => (
                            <option key={castle} value={castle}>
                                {castle}
                            </option>
                        ))}
                    </select>
                    <br />
                    <label htmlFor="score">Score:</label>
                    {gameType === 'bo-1' ? (
                        <select id="score" value={score} onChange={handleScoreChange}>
                            <option value="">Select Score</option>
                            <option value="1-0">1-0</option>
                            <option value="0-1">0-1</option>
                        </select>
                    ) : (
                        <select id="score" value={score} onChange={handleScoreChange}>
                            <option value="">Select Score</option>
                            <option value="2-0">2-0</option>
                            <option value="2-1">2-1</option>
                            <option value="1-2">1-2</option>
                            <option value="0-2">0-2</option>
                        </select>
                    )}
                </>
            )}
            {/* Add other form elements for choosing castle, etc. */}
            {winner && <p>{winner} wins!</p>}
            <button onClick={handleSave}>Save</button>
            <button onClick={props.onClose}>Cancel</button>
        </Modal>
    );
}

export default AddGameModal;