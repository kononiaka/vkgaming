import React, { useEffect, useRef, useState } from 'react';
import { determineTournamentPrizes } from '../../api/api';
import Modal from '../Modal/Modal';
import classes from './ModalAddTournament.module.css';
import { shuffleArray, setStageLabels } from '../../components/tournaments/tournament_api';

const Bracket = (props) => {
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState('');

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
    const tournamentPricePoolRef = useRef(null);
    const tournamentPlayoffGames = useRef(null);
    const tournamentPlayoffGamesFinal = useRef(null);
    const tournamentDateRef = useRef(null);
    const randomBracketRef = useRef(null);

    const isFormValid = () =>
        tournamentNameRef.current?.value?.trim() !== '' &&
        tournamentPlayerRef.current?.value?.trim() !== '' &&
        tournamentPricePoolRef.current?.value?.trim() !== '' &&
        date.trim() !== '' &&
        tournamentPlayoffGames.current?.value?.trim() !== '' &&
        tournamentPlayoffGamesFinal.current?.value?.trim() !== '';

    const handleSave = async () => {
        if (!isFormValid()) {
            return;
        }

        // Build tournament object from current values
        const objTournament = {
            name: tournamentNameRef.current.value,
            maxPlayers: tournamentPlayerRef.current.value,
            pricePull: determineTournamentPrizes(tournamentPricePoolRef.current.value),
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

        await response.json();

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
                        <label htmlFor="prepareRandomRef">Spinning Wheel:</label>
                        <input type="checkbox" id="randomBracket" label="Spinning Wheel" ref={randomBracketRef} />
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
                    <div>
                        <label htmlFor="tournamentPricePool">Tournament Price Pool:</label>
                        <input id="tournamentPricePool" type="number" ref={tournamentPricePoolRef} />
                    </div>
                    <div>
                        <label htmlFor="tournamentPlayoffGames">PlayOff Games:</label>
                        <input id="tournamentPlayoffGames" type="number" ref={tournamentPlayoffGames} />
                    </div>
                    <div>
                        <label htmlFor="tournamentPlayoffGamesFinal">PlayOff Final Games:</label>
                        <input id="tournamentPlayoffGamesFinal" type="number" ref={tournamentPlayoffGamesFinal} />
                    </div>
                </>
            )}
            <button type="button" onClick={handleSave} disabled={!isFormValid()}>
                Save
            </button>
            <button type="button" onClick={props.onClose}>
                Cancel
            </button>
        </Modal>
    );
};

export default Bracket;
