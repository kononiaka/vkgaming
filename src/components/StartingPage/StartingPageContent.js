import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import AuthContext from '../../store/auth-context';
import castleImg from '../../image/castles/castle.jpeg';
import rampartImg from '../../image/castles/rampart.jpeg';
import towerImg from '../../image/castles/tower.jpeg';
import infernoImg from '../../image/castles/inferno.jpeg';
import necropolisImg from '../../image/castles/necropolis.jpeg';
import dungeonImg from '../../image/castles/dungeon.jpeg';
import strongholdImg from '../../image/castles/stronghold.jpeg';
import fortressImg from '../../image/castles/fortress.jpeg';
import confluxImg from '../../image/castles/conflux.jpeg';
import coveImg from '../../image/castles/cove.jpeg';
import factoryImg from '../../image/castles/factory.jpeg';
import kronverkImg from '../../image/castles/kronverk.jpeg';
import redFlagImg from '../../image/flags/red.jpg';
import blueFlagImg from '../../image/flags/blue.jpg';
import DonationLeaderboard from '../DonationLeaderboard/DonationLeaderboard';
import StarsComponent from '../Stars/Stars';
import classes from './StartingPageContent.module.css';

const StartingPageContent = () => {
    const authCtx = useContext(AuthContext);
    let { userNickName, isLogged, notificationShown } = authCtx;
    const [activeTournaments, setActiveTournaments] = useState([]);
    const [liveGames, setLiveGames] = useState([]);
    const [statusFilter, setStatusFilter] = useState('started');

    const parseNumericValue = (value) => {
        if (typeof value === 'string' && value.includes(',')) {
            return Number(value.split(',').at(-1).trim()) || 0;
        }
        return Number(value) || 0;
    };

    const getCastleImage = (castleName) => {
        const normalizedName = String(castleName || '')
            .split('-')[0]
            .trim()
            .toLowerCase();

        const castleImageMap = {
            castle: castleImg,
            rampart: rampartImg,
            tower: towerImg,
            inferno: infernoImg,
            necropolis: necropolisImg,
            dungeon: dungeonImg,
            stronghold: strongholdImg,
            fortress: fortressImg,
            conflux: confluxImg,
            cove: coveImg,
            factory: factoryImg,
            kronverk: kronverkImg
        };

        return castleImageMap[normalizedName] || null;
    };

    const getFlagImage = (color) => (String(color || '').toLowerCase() === 'red' ? redFlagImg : blueFlagImg);

    const getHeadToHeadPrediction = (team1, team2, gamesHistory, playerContext = {}) => {
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        const getDeterministicValue = (key, min, max) => {
            let hash = 0;
            for (let i = 0; i < key.length; i++) {
                hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
            }

            const normalized = (hash % 10000) / 10000;
            return min + normalized * (max - min);
        };

        const team1Rating = parseNumericValue(playerContext.team1Rating);
        const team2Rating = parseNumericValue(playerContext.team2Rating);
        const team1Stars = parseNumericValue(playerContext.team1Stars);
        const team2Stars = parseNumericValue(playerContext.team2Stars);

        const parsePlace = (value) => {
            const num = Number(value);
            return Number.isFinite(num) && num > 0 ? num : null;
        };

        const team1Place = parsePlace(playerContext.team1Place);
        const team2Place = parsePlace(playerContext.team2Place);

        const relevantGames = Object.values(gamesHistory || {}).filter((historyGame) => {
            const o1 = historyGame?.opponent1;
            const o2 = historyGame?.opponent2;

            return (o1 === team1 && o2 === team2) || (o1 === team2 && o2 === team1);
        });

        // Leaderboard component: place/rating/stars create a bounded bias around 50%.
        const placeAdvantage = team1Place && team2Place ? clamp((team2Place - team1Place) * 1.8, -12, 12) : 0;
        const ratingAdvantage = clamp((team1Rating - team2Rating) * 0.04, -12, 12);
        // Stars provide only a gentle nudge compared to place/rating.
        const starsAdvantage = clamp((team1Stars - team2Stars) * 0.8, -4, 4);
        const leaderboardPrediction = clamp(50 + placeAdvantage + ratingAdvantage + starsAdvantage, 15, 85);

        if (relevantGames.length === 0) {
            // Add a tiny deterministic spread so evenly ranked players are not always exactly 50/50.
            const matchupKey = `${team1}|${team2}`;
            const tinyAdjustment = getDeterministicValue(matchupKey, -1.25, 1.25);
            const team1Prediction = clamp(leaderboardPrediction + tinyAdjustment, 15, 85);
            return { team1: team1Prediction.toFixed(1), team2: (100 - team1Prediction).toFixed(1) };
        }

        const team1Wins = relevantGames.filter((historyGame) => historyGame?.winner === team1).length;
        let headToHeadPrediction = (team1Wins / relevantGames.length) * 100;

        // Blend H2H with leaderboard context, weighting H2H more as sample size grows.
        const h2hWeight = clamp(0.35 + relevantGames.length * 0.08, 0.35, 0.8);
        let team1Prediction = headToHeadPrediction * h2hWeight + leaderboardPrediction * (1 - h2hWeight);
        const matchupKey = `${team1}|${team2}`;

        // Avoid hard 100% displays by softening extremes into a stable realistic range.
        if (team1Prediction >= 99.95) {
            team1Prediction = getDeterministicValue(matchupKey, 80, 85);
        } else if (team1Prediction <= 0.05) {
            team1Prediction = getDeterministicValue(matchupKey, 15, 20);
        }

        const team2Prediction = 100 - team1Prediction;

        return {
            team1: team1Prediction.toFixed(1),
            team2: team2Prediction.toFixed(1)
        };
    };

    if (userNickName === 'undefined') {
        userNickName = localStorage.getItem('userName');
    }

    let greeting = '';
    if (isLogged && notificationShown) {
        greeting = `Welcome on Board, ${userNickName} to konoplay!`;
    } else if (isLogged && !notificationShown) {
        greeting = `Welcome back, ${userNickName} to konoplay!`;
    } else {
        greeting = 'Welcome to konoplay!';
    }

    useEffect(() => {
        const fetchActiveTournaments = async () => {
            try {
                const response = await fetch(
                    'https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3.json'
                );
                const data = await response.json();

                const usersResponse = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
                const usersData = await usersResponse.json();
                const historyResponse = await fetch(
                    'https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3.json'
                );
                const historyData = await historyResponse.json();
                const avatarByNickname = {};
                const rankByNickname = {};

                const getLatestRating = (u) => {
                    const r = u.ratings;
                    if (typeof r === 'string' && r.includes(',')) {
                        return parseFloat(r.split(',').at(-1)) || 0;
                    }
                    return parseFloat(r) || 0;
                };
                const sortedUsers = Object.values(usersData || {})
                    .filter((u) => u && u.ratings !== undefined)
                    .sort((a, b) => getLatestRating(b) - getLatestRating(a));
                sortedUsers.forEach((user, idx) => {
                    if (user?.enteredNickname) {
                        rankByNickname[user.enteredNickname] = idx + 1;
                    }
                });

                Object.values(usersData || {}).forEach((user) => {
                    if (user?.enteredNickname) {
                        avatarByNickname[user.enteredNickname] = user.avatar || null;
                    }
                });

                if (response.ok && data) {
                    const tournamentList = Object.keys(data)
                        .map((key) => {
                            const tournament = data[key];
                            return tournament ? { id: key, ...tournament } : null;
                        })
                        .filter(Boolean)
                        .filter(
                            (t) =>
                                t.status === 'Registration' ||
                                t.status === 'Registration Started' ||
                                t.status === 'Started!' ||
                                t.status === 'Tournament Finished'
                        )
                        .sort((a, b) => {
                            const statusOrder = {
                                'Registration Started': 1,
                                Registration: 1,
                                'Started!': 2,
                                'Tournament Finished': 3
                            };
                            return (statusOrder[a.status] || 999) - (statusOrder[b.status] || 999);
                        });

                    setActiveTournaments(tournamentList);

                    const games = [];
                    Object.keys(data).forEach((tournamentId) => {
                        const tournament = data[tournamentId];
                        const tournamentPlayers = Object.values(tournament?.players || {}).filter(Boolean);
                        if (
                            tournament &&
                            tournament.status === 'Started!' &&
                            tournament.bracket &&
                            tournament.bracket.playoffPairs
                        ) {
                            tournament.bracket.playoffPairs.forEach((stage, stageIndex) => {
                                if (Array.isArray(stage)) {
                                    stage.forEach((pair) => {
                                        const team1Player = tournamentPlayers.find(
                                            (player) => player.name === pair.team1
                                        );
                                        const team2Player = tournamentPlayers.find(
                                            (player) => player.name === pair.team2
                                        );

                                        if (pair.games && Array.isArray(pair.games)) {
                                            pair.games.forEach((game) => {
                                                if (game.castle1 && game.castle2 && !game.castleWinner) {
                                                    const prediction = getHeadToHeadPrediction(
                                                        pair.team1,
                                                        pair.team2,
                                                        historyData,
                                                        {
                                                            team1Place: team1Player?.placeInLeaderboard,
                                                            team2Place: team2Player?.placeInLeaderboard,
                                                            team1Rating: pair.ratings1 ?? team1Player?.ratings,
                                                            team2Rating: pair.ratings2 ?? team2Player?.ratings,
                                                            team1Stars: pair.stars1 ?? team1Player?.stars,
                                                            team2Stars: pair.stars2 ?? team2Player?.stars
                                                        }
                                                    );

                                                    games.push({
                                                        tournamentId,
                                                        tournamentName: tournament.name,
                                                        stageLabel: pair.stage || `Stage ${stageIndex + 1}`,
                                                        team1: pair.team1,
                                                        team2: pair.team2,
                                                        team1Avatar: avatarByNickname[pair.team1] || null,
                                                        team2Avatar: avatarByNickname[pair.team2] || null,
                                                        score1: pair.score1 || 0,
                                                        score2: pair.score2 || 0,
                                                        type: pair.type,
                                                        stageIndex,
                                                        castle1: game.castle1,
                                                        castle2: game.castle2,
                                                        color1: game.color1 || pair.color1 || 'red',
                                                        color2: game.color2 || pair.color2 || 'blue',
                                                        gameNumber: (game.gameId || 0) + 1,
                                                        team1Stars: parseNumericValue(
                                                            pair.stars1 ?? team1Player?.stars
                                                        ),
                                                        team2Stars: parseNumericValue(
                                                            pair.stars2 ?? team2Player?.stars
                                                        ),
                                                        team1Place:
                                                            rankByNickname[pair.team1] ||
                                                            team1Player?.placeInLeaderboard ||
                                                            '-',
                                                        team2Place:
                                                            rankByNickname[pair.team2] ||
                                                            team2Player?.placeInLeaderboard ||
                                                            '-',
                                                        team1Rating: parseNumericValue(
                                                            pair.ratings1 ?? team1Player?.ratings
                                                        ),
                                                        team2Rating: parseNumericValue(
                                                            pair.ratings2 ?? team2Player?.ratings
                                                        ),
                                                        team1Prediction: prediction.team1,
                                                        team2Prediction: prediction.team2,
                                                        gold1: game.gold1 || 0,
                                                        gold2: game.gold2 || 0,
                                                        restart1_111: game.restart1_111 || 0,
                                                        restart1_112: game.restart1_112 || 0,
                                                        restart2_111: game.restart2_111 || 0,
                                                        restart2_112: game.restart2_112 || 0,
                                                        restartsFinished: Boolean(game.restartsFinished)
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                    setLiveGames(games);
                }
            } catch (error) {
                console.error('Error fetching tournaments:', error);
            }
        };

        fetchActiveTournaments();
    }, []);

    const hasLiveGames = (tournament) => {
        if (!tournament.bracket || !tournament.bracket.playoffPairs) {
            return false;
        }

        return tournament.bracket.playoffPairs.some((stage) =>
            stage.some((pair) => {
                if (pair.games && Array.isArray(pair.games)) {
                    return pair.games.some((game) => game.castle1 && game.castle2 && !game.castleWinner);
                }
                return false;
            })
        );
    };

    const filteredTournaments = activeTournaments.filter((tournament) => {
        if (statusFilter === 'all') {
            return true;
        }
        if (statusFilter === 'registration') {
            return tournament.status === 'Registration' || tournament.status === 'Registration Started';
        }
        if (statusFilter === 'started') {
            return tournament.status === 'Started!';
        }
        if (statusFilter === 'finished') {
            return tournament.status === 'Tournament Finished';
        }
        if (statusFilter === 'live') {
            return hasLiveGames(tournament);
        }
        return true;
    });

    const getTournamentStatusQuery = (status) => {
        if (status === 'Registration' || status === 'Registration Started') {
            return 'registration';
        }
        if (status === 'Registration finished!') {
            return 'registrationFinished';
        }
        if (status === 'Started!') {
            return 'started';
        }
        if (status && status.includes('Finished')) {
            return 'finished';
        }
        return 'all';
    };

    const renderRestartTokens = (restart111Value, restart112Value) => {
        const used111 = Math.max(0, Math.min(2, Number(restart111Value) || 0));
        const used112 = (Number(restart112Value) || 0) >= 1;
        // If any 111 restart was used, 112 is automatically marked as used
        const show112AsUsed = used112 || used111 >= 1;

        return (
            <div className={classes.restartsRow}>
                {[0, 1].map((idx) => (
                    <span
                        key={`111-${idx}`}
                        className={`${classes.restartTag} ${idx < used111 ? classes.restartUsed : ''}`}
                    >
                        111
                    </span>
                ))}
                <span className={`${classes.restartTag} ${show112AsUsed ? classes.restartUsed : ''}`}>112</span>
            </div>
        );
    };

    return (
        <section className={classes.starting}>
            <h1>{greeting}</h1>
            {authCtx.isAdmin && <DonationLeaderboard />}

            {activeTournaments.length > 0 && (
                <div className={classes.tournamentsSection}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1rem'
                        }}
                    >
                        <h2>Active Tournaments</h2>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.1), rgba(255, 215, 0, 0.05))',
                                border: '2px solid #00ffff',
                                borderRadius: '8px',
                                color: '#00ffff',
                                fontSize: '0.9rem',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="all">All Tournaments</option>
                            <option value="registration">Registration Open</option>
                            <option value="started">In Progress</option>
                            <option value="live">Live Games</option>
                            <option value="finished">Finished</option>
                        </select>
                    </div>
                    <div className={classes.tournamentsList}>
                        {filteredTournaments.map((tournament) => (
                            <Link
                                key={tournament.id}
                                to={`/tournaments/homm3?status=${getTournamentStatusQuery(tournament.status)}`}
                                className={classes.tournamentCard}
                                style={{
                                    opacity: tournament.status === 'Tournament Finished' ? 0.6 : 1,
                                    transition: 'opacity 0.3s ease'
                                }}
                            >
                                <div className={classes.tournamentStatus}>
                                    {tournament.status === 'Registration' ||
                                    tournament.status === 'Registration Started'
                                        ? 'Registration Open'
                                        : tournament.status === 'Started!'
                                          ? 'In Progress'
                                          : 'Finished'}
                                </div>
                                <div className={classes.tournamentName}>{tournament.name}</div>
                                <div className={classes.tournamentDetails}>
                                    {tournament.players
                                        ? Object.values(tournament.players).filter((p) => p !== null).length
                                        : 0}
                                    /{tournament.maxPlayers} Players
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {activeTournaments.some((t) => t.status === 'Started!') && (
                <div className={classes.tournamentsSection}>
                    <h2>Live Games</h2>
                    {liveGames.length > 0 ? (
                        <div className={classes.tournamentsList}>
                            {liveGames.map((game, index) => (
                                <Link key={index} to="/tournaments/homm3?status=live" className={classes.liveGameCard}>
                                    <div className={classes.liveIndicator}>LIVE</div>
                                    <div className={classes.tournamentName}>
                                        {game.tournamentName} ({game.stageLabel})
                                    </div>
                                    <div className={classes.predictionBanner}>
                                        Win prediction: {game.team1} {game.team1Prediction}% | {game.team2}{' '}
                                        {game.team2Prediction}%
                                    </div>
                                    <div className={classes.matchup}>
                                        <div className={classes.player}>
                                            <div className={classes.playerLine}>
                                                <div className={classes.playerVisuals}>
                                                    {game.team1Avatar ? (
                                                        <img
                                                            src={game.team1Avatar}
                                                            alt={game.team1}
                                                            className={classes.playerAvatar}
                                                        />
                                                    ) : (
                                                        <div className={classes.playerAvatarFallback}>
                                                            {String(game.team1 || '?')
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </div>
                                                    )}
                                                    <img
                                                        src={getFlagImage(game.color1)}
                                                        alt={`${game.color1} flag`}
                                                        className={classes.playerFlag}
                                                    />
                                                </div>
                                                <span className={classes.playerName}>{game.team1}</span>
                                                <span className={classes.playerPlaceInline}>#{game.team1Place}</span>
                                                <div className={classes.playerStarsWrapInline}>
                                                    <StarsComponent stars={game.team1Stars} />
                                                </div>
                                            </div>
                                            <span className={classes.score}>{game.score1}</span>
                                        </div>
                                        <div className={classes.vs}>VS</div>
                                        <div className={classes.player}>
                                            <span className={classes.score}>{game.score2}</span>
                                            <div className={classes.playerLineRight}>
                                                <div className={classes.playerStarsWrapInlineRight}>
                                                    <StarsComponent stars={game.team2Stars} />
                                                </div>
                                                <span className={classes.playerName}>{game.team2}</span>
                                                <span className={classes.playerPlaceInline}>#{game.team2Place}</span>
                                                <div className={classes.playerVisuals}>
                                                    <img
                                                        src={getFlagImage(game.color2)}
                                                        alt={`${game.color2} flag`}
                                                        className={classes.playerFlag}
                                                    />
                                                    {game.team2Avatar ? (
                                                        <img
                                                            src={game.team2Avatar}
                                                            alt={game.team2}
                                                            className={classes.playerAvatar}
                                                        />
                                                    ) : (
                                                        <div className={classes.playerAvatarFallback}>
                                                            {String(game.team2 || '?')
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={classes.duelDetails}>
                                        <span>Game {game.gameNumber}</span>
                                        <span>
                                            Colors: {game.team1} ({game.color1}) vs {game.team2} ({game.color2})
                                        </span>
                                        <span className={classes.winPrediction}>
                                            Win prediction: {game.team1} {game.team1Prediction}% | {game.team2}{' '}
                                            {game.team2Prediction}%
                                        </span>
                                        {game.restartsFinished && (
                                            <span className={classes.restartsFinishedBadge}>
                                                Restarts finished / main game started
                                            </span>
                                        )}
                                    </div>
                                    <div className={classes.castlesRow}>
                                        <div className={classes.castleCard}>
                                            {getCastleImage(game.castle1) && (
                                                <img
                                                    src={getCastleImage(game.castle1)}
                                                    alt={game.castle1}
                                                    className={classes.castleImg}
                                                />
                                            )}
                                            <div className={classes.castleName}>{game.castle1}</div>
                                            <div className={classes.castleMeta}>Gold: {game.gold1}</div>
                                            <div className={classes.restartsLabel}>Restarts:</div>
                                            {renderRestartTokens(game.restart1_111, game.restart1_112)}
                                        </div>
                                        <div className={classes.castleCard}>
                                            {getCastleImage(game.castle2) && (
                                                <img
                                                    src={getCastleImage(game.castle2)}
                                                    alt={game.castle2}
                                                    className={classes.castleImg}
                                                />
                                            )}
                                            <div className={classes.castleName}>{game.castle2}</div>
                                            <div className={classes.castleMeta}>Gold: {game.gold2}</div>
                                            <div className={classes.restartsLabel}>Restarts:</div>
                                            {renderRestartTokens(game.restart2_111, game.restart2_112)}
                                        </div>
                                    </div>
                                    <div className={classes.gameType}>
                                        {game.type === 'bo-3' ? 'Best of 3' : 'Best of 1'}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div
                            style={{
                                textAlign: 'center',
                                padding: '3rem 2rem',
                                background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.05), rgba(255, 215, 0, 0.03))',
                                border: '2px dashed #00ffff',
                                borderRadius: '12px',
                                color: '#FFD700',
                                fontSize: '1.2rem',
                                fontWeight: 'bold'
                            }}
                        >
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>No active games</div>
                            <div>Time to fire one up. 🔥</div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

export default StartingPageContent;
