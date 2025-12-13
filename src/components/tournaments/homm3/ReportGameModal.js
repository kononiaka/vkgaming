import React, { useState } from 'react';
import classes from './ReportGameModal.module.css';

// Import local castle images
import castleImg from '../../../image/castles/castle.jpeg';
import rampartImg from '../../../image/castles/rampart.jpeg';
import towerImg from '../../../image/castles/tower.jpeg';
import infernoImg from '../../../image/castles/inferno.jpeg';
import necropolisImg from '../../../image/castles/necropolis.jpeg';
import dungeonImg from '../../../image/castles/dungeon.jpeg';
import strongholdImg from '../../../image/castles/stronghold.jpeg';
import fortressImg from '../../../image/castles/fortress.jpeg';
import confluxImg from '../../../image/castles/conflux.jpeg';
import coveImg from '../../../image/castles/cove.jpeg';
import factoryImg from '../../../image/castles/factory.jpeg';

const ReportGameModal = ({ pair, onClose, onSubmit }) => {
    const [selectedWinner, setSelectedWinner] = useState(pair.winner || '');
    const [castle1, setCastle1] = useState('');
    const [castle2, setCastle2] = useState('');
    const [score1, setScore1] = useState(pair.score1 || 0);
    const [score2, setScore2] = useState(pair.score2 || 0);
    const [gameResults, setGameResults] = useState([]);

    // Available castles - using database format with Russian names
    const castles = [
        'Castle-Замок',
        'Rampart-Оплот',
        'Tower-Башня',
        'Inferno-Инферно',
        'Necropolis-Некрополис',
        'Dungeon-Подземелье',
        'Stronghold-Цитадель',
        'Fortress-Болото',
        'Conflux-Сопряжение',
        'Cove-Пиратская бухта',
        'Factory-Фабрика'
    ];

    // Map castle names to imported images
    const getCastleImageUrl = (castleName) => {
        // Extract English name from "Castle-Замок" format
        const englishName = castleName.split('-')[0];
        const castleImages = {
            Castle: castleImg,
            Rampart: rampartImg,
            Tower: towerImg,
            Inferno: infernoImg,
            Necropolis: necropolisImg,
            Dungeon: dungeonImg,
            Stronghold: strongholdImg,
            Fortress: fortressImg,
            Conflux: confluxImg,
            Cove: coveImg,
            Factory: factoryImg
        };
        return castleImages[englishName] || '';
    };

    // Initialize game results for bo-3
    React.useEffect(() => {
        // Initialize winner and scores from pair
        setSelectedWinner(pair.winner || '');
        setScore1(pair.score1 || 0);
        setScore2(pair.score2 || 0);

        if (pair.type === 'bo-3') {
            setGameResults(
                pair.games.map((game, idx) => ({
                    gameId: idx,
                    castle1: game.castle1 || '',
                    castle2: game.castle2 || '',
                    winner: game.gameWinner || ''
                }))
            );
        } else {
            // Initialize bo-1 with existing castle data if available
            if (pair.games && pair.games[0]) {
                setCastle1(pair.games[0].castle1 || '');
                setCastle2(pair.games[0].castle2 || '');
            }
        }
    }, [pair]);

    const handleGameResultChange = (gameIdx, field, value) => {
        const updated = [...gameResults];
        updated[gameIdx] = { ...updated[gameIdx], [field]: value };

        // Auto-calculate scores based on winners
        const team1Wins = updated.filter((g) => g.winner === pair.team1).length;
        const team2Wins = updated.filter((g) => g.winner === pair.team2).length;
        setScore1(team1Wins);
        setScore2(team2Wins);

        // Auto-add Game 3 if score is 1-1 and only 2 games exist
        if (team1Wins === 1 && team2Wins === 1 && updated.length === 2) {
            updated.push({
                gameId: 2,
                castle1: '',
                castle2: '',
                winner: ''
            });
        }

        setGameResults(updated);

        // Auto-select winner if reached 2 wins
        if (team1Wins >= 2) {
            setSelectedWinner(pair.team1);
        } else if (team2Wins >= 2) {
            setSelectedWinner(pair.team2);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validate based on what's being reported
        if (pair.type === 'bo-3') {
            // For bo-3, validate each game that has any data filled in
            for (let i = 0; i < gameResults.length; i++) {
                const game = gameResults[i];
                // If game has a winner, it must have castles
                if (game.winner && (!game.castle1 || !game.castle2)) {
                    alert(`Game ${i + 1}: Please select castles for both players before selecting a winner`);
                    return;
                }
                // If game has castles selected, it should be complete (have both castles)
                if ((game.castle1 || game.castle2) && (!game.castle1 || !game.castle2)) {
                    alert(`Game ${i + 1}: Please select castles for both players`);
                    return;
                }
            }

            // If overall winner is selected, validate the series is properly concluded
            if (selectedWinner) {
                if ((score1 !== 2 && score2 !== 2) || (score1 === 2 && score2 === 2)) {
                    alert('Invalid score for BO-3. One player must have exactly 2 wins to determine a match winner.');
                    return;
                }
            }
        } else {
            // Validate bo-1
            if (selectedWinner) {
                if (!castle1 || !castle2) {
                    alert('Please select castles for both players');
                    return;
                }
                if (score1 + score2 !== 1) {
                    alert('Score must be 1-0 or 0-1 for BO-1');
                    return;
                }
            }
        }

        const reportData = {
            winner: selectedWinner || null,
            score1: selectedWinner ? score1 : 0,
            score2: selectedWinner ? score2 : 0,
            games:
                pair.type === 'bo-3'
                    ? gameResults.map((g) => ({
                          castle1: g.castle1 || '',
                          castle2: g.castle2 || '',
                          castleWinner: g.winner ? (g.winner === pair.team1 ? g.castle1 : g.castle2) : '',
                          gameWinner: g.winner || '',
                          gameStatus: g.winner ? 'Finished' : 'In Progress',
                          gameId: g.gameId
                      }))
                    : [
                          {
                              castle1: castle1 || '',
                              castle2: castle2 || '',
                              castleWinner: selectedWinner ? (selectedWinner === pair.team1 ? castle1 : castle2) : '',
                              gameWinner: selectedWinner || '',
                              gameStatus: selectedWinner ? 'Finished' : 'In Progress',
                              gameId: 0
                          }
                      ]
        };

        onSubmit(reportData);
    };

    return (
        <div className={classes.backdrop} onClick={onClose}>
            <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
                <button className={classes.closeButton} onClick={onClose}>
                    ×
                </button>
                <h2 className={classes.title}>Report Game Result</h2>
                <div className={classes.matchup}>
                    {pair.team1} vs {pair.team2}
                </div>
                <div className={classes.gameType}>Type: {pair.type.toUpperCase()}</div>

                <form onSubmit={handleSubmit} className={classes.form}>
                    {pair.type === 'bo-3' ? (
                        <>
                            {/* BO-3 Game Results */}
                            {gameResults.map((game, idx) => (
                                <div key={idx} className={classes.gameSection}>
                                    <h3 className={classes.gameTitle}>Game {idx + 1}</h3>
                                    <div className={classes.formGroup}>
                                        <label>{pair.team1} Castle:</label>
                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(6, 1fr)',
                                                gap: '0.5rem',
                                                maxWidth: '600px'
                                            }}
                                        >
                                            {castles.map((c) => (
                                                <img
                                                    key={c}
                                                    src={getCastleImageUrl(c)}
                                                    alt={c}
                                                    title={c}
                                                    style={{
                                                        width: '90px',
                                                        height: '60px',
                                                        border:
                                                            game.castle1 === c
                                                                ? '3px solid #FFD700'
                                                                : '2px solid #00ffff',
                                                        borderRadius: '4px',
                                                        objectFit: 'cover',
                                                        cursor: 'pointer',
                                                        opacity: game.castle1 === c ? 1 : 0.6,
                                                        transform: game.castle1 === c ? 'scale(1.05)' : 'scale(1)',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onClick={() => handleGameResultChange(idx, 'castle1', c)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className={classes.formGroup}>
                                        <label>{pair.team2} Castle:</label>
                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(6, 1fr)',
                                                gap: '0.5rem',
                                                maxWidth: '600px'
                                            }}
                                        >
                                            {castles.map((c) => (
                                                <img
                                                    key={c}
                                                    src={getCastleImageUrl(c)}
                                                    alt={c}
                                                    title={c}
                                                    style={{
                                                        width: '90px',
                                                        height: '60px',
                                                        border:
                                                            game.castle2 === c
                                                                ? '3px solid #FFD700'
                                                                : '2px solid #00ffff',
                                                        borderRadius: '4px',
                                                        objectFit: 'cover',
                                                        cursor: 'pointer',
                                                        opacity: game.castle2 === c ? 1 : 0.6,
                                                        transform: game.castle2 === c ? 'scale(1.05)' : 'scale(1)',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onClick={() => handleGameResultChange(idx, 'castle2', c)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className={classes.formGroup}>
                                        <label>Winner:</label>
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: '1rem',
                                                justifyContent: 'center',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div
                                                onClick={() => handleGameResultChange(idx, 'winner', pair.team1)}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    padding: '1rem',
                                                    border:
                                                        game.winner === pair.team1
                                                            ? '3px solid #FFD700'
                                                            : '2px solid #00ffff',
                                                    borderRadius: '8px',
                                                    background:
                                                        game.winner === pair.team1
                                                            ? 'rgba(255, 215, 0, 0.1)'
                                                            : 'rgba(0, 255, 255, 0.05)',
                                                    opacity: game.winner === pair.team1 ? 1 : 0.6,
                                                    transform: game.winner === pair.team1 ? 'scale(1.05)' : 'scale(1)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: '60px',
                                                        height: '60px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '24px',
                                                        fontWeight: 'bold',
                                                        color: '#FFD700',
                                                        marginBottom: '0.5rem',
                                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                                                    }}
                                                >
                                                    {pair.team1.charAt(0).toUpperCase()}
                                                </div>
                                                <div
                                                    style={{ color: '#00ffff', fontSize: '12px', textAlign: 'center' }}
                                                >
                                                    {pair.team1}
                                                </div>
                                            </div>
                                            <div
                                                onClick={() => handleGameResultChange(idx, 'winner', pair.team2)}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    padding: '1rem',
                                                    border:
                                                        game.winner === pair.team2
                                                            ? '3px solid #FFD700'
                                                            : '2px solid #00ffff',
                                                    borderRadius: '8px',
                                                    background:
                                                        game.winner === pair.team2
                                                            ? 'rgba(255, 215, 0, 0.1)'
                                                            : 'rgba(0, 255, 255, 0.05)',
                                                    opacity: game.winner === pair.team2 ? 1 : 0.6,
                                                    transform: game.winner === pair.team2 ? 'scale(1.05)' : 'scale(1)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: '60px',
                                                        height: '60px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '24px',
                                                        fontWeight: 'bold',
                                                        color: '#FFD700',
                                                        marginBottom: '0.5rem',
                                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                                                    }}
                                                >
                                                    {pair.team2.charAt(0).toUpperCase()}
                                                </div>
                                                <div
                                                    style={{ color: '#00ffff', fontSize: '12px', textAlign: 'center' }}
                                                >
                                                    {pair.team2}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className={classes.scoreDisplay}>
                                <strong>Current Score:</strong> {pair.team1} {score1} - {score2} {pair.team2}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* BO-1 Game Result */}
                            <div className={classes.formGroup}>
                                <label>{pair.team1} Castle:</label>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(6, 1fr)',
                                        gap: '0.5rem',
                                        maxWidth: '600px'
                                    }}
                                >
                                    {castles.map((c) => (
                                        <img
                                            key={c}
                                            src={getCastleImageUrl(c)}
                                            alt={c}
                                            title={c}
                                            style={{
                                                width: '90px',
                                                height: '60px',
                                                border: castle1 === c ? '3px solid #FFD700' : '2px solid #00ffff',
                                                borderRadius: '4px',
                                                objectFit: 'cover',
                                                cursor: 'pointer',
                                                opacity: castle1 === c ? 1 : 0.6,
                                                transform: castle1 === c ? 'scale(1.05)' : 'scale(1)',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onClick={() => setCastle1(c)}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className={classes.formGroup}>
                                <label>{pair.team2} Castle:</label>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(6, 1fr)',
                                        gap: '0.5rem',
                                        maxWidth: '600px'
                                    }}
                                >
                                    {castles.map((c) => (
                                        <img
                                            key={c}
                                            src={getCastleImageUrl(c)}
                                            alt={c}
                                            title={c}
                                            style={{
                                                width: '90px',
                                                height: '60px',
                                                border: castle2 === c ? '3px solid #FFD700' : '2px solid #00ffff',
                                                borderRadius: '4px',
                                                objectFit: 'cover',
                                                cursor: 'pointer',
                                                opacity: castle2 === c ? 1 : 0.6,
                                                transform: castle2 === c ? 'scale(1.05)' : 'scale(1)',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onClick={() => setCastle2(c)}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className={classes.formGroup}>
                                <label>Winner:</label>
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '1rem',
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div
                                        onClick={() => {
                                            setSelectedWinner(pair.team1);
                                            setScore1(1);
                                            setScore2(0);
                                        }}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            padding: '1rem',
                                            border:
                                                selectedWinner === pair.team1
                                                    ? '3px solid #FFD700'
                                                    : '2px solid #00ffff',
                                            borderRadius: '8px',
                                            background:
                                                selectedWinner === pair.team1
                                                    ? 'rgba(255, 215, 0, 0.1)'
                                                    : 'rgba(0, 255, 255, 0.05)',
                                            opacity: selectedWinner === pair.team1 ? 1 : 0.6,
                                            transform: selectedWinner === pair.team1 ? 'scale(1.05)' : 'scale(1)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '24px',
                                                fontWeight: 'bold',
                                                color: '#FFD700',
                                                marginBottom: '0.5rem',
                                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                                            }}
                                        >
                                            {pair.team1.charAt(0).toUpperCase()}
                                        </div>
                                        <div
                                            style={{
                                                color: '#00ffff',
                                                fontSize: '12px',
                                                textAlign: 'center'
                                            }}
                                        >
                                            {pair.team1}
                                        </div>
                                    </div>
                                    <div
                                        onClick={() => {
                                            setSelectedWinner(pair.team2);
                                            setScore1(0);
                                            setScore2(1);
                                        }}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            padding: '1rem',
                                            border:
                                                selectedWinner === pair.team2
                                                    ? '3px solid #FFD700'
                                                    : '2px solid #00ffff',
                                            borderRadius: '8px',
                                            background:
                                                selectedWinner === pair.team2
                                                    ? 'rgba(255, 215, 0, 0.1)'
                                                    : 'rgba(0, 255, 255, 0.05)',
                                            opacity: selectedWinner === pair.team2 ? 1 : 0.6,
                                            transform: selectedWinner === pair.team2 ? 'scale(1.05)' : 'scale(1)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '24px',
                                                fontWeight: 'bold',
                                                color: '#FFD700',
                                                marginBottom: '0.5rem',
                                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                                            }}
                                        >
                                            {pair.team2.charAt(0).toUpperCase()}
                                        </div>
                                        <div
                                            style={{
                                                color: '#00ffff',
                                                fontSize: '12px',
                                                textAlign: 'center'
                                            }}
                                        >
                                            {pair.team2}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className={classes.scoreDisplay}>
                                <strong>Score:</strong> {pair.team1} {score1} - {score2} {pair.team2}
                            </div>
                        </>
                    )}

                    <div className={classes.buttonGroup}>
                        <button type="submit" className={classes.submitButton}>
                            Submit Result
                        </button>
                        <button type="button" onClick={onClose} className={classes.cancelButton}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReportGameModal;
