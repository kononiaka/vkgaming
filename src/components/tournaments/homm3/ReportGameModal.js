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

const ReportGameModal = ({ pair, onClose, onSubmit }) => {
    const [selectedWinner, setSelectedWinner] = useState('');
    const [castle1, setCastle1] = useState('');
    const [castle2, setCastle2] = useState('');
    const [score1, setScore1] = useState(0);
    const [score2, setScore2] = useState(0);
    const [gameResults, setGameResults] = useState([]);

    // Available castles
    const castles = [
        'Castle',
        'Rampart',
        'Tower',
        'Inferno',
        'Necropolis',
        'Dungeon',
        'Stronghold',
        'Fortress',
        'Conflux'
    ];

    // Map castle names to imported images
    const getCastleImageUrl = (castleName) => {
        const castleImages = {
            Castle: castleImg,
            Rampart: rampartImg,
            Tower: towerImg,
            Inferno: infernoImg,
            Necropolis: necropolisImg,
            Dungeon: dungeonImg,
            Stronghold: strongholdImg,
            Fortress: fortressImg,
            Conflux: confluxImg
        };
        return castleImages[castleName] || '';
    };

    // Initialize game results for bo-3
    React.useEffect(() => {
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
        setGameResults(updated);

        // Auto-calculate scores based on winners
        const team1Wins = updated.filter((g) => g.winner === pair.team1).length;
        const team2Wins = updated.filter((g) => g.winner === pair.team2).length;
        setScore1(team1Wins);
        setScore2(team2Wins);

        // Auto-select winner if reached 2 wins
        if (team1Wins >= 2) {
            setSelectedWinner(pair.team1);
        } else if (team2Wins >= 2) {
            setSelectedWinner(pair.team2);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Only validate if a winner is selected (full game report)
        // Allow submission without winner to mark game as started
        if (selectedWinner) {
            if (pair.type === 'bo-3') {
                // Validate bo-3
                if (gameResults.some((g) => !g.castle1 || !g.castle2 || !g.winner)) {
                    alert('Please fill in all game details for BO-3');
                    return;
                }
                if ((score1 !== 2 && score2 !== 2) || (score1 === 2 && score2 === 2)) {
                    alert('Invalid score for BO-3. One player must have exactly 2 wins.');
                    return;
                }
            } else {
                // Validate bo-1
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {!game.castle1 ? (
                                                <select
                                                    value={game.castle1}
                                                    onChange={(e) =>
                                                        handleGameResultChange(idx, 'castle1', e.target.value)
                                                    }
                                                >
                                                    <option value="">Select Castle</option>
                                                    {castles.map((c) => (
                                                        <option key={c} value={c}>
                                                            {c}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <img
                                                    src={getCastleImageUrl(game.castle1)}
                                                    alt={game.castle1}
                                                    title={game.castle1}
                                                    style={{
                                                        height: '48px',
                                                        width: 'auto',
                                                        maxWidth: '120px',
                                                        border: '2px solid gold',
                                                        borderRadius: '4px',
                                                        objectFit: 'contain',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => handleGameResultChange(idx, 'castle1', '')}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className={classes.formGroup}>
                                        <label>{pair.team2} Castle:</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {!game.castle2 ? (
                                                <select
                                                    value={game.castle2}
                                                    onChange={(e) =>
                                                        handleGameResultChange(idx, 'castle2', e.target.value)
                                                    }
                                                >
                                                    <option value="">Select Castle</option>
                                                    {castles.map((c) => (
                                                        <option key={c} value={c}>
                                                            {c}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <img
                                                    src={getCastleImageUrl(game.castle2)}
                                                    alt={game.castle2}
                                                    title={game.castle2}
                                                    style={{
                                                        height: '48px',
                                                        width: 'auto',
                                                        maxWidth: '120px',
                                                        border: '2px solid gold',
                                                        borderRadius: '4px',
                                                        objectFit: 'contain',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => handleGameResultChange(idx, 'castle2', '')}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className={classes.formGroup}>
                                        <label>Winner:</label>
                                        <select
                                            value={game.winner}
                                            onChange={(e) => handleGameResultChange(idx, 'winner', e.target.value)}
                                        >
                                            <option value="">Select Winner</option>
                                            <option value={pair.team1}>{pair.team1}</option>
                                            <option value={pair.team2}>{pair.team2}</option>
                                        </select>
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {!castle1 ? (
                                        <select value={castle1} onChange={(e) => setCastle1(e.target.value)}>
                                            <option value="">Select Castle</option>
                                            {castles.map((c) => (
                                                <option key={c} value={c}>
                                                    {c}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <img
                                            src={getCastleImageUrl(castle1)}
                                            alt={castle1}
                                            title={castle1}
                                            style={{
                                                height: '48px',
                                                width: 'auto',
                                                maxWidth: '120px',
                                                border: '2px solid gold',
                                                borderRadius: '4px',
                                                objectFit: 'contain',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => setCastle1('')}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className={classes.formGroup}>
                                <label>{pair.team2} Castle:</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {!castle2 ? (
                                        <select value={castle2} onChange={(e) => setCastle2(e.target.value)}>
                                            <option value="">Select Castle</option>
                                            {castles.map((c) => (
                                                <option key={c} value={c}>
                                                    {c}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <img
                                            src={getCastleImageUrl(castle2)}
                                            alt={castle2}
                                            title={castle2}
                                            style={{
                                                height: '48px',
                                                width: 'auto',
                                                maxWidth: '120px',
                                                border: '2px solid gold',
                                                borderRadius: '4px',
                                                objectFit: 'contain',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => setCastle2('')}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className={classes.formGroup}>
                                <label>Winner:</label>
                                <select
                                    value={selectedWinner}
                                    onChange={(e) => {
                                        const winner = e.target.value;
                                        setSelectedWinner(winner);
                                        if (winner === pair.team1) {
                                            setScore1(1);
                                            setScore2(0);
                                        } else if (winner === pair.team2) {
                                            setScore1(0);
                                            setScore2(1);
                                        } else {
                                            setScore1(0);
                                            setScore2(0);
                                        }
                                    }}
                                >
                                    <option value="">Select Winner</option>
                                    <option value={pair.team1}>{pair.team1}</option>
                                    <option value={pair.team2}>{pair.team2}</option>
                                </select>
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
