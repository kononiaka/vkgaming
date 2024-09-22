import StarsComponent from '../../../Stars/Stars';
import classes from './PlayerBracket.module.css';

export const PlayerBracket = ({
    pair,
    team,
    pairIndex,
    hasTruthyPlayers,
    stageIndex,
    setPlayoffPairs,
    handleCastleChange,
    handleScoreChange,
    handleBlur,
    handleRadioChange,
    stage,
    teamIndex,
    getWinner,
    clickedRadioButton
}) => {
    const { team1, team2, stars1, stars2, score1, score2, winner, castle1, castle2 } = pair;
    let teamPlayer = team === 'team1' ? team1 : team2;
    let playerStars = team === 'team1' ? stars1 : stars2;
    let playerScore = team === 'team1' ? score1 : score2;
    let playerCastle = team === 'team1' ? castle1 : castle2;
    let isLive = false;
    let numberOfGames;

    // if (pair.games && pair.games.length > 1) {
    numberOfGames = pair.games;
    // } else {
    //     numberOfGames = pair.games;
    // }

    if (`${pair.score1} - ${pair.score2}` === '1 - 1') {
        if (numberOfGames.length === 2) {
            let extraGame = { gameId: 2, castle1: '', castle2: '', castleWinner: null, gameWinner: null };
            numberOfGames.push(extraGame);
        }
    }

    return (
        <div className={classes.player_bracket}>
            {/* Indicator for the winner or grey-indicator for 'Tie' or undefined */}
            {teamPlayer === winner ? (
                <div className={classes['green-indicator']}></div>
            ) : winner === 'Tie' || winner === undefined ? (
                <div className={classes['grey-indicator']}></div>
            ) : (
                <div className={classes['red-indicator']}></div>
            )}
            <label htmlFor={`score-${team}-${pairIndex}`}>{teamPlayer}</label>
            {/* TODO: add the stars image when the tournament just started */}
            <div>{playerStars && <StarsComponent stars={playerStars} />}</div>
            {hasTruthyPlayers &&
                pair.games &&
                numberOfGames.map((game, gameIndex) => {
                    isLive = game.gameStatus === 'In Progress';

                    let castle =
                        // pair.games.length > 1 &&
                        game ? (team === 'team1' ? game.castle1 : game.castle2) : playerCastle ? playerCastle : '';

                    let checked =
                        game.castle1 && game.castle2 && game.castleWinner === castle && game.gameStatus === 'Processed';

                    return (
                        <div key={game.gameId} className="castle-dropdown-class">
                            <select
                                id={`castle-${team}-${pairIndex}${pair.games > 1 ? '-' + game : ''}`}
                                value={castle}
                                onChange={(event) =>
                                    handleCastleChange(
                                        stageIndex,
                                        pairIndex,
                                        teamIndex,
                                        event.target.value,
                                        setPlayoffPairs,
                                        pair.games,
                                        gameIndex
                                    )
                                }
                            >
                                <option value="">Select a castle</option>
                                <option value="Castle-Замок">Castle</option>
                                <option value="Rampart-Оплот">Rampart</option>
                                <option value="Tower-Башня">Tower</option>
                                <option value="Inferno-Инферно">Inferno</option>
                                <option value="Necropolis-Некрополис">Necropolis</option>
                                <option value="Dungeon-Подземелье">Dungeon</option>
                                <option value="Stronghold-Цитадель">Stronghold</option>
                                <option value="Fortress-Болото">Fortress</option>
                                <option value="Conflux-Сопряжение">Conflux</option>
                                <option value="Cove-Пиратская бухта">Cove</option>
                                <option value="Factory-Фабрика">Factory</option>
                            </select>
                            <input
                                type="radio"
                                id={`radio-${stageIndex}-${pairIndex}-${game.gameId}-${teamIndex}`}
                                name={`radio-${stageIndex}-${pairIndex}-${game.gameId}`}
                                onChange={(event) => {
                                    handleRadioChange(
                                        game.gameId,
                                        teamIndex,
                                        event.target.value,
                                        setPlayoffPairs,
                                        stageIndex,
                                        pairIndex,
                                        getWinner,
                                        event.target.checked,
                                        event.type
                                    );
                                }}
                                checked={
                                    checked ||
                                    `radio-${stageIndex}-${pairIndex}-${game.gameId}-${teamIndex}` ===
                                        clickedRadioButton
                                }
                            />

                            <div
                                key={game.gameId}
                                className={`${isLive ? classes.player_bracket_live : ''} ${
                                    isLive ? classes.blink : ''
                                }`}
                            />
                        </div>
                    );
                })}
            <input
                type="text"
                id={`score-${team}-${pairIndex}`}
                value={playerScore || 0}
                onChange={(event) => handleScoreChange(stage, pairIndex, teamIndex, event.target.value)}
                onBlur={(event) => handleBlur(stage, pairIndex, setPlayoffPairs, event.target.value)}
            />
        </div>
    );
};
