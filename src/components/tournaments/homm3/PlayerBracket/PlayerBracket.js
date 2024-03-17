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
    stage,
    games,
    teamIndex
}) => {
    const { team1, team2, score1, score2, winner, castle1, castle2 } = pair;
    let teamPlayer = team === 'team1' ? team1 : team2;
    let playerScore = team === 'team1' ? score1 : score2;
    let playerCastle = team === 'team1' ? castle1 : castle2;
    let numberOfGames;
    if (games && games.length > 1) {
        numberOfGames = games;
    } else {
        numberOfGames = [1];
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
            <div>Stars img</div>
            {hasTruthyPlayers &&
                games &&
                numberOfGames.map((game, gameIndex) => {
                    let castle =
                        games.length > 1 && game
                            ? team === 'team1'
                                ? game.castle1
                                : game.castle2
                            : playerCastle
                            ? playerCastle
                            : '';

                    return (
                        <div key={game.gameId} className="castle-dropdown-class">
                            <select
                                id={`castle-${team}-${pairIndex}${games > 1 ? '-' + game : ''}`}
                                value={castle}
                                onChange={(event) =>
                                    handleCastleChange(
                                        stageIndex,
                                        pairIndex,
                                        teamIndex,
                                        event.target.value,
                                        setPlayoffPairs,
                                        games,
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
                            </select>
                        </div>
                    );
                })}
            <input
                type="text"
                id={`score-${team}-${pairIndex}`}
                value={playerScore || ''}
                onChange={(event) => handleScoreChange(stage, pairIndex, teamIndex, event.target.value)}
            />
        </div>
    );
};
