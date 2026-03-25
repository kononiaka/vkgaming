import React, { useContext, useEffect, useRef, useState } from 'react';
import { determineTournamentPrizes, lookForUserId } from '../../api/api';
import { deductCoins } from '../../api/coinTransactions';
import Modal from '../Modal/Modal';
import classes from './ModalAddTournament.module.css';
import { shuffleArray, setStageLabels } from '../../components/tournaments/tournament_api';
import AuthContext from '../../store/auth-context';

const Bracket = (props) => {
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState('');
    const [prizeType, setPrizeType] = useState('money');
    const [tournamentType, setTournamentType] = useState('kick-off');
    const authCtx = useContext(AuthContext);

    const tournamentTypeOptions = [{ value: 'kick-off', label: 'Kick-off' }];
    const playoffGameCountOptions = [
        { value: '1', label: 'BO-1 (1 game)' },
        { value: '3', label: 'BO-3 (3 games)' },
        { value: '5', label: 'BO-5 (5 games)' }
    ];

    useEffect(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = now.getMinutes();
        const roundedMinutes = minutes < 30 ? '00' : '30';
        setDate(`${year}-${month}-${day}T${hours}:${roundedMinutes}`);
        setIsLoading(false);
    }, []);

    const tournamentNameRef = useRef(null);
    const tournamentPlayerRef = useRef(null);
    const tournamentPricePoolUsdRef = useRef(null);
    const tournamentPricePoolCoinsRef = useRef(null);
    const tournamentPlayoffGames = useRef(null);
    const tournamentPlayoffGamesFinal = useRef(null);
    const tournamentDateRef = useRef(null);
    const randomBracketRef = useRef(null);

    const isFormValid = () => {
        const nameValid = tournamentNameRef.current?.value?.trim() !== '';
        const playersValid = tournamentPlayerRef.current?.value?.trim() !== '';
        const usdPrizeValid = tournamentPricePoolUsdRef.current?.value?.trim() !== '';
        const coinPrizeValid = tournamentPricePoolCoinsRef.current?.value?.trim() !== '';
        const selectedPrizeValid = prizeType === 'money' ? usdPrizeValid : coinPrizeValid;
        const dateValid = date.trim() !== '';
        const playoffGamesValid = tournamentPlayoffGames.current?.value?.trim() !== '';
        const playoffFinalValid = tournamentPlayoffGamesFinal.current?.value?.trim() !== '';

        console.log('Form validation:', {
            nameValid,
            playersValid,
            selectedPrizeValid,
            dateValid,
            playoffGamesValid,
            playoffFinalValid,
            name: tournamentNameRef.current?.value,
            players: tournamentPlayerRef.current?.value,
            usdPrize: tournamentPricePoolUsdRef.current?.value,
            coinPrize: tournamentPricePoolCoinsRef.current?.value,
            date: date,
            playoffGames: tournamentPlayoffGames.current?.value,
            playoffFinal: tournamentPlayoffGamesFinal.current?.value
        });

        return nameValid && playersValid && selectedPrizeValid && dateValid && playoffGamesValid && playoffFinalValid;
    };

    const handleSave = async () => {
        // if (!isFormValid()) {
        //     return;
        // }

        const usdPrizePool = Number(tournamentPricePoolUsdRef.current?.value) || 0;
        const coinPrizePool = Number(tournamentPricePoolCoinsRef.current?.value) || 0;
        const selectedPrizePool = prizeType === 'money' ? usdPrizePool : coinPrizePool;

        // Build tournament object from current values
        const objTournament = {
            name: tournamentNameRef.current.value,
            tournamentType,
            maxPlayers: tournamentPlayerRef.current.value,
            pricePull: determineTournamentPrizes(selectedPrizePool),
            coinPrizePull: prizeType === 'coins' ? determineTournamentPrizes(coinPrizePool) : null,
            prizeType,
            totalPrizeUsd: usdPrizePool,
            totalPrizeCoins: coinPrizePool,
            date: date,
            tournamentPlayoffGames: tournamentPlayoffGames.current.value,
            tournamentPlayoffGamesFinal: tournamentPlayoffGamesFinal.current.value,
            randomBracket: randomBracketRef.current.checked,
            status: 'Registration Started',
            players: 0,
            winners: {
                '1st place': 'TBD',
                '2nd place': 'TBD',
                '3rd place': 'TBD'
            }
        };

        let playOffPairs;

        if (randomBracketRef.current.checked) {
            objTournament.bracket = {};

            playOffPairs = shuffleArray(
                null,
                objTournament.tournamentPlayoffGames,
                objTournament.tournamentPlayoffGamesFinal,
                null,
                objTournament.maxPlayers
            );
            objTournament.bracket.playoffPairs = playOffPairs;
            objTournament.stageLabels = setStageLabels(objTournament.maxPlayers);
        }

        const response = await fetch(
            'https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3.json',
            {
                method: 'POST',
                body: JSON.stringify(objTournament),
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        const result = await response.json();

        // Deduct 5 coins from user's account after successful tournament creation
        if (response.ok && authCtx.userNickName && !authCtx.isAdmin) {
            try {
                const userId = await lookForUserId(authCtx.userNickName);

                // Use the coin transaction system to deduct coins and log the transaction
                const deductResult = await deductCoins(
                    userId,
                    5,
                    'tournament_creation',
                    `Tournament created: ${objTournament.name}`,
                    {
                        tournamentName: objTournament.name,
                        tournamentId: result.name, // Firebase returns the new ID in .name
                        maxPlayers: objTournament.maxPlayers,
                        prizeType: objTournament.prizeType,
                        prizePoolUsd: objTournament.pricePull,
                        prizePoolCoins: objTournament.coinPrizePull
                    }
                );

                if (deductResult.success) {
                    console.log(
                        `Successfully deducted 5 coins for tournament creation. New balance: ${deductResult.newBalance}`
                    );
                } else {
                    console.error('Failed to deduct coins for tournament creation:', deductResult.error);
                }
            } catch (error) {
                console.error('Error processing coin deduction for tournament:', error);
                // Don't prevent tournament creation if coin deduction fails
            }
        }

        props.onClose();
        window.location.href = '/tournaments/homm3';
    };

    return (
        <Modal onClick={props.onClose} addTournament={props.addTournament}>
            <h2 className={classes['header-text']}>Add Tournament</h2>
            {isLoading ? (
                <p>Loading...</p>
            ) : (
                <>
                    <div>
                        <label htmlFor="tournamentType">Tournament Type:</label>
                        <select
                            id="tournamentType"
                            value={tournamentType}
                            onChange={(e) => setTournamentType(e.target.value)}
                        >
                            {tournamentTypeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="prepareRandomRef">Spinning Wheel:</label>
                        <input
                            type="checkbox"
                            id="randomBracket"
                            label="Spinning Wheel"
                            ref={randomBracketRef}
                            defaultChecked
                        />
                    </div>
                    <div>
                        <label>Prize Type:</label>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <label
                                htmlFor="prizeTypeMoney"
                                style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}
                            >
                                <input
                                    type="radio"
                                    id="prizeTypeMoney"
                                    name="prizeType"
                                    checked={prizeType === 'money'}
                                    onChange={() => setPrizeType('money')}
                                />
                                Money ($)
                            </label>
                            <label
                                htmlFor="prizeTypeCoins"
                                style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}
                            >
                                <input
                                    type="radio"
                                    id="prizeTypeCoins"
                                    name="prizeType"
                                    checked={prizeType === 'coins'}
                                    onChange={() => setPrizeType('coins')}
                                />
                                Coins
                            </label>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="tournamentDate">Tournament Date:</label>
                        <input
                            type="datetime-local"
                            id="tournamentDate"
                            ref={tournamentDateRef}
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            step={1800}
                        />
                    </div>
                    <div>
                        <label htmlFor="tournamentName">Tournament Name:</label>
                        <input id="tournamentName" ref={tournamentNameRef} />
                    </div>
                    <div>
                        <label htmlFor="tournamentPlayers">Tournament Players:</label>
                        <input id="tournamentPlayers" type="number" ref={tournamentPlayerRef} />
                    </div>
                    <div style={{ display: prizeType === 'money' ? 'block' : 'none' }}>
                        <label htmlFor="tournamentPricePoolUsd">Tournament Prize Pool ($):</label>
                        <input id="tournamentPricePoolUsd" type="number" min="0" ref={tournamentPricePoolUsdRef} />
                    </div>
                    <div style={{ display: prizeType === 'coins' ? 'block' : 'none' }}>
                        <label htmlFor="tournamentPricePoolCoins">Tournament Prize Pool (Coins):</label>
                        <input id="tournamentPricePoolCoins" type="number" min="0" ref={tournamentPricePoolCoinsRef} />
                    </div>
                    <div>
                        <label htmlFor="tournamentPlayoffGames">PlayOff Games:</label>
                        <select id="tournamentPlayoffGames" defaultValue="1" ref={tournamentPlayoffGames}>
                            {playoffGameCountOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="tournamentPlayoffGamesFinal">PlayOff Final Games:</label>
                        <select id="tournamentPlayoffGamesFinal" defaultValue="1" ref={tournamentPlayoffGamesFinal}>
                            {playoffGameCountOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </>
            )}
            <button
                type="button"
                onClick={handleSave}
                // disabled={!isFormValid()}
            >
                Save
            </button>
            <button type="button" onClick={props.onClose}>
                Cancel
            </button>
        </Modal>
    );
};

export default Bracket;
