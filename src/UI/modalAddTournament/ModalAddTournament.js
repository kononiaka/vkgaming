import React, { useEffect, useRef, useState } from 'react';
import { determineTournamentPrizes } from '../../api/api';
import Modal from '../Modal/Modal';
import classes from './ModalAddTournament.module.css';

const Bracket = (props) => {
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState('');
    const [tournamentName, setTournamentName] = useState('');
    const [tournamentPlayer, setTournamentPlayer] = useState('');

    useEffect(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        setDate(`${year}-${month}-${day}T${hours}:${minutes}`);
        setIsLoading(false);
    }, []);

    const tournamentNameRef = useRef(null);
    const tournamentPlayerRef = useRef(null);
    const tournamentPricePoolRef = useRef(null);
    const tournamentPlayoffGames = useRef(null);
    const tournamentPlayoffGamesFinal = useRef(null);
    const tournamentDateRef = useRef(null);

    const objTournament = {};

    const tournamentNameBlur = () => {
        // Access the input value using the ref
        const tournamentNameValue = tournamentNameRef.current.value;
        if (tournamentNameValue.length > 0) {
            objTournament.name = tournamentNameValue;
            // setTournamentName(tournamentNameValue);
        }
    };
    const tournamentPlayersBlur = () => {
        // Access the input value using the ref
        const tournamentPlayerValue = tournamentPlayerRef.current.value;
        if (tournamentPlayerValue.length > 0) {
            objTournament.maxPlayers = tournamentPlayerValue;
            // setTournamentPlayer(tournamentPlayerValue);
        }
    };
    const tournamentPricePoolBlur = () => {
        // Access the input value using the ref
        const tournamentPricePoolValue = tournamentPricePoolRef.current.value;
        if (tournamentPricePoolValue.length > 0) {
            objTournament.pricePull = determineTournamentPrizes(tournamentPricePoolValue);
            // objTournament.pricePull = tournamentPricePoolValue;
            // setTournamentPlayer(tournamentPricePoolValue);
        }
    };
    const tournamentDateBlur = () => {
        // Access the input value using the ref
        const tournamentDateValue = tournamentDateRef.current.value;
        if (tournamentDateValue.length > 0) {
            objTournament.date = tournamentDateValue;
            // setTournamentPlayer(tournamentDateValue);
        }
    };
    const tournamentPlayoffGamesBlur = () => {
        objTournament.tournamentPlayoffGames = tournamentPlayoffGames.current.value;
    };
    const tournamentPlayoffGamesFinalBlur = () => {
        objTournament.tournamentPlayoffGamesFinal = tournamentPlayoffGamesFinal.current.value;
    };

    const handleSave = async () => {
        // Save game data to database

        console.log('objTournament', objTournament);

        objTournament.status = 'Register';
        objTournament.players = 0;

        objTournament.winners = {
            '1st place': 'TBD',
            '2nd place': 'TBD',
            '3rd place': 'TBD'
        };

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
        window.location.reload();
    };

    return (
        <Modal onClick={props.onClose} addTournament={props.addTournament}>
            <h2 className={classes['header-text']}>Add Tournament</h2>
            {isLoading ? (
                <p>Loading...</p>
            ) : (
                <>
                    <div>
                        <label htmlFor="tournamentDate">Tournament Date:</label>
                        <input
                            type="datetime-local"
                            id="tournamentDate"
                            ref={tournamentDateRef}
                            onBlur={tournamentDateBlur}
                        />
                    </div>
                    <div>
                        <label htmlFor="tournamentName">Tournament Name:</label>
                        <input id="tournamentName" ref={tournamentNameRef} onBlur={tournamentNameBlur} />
                    </div>
                    <div>
                        <label htmlFor="tournamentPlayers">Tournament Players:</label>
                        <input id="tournamentPlayers" ref={tournamentPlayerRef} onBlur={tournamentPlayersBlur} />
                    </div>
                    <div>
                        <label htmlFor="tournamentPricePool">Tournament Price:</label>
                        <input id="tournamentPricePool" ref={tournamentPricePoolRef} onBlur={tournamentPricePoolBlur} />
                    </div>
                    <div>
                        <label htmlFor="tournamentPlayoffGames">Tournament PlayOff Games:</label>
                        <input
                            id="tournamentPlayoffGames"
                            ref={tournamentPlayoffGames}
                            onBlur={tournamentPlayoffGamesBlur}
                        />
                    </div>
                    <div>
                        <label htmlFor="tournamentPlayoffGamesFinal">Tournament PlayOff Final Games:</label>
                        <input
                            id="tournamentPlayoffGamesFinal"
                            ref={tournamentPlayoffGamesFinal}
                            onBlur={tournamentPlayoffGamesFinalBlur}
                        />
                    </div>
                </>
            )}
            <button onClick={handleSave}>Save</button>
            <button onClick={props.onClose}>Cancel</button>
        </Modal>
    );
};

export default Bracket;
