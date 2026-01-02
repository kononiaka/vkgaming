import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import StarsComponent from '../../../Stars/Stars';
import { fetchLastGamesForPlayer, getAvatar, lookForUserId } from '../../../../api/api';
import classes from './PlayerBracket.module.css';

// Import local castle images
import castleImg from '../../../../image/castles/castle.jpeg';
import rampartImg from '../../../../image/castles/rampart.jpeg';
import towerImg from '../../../../image/castles/tower.jpeg';
import infernoImg from '../../../../image/castles/inferno.jpeg';
import necropolisImg from '../../../../image/castles/necropolis.jpeg';
import dungeonImg from '../../../../image/castles/dungeon.jpeg';
import strongholdImg from '../../../../image/castles/stronghold.jpeg';
import fortressImg from '../../../../image/castles/fortress.jpeg';
import factoryImg from '../../../../image/castles/factory.jpeg';
import confluxImg from '../../../../image/castles/conflux.jpeg';
import coveImg from '../../../../image/castles/cove.jpeg';
import kronverkImg from '../../../../image/castles/kronverk.jpeg';

export const PlayerBracket = (props) => {
    const {
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
    } = props;

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
    let numberOfGames;

    numberOfGames = pair.games;

    if (`${pair.score1} - ${pair.score2}` === '1 - 1') {
        if (numberOfGames.length === 2) {
            let extraGame = { gameId: 2, castle1: '', castle2: '', castleWinner: null, gameWinner: null };
            numberOfGames.push(extraGame);
        }
    }

    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [streak, setStreak] = useState([]);
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [userId, setUserId] = useState(null);
    const tooltipTimeout = useRef(null);

    // Fetch player avatar and userId
    useEffect(() => {
        const fetchAvatar = async () => {
            if (teamPlayer && teamPlayer !== 'TBD') {
                try {
                    const uid = await lookForUserId(teamPlayer);
                    if (uid) {
                        setUserId(uid);
                        const avatar = await getAvatar(uid);
                        setAvatarUrl(avatar);
                    }
                } catch (error) {
                    console.error('Error fetching avatar:', error);
                    setAvatarUrl(null);
                    setUserId(null);
                }
            }
        };
        fetchAvatar();
    }, [teamPlayer]);

    // Ensure only one tooltip is visible at a time (global for this component type)
    window.__playerBracketTooltipHideAll = window.__playerBracketTooltipHideAll || (() => {});
    const hideAllTooltips = () => {
        if (window.__playerBracketTooltipHideAll) window.__playerBracketTooltipHideAll();
    };
    window.__playerBracketTooltipHideAll = () => setShowTooltip(false);

    const handleMouseEnter = async (e) => {
        hideAllTooltips(); // Hide any other tooltip
        if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);

        const streakArr = await fetchLastGamesForPlayer(teamPlayer, 5);
        setStreak(streakArr);

        // Use bounding rect for better positioning
        if (e && e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltipPos({ x: rect.right + 8, y: rect.top });
        }

        // Show tooltip after a short delay to ensure previous is hidden
        tooltipTimeout.current = setTimeout(() => setShowTooltip(true), 10);
    };

    return (
        <div
            className={classes.player_bracket}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', minWidth: '200px' }}>
                <label
                    htmlFor={`score-${team}-${pairIndex}`}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={() => setShowTooltip(false)}
                    style={{ cursor: 'pointer' }}
                >
                    {teamPlayer === winner ? (
                        <div className={classes['green-indicator']}></div>
                    ) : winner === 'Tie' || winner === undefined ? (
                        <div className={classes['grey-indicator']}></div>
                    ) : (
                        <div className={classes['red-indicator']}></div>
                    )}
                </label>

                {avatarUrl && (
                    <img
                        src={avatarUrl}
                        alt={teamPlayer}
                        style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            marginRight: '8px',
                            border: '2px solid #00ffff',
                            objectFit: 'cover',
                            boxShadow: '0 2px 4px rgba(0, 255, 255, 0.3)'
                        }}
                    />
                )}
                {userId && teamPlayer !== 'TBD' ? (
                    <NavLink
                        to={`/players/${userId}`}
                        style={{
                            color: '#00ffff',
                            textDecoration: 'none',
                            fontWeight: 'bold',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => (e.target.style.color = '#00cccc')}
                        onMouseLeave={(e) => (e.target.style.color = '#00ffff')}
                    >
                        {teamPlayer}
                    </NavLink>
                ) : (
                    teamPlayer
                )}
                {showTooltip && teamPlayer !== 'TBD' && (
                    <div
                        style={{
                            position: 'absolute',
                            left: 40, // adjust as needed to position right of the name/circle
                            top: -30,
                            background: '#fff',
                            border: '1px solid #3e20c0',
                            borderRadius: 6,
                            padding: '8px 12px',
                            zIndex: 9999,
                            color: '#222',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            minWidth: 120
                        }}
                        onMouseLeave={() => setShowTooltip(false)}
                        onMouseEnter={() => setShowTooltip(true)}
                    >
                        <b>Last 5 games:</b>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', gap: 6 }}>
                            {streak.length === 0 && <li>No games found</li>}
                            {streak.map((g, i) => (
                                <li key={i} title={g.opponent} style={{ position: 'relative' }}>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            width: 14,
                                            height: 14,
                                            borderRadius: '50%',
                                            background: g.result === 'Win' ? '#4caf50' : '#f44336',
                                            marginRight: 4,
                                            verticalAlign: 'middle',
                                            cursor: 'pointer'
                                        }}
                                        onMouseEnter={(e) => {
                                            const tooltip = document.getElementById(`opponent-tooltip-${i}`);
                                            if (tooltip) tooltip.style.display = 'block';
                                        }}
                                        onMouseLeave={(e) => {
                                            const tooltip = document.getElementById(`opponent-tooltip-${i}`);
                                            if (tooltip) tooltip.style.display = 'none';
                                        }}
                                    ></span>
                                    {/* Hidden opponent name, shown on hover */}
                                    <span
                                        id={`opponent-tooltip-${i}`}
                                        style={{
                                            display: 'none',
                                            position: 'absolute',
                                            top: '-28px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            background: '#222',
                                            color: '#fff',
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                            fontSize: '0.95em',
                                            whiteSpace: 'nowrap',
                                            zIndex: 10000,
                                            pointerEvents: 'none'
                                        }}
                                    >
                                        {g.opponent}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* TODO: add the stars image when the tournament just started */}
            <div className={classes.stars_container} style={{ minWidth: '120px' }}>
                {playerStars && playerStars !== 'TBD' && (
                    <div className={classes.stars_wrapper} style={{ cursor: 'pointer' }}>
                        <StarsComponent stars={playerStars} />
                        <div className={classes.stars_details}>
                            Ratings:
                            {team === 'team1'
                                ? (() => {
                                      let ratingsArray;

                                      if (pair.ratings1.includes(',')) {
                                          // It's a comma-separated list → split into an array of floats
                                          ratingsArray = pair.ratings1
                                              .split(',')
                                              .map((rating) => parseFloat(rating.trim()));
                                      } else {
                                          // It's a single rating → just wrap it in an array as a float
                                          ratingsArray = [parseFloat(pair.ratings1.trim())];
                                      }

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
            <div style={{ display: 'flex', flexDirection: 'row', gap: '0.25rem', minWidth: '52px' }}>
                {hasTruthyPlayers &&
                    pair.games &&
                    numberOfGames.map((game, gameIndex) => {
                        let castle =
                            // pair.games.length > 1 &&
                            game ? (team === 'team1' ? game.castle1 : game.castle2) : playerCastle ? playerCastle : '';

                        let checked =
                            game.castle1 &&
                            game.castle2 &&
                            game.castleWinner === castle &&
                            game.gameStatus === 'Processed';

                        // Extract castle name from format "Castle-Замок" -> "Castle"
                        const getCastleName = (castleValue) => {
                            if (!castleValue) {
                                return '';
                            }
                            return castleValue.split('-')[0];
                        };

                        // Map castle names to imported local images
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
                                Factory: factoryImg,
                                Conflux: confluxImg,
                                Cove: coveImg,
                                Kronverk: kronverkImg
                            };
                            return castleImages[castleName] || '';
                        };

                        const castleName = getCastleName(castle);
                        const castleImageUrl = getCastleImageUrl(castleName);

                        return (
                            <div key={game.gameId} className="castle-image-display">
                                {castleImageUrl && (
                                    <img
                                        src={castleImageUrl}
                                        alt={castleName}
                                        title={castleName}
                                        className={checked ? classes['castle-selected'] : ''}
                                        style={{
                                            width: '48px',
                                            height: '48px',
                                            border: checked ? '3px solid #FFD700' : '2px solid rgba(62, 32, 192, 0.3)',
                                            borderRadius: '4px',
                                            boxShadow: checked ? '0 0 10px rgba(255, 215, 0, 0.6)' : 'none',
                                            cursor: 'pointer'
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })}
            </div>
            <div
                id={`score-${team}-${pairIndex}`}
                style={{
                    width: '3rem',
                    padding: '0.5rem 0.5rem',
                    textAlign: 'center',
                    border: '2px solid rgba(255, 215, 0, 0.5)',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, rgba(62, 32, 192, 0.3), rgba(45, 20, 150, 0.3))',
                    color: '#FFD700',
                    margin: '0.5rem 0',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    boxShadow: '0 2px 8px rgba(62, 32, 192, 0.3), inset 0 1px 2px rgba(255, 215, 0, 0.1)',
                    cursor: 'default',
                    userSelect: 'none'
                }}
            >
                {playerScore || 0}
            </div>
        </div>
    );
};
