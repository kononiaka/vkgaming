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
    let playerStars =
        team === 'team1'
            ? Number(typeof stars1 === 'string' && stars1.includes(',') ? stars1.split(',').at(-1) : stars1) || null
            : Number(typeof stars2 === 'string' && stars2.includes(',') ? stars2.split(',').at(-1) : stars2) || null;
    let playerScore =
        team === 'team1'
            ? Number(typeof score1 === 'string' && score1.includes(',') ? score1.split(',').at(-1) : score1) || null
            : Number(typeof score2 === 'string' && score2.includes(',') ? score2.split(',').at(-1) : score2) || null;
    let playerCastle = team === 'team1' ? castle1 : castle2;
    let isLive = false;
    let numberOfGames;

    numberOfGames = pair.games;

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
            <div className={classes.stars_container}>
                {playerStars && playerStars !== 'TBD' && (
                    <div className={classes.stars_wrapper} style={{ cursor: 'pointer' }}>
                        <StarsComponent stars={playerStars} />
                        <div className={classes.stars_details}>
                            Ratings:
                            {team === 'team1'
                                ? (() => {
                                      const ratingsArray = pair.ratings1
                                          .split(',')
                                          .map((rating) => parseFloat(rating.trim()));
                                      const lastRating = ratingsArray.at(-1).toFixed(2);
                                      if (stageIndex === 0) {
                                          return `${lastRating}`;
                                      }
                                      const previousRating =
                                          ratingsArray.length > 1 ? ratingsArray.at(-2).toFixed(2) : '0.00';
                                      const difference = (lastRating - previousRating).toFixed(2);
                                      return (
                                          <>
                                              {lastRating}{' '}
                                              <span
                                                  style={{
                                                      color: difference >= 0 ? 'green' : 'red'
                                                  }}
                                              >
                                                  ({difference >= 0 ? '+' : ''}
                                                  {difference})
                                              </span>
                                          </>
                                      );
                                  })()
                                : (() => {
                                      const ratingsArray = pair.ratings2
                                          .split(',')
                                          .map((rating) => parseFloat(rating.trim()));
                                      const lastRating = ratingsArray.at(-1).toFixed(2);
                                      if (stageIndex === 0) {
                                          return `${lastRating}`;
                                      }
                                      const previousRating =
                                          ratingsArray.length > 1 ? ratingsArray.at(-2).toFixed(2) : '0.00';
                                      const difference = (lastRating - previousRating).toFixed(2);
                                      return (
                                          <>
                                              {lastRating}
                                              <span
                                                  style={{
                                                      color: difference >= 0 ? 'green' : 'red'
                                                  }}
                                              >
                                                  ({difference >= 0 ? '+' : ''}
                                                  {difference})
                                              </span>
                                          </>
                                      );
                                  })()}
                        </div>
                    </div>
                )}
            </div>
            {hasTruthyPlayers &&
                pair.games &&
                numberOfGames.map((game, gameIndex) => {
                    isLive = game.gameStatus === 'In Progress';
                    // console.log('isLive', isLive);

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
                                className={checked ? classes['castle-selected'] : ''}
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
                                className={classes.radio_custom}
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
                                disabled={game.gameStatus === 'Processed'} // Disable if processed
                            />

                            <div
                                key={game.gameId}
                                className={`${isLive ? classes.player_bracket_live : ''} ${isLive ? classes.blink : ''}`}
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
                style={{
                    width: '3rem',
                    padding: '0.5rem 0.5rem',
                    textAlign: 'center',
                    border: '2px solid #3e20c0',
                    borderRadius: '3px',
                    background: '#f5f5fa',
                    color: '#2a1a6b',
                    margin: '0.5rem 0',
                    outline: 'none',
                    boxShadow: '0 1px 3px rgba(62,32,192,0.07)'
                }}
            />
        </div>
    );
};
