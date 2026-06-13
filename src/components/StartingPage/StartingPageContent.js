import { FIREBASE_DATABASE_URL } from '../../config/firebase';
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
import { getTournamentPrizeLabel } from '../../api/api';
import DonationLeaderboard from '../DonationLeaderboard/DonationLeaderboard';
import MatchAnnouncementCard from '../MatchAnnouncement/MatchAnnouncementCard';
import PrizePoolPanel from '../PrizePoolPanel/PrizePoolPanel';
import { buildCountryLookup, lookupCountryCode } from '../../utils/country';
import { isPlayerVisibleTournament, isPublicTournament } from '../../utils/tournamentVisibility';
import { getTournamentMatchLink } from '../../utils/tournamentBracketNavigation';
import { collectMyUpcomingMatches } from '../../utils/myUpcomingMatches';
import MyUpcomingMatchesSection from '../MyUpcomingMatches/MyUpcomingMatchesSection';
import classes from './StartingPageContent.module.css';

const ADMIN_ONLY_TOURNAMENT_FILTERS = new Set(['all', 'finished']);
const MATCH_CENTER_PREVIEW_LIMIT = 5;

const StartingPageContent = () => {
    const authCtx = useContext(AuthContext);
    let { userNickName, isLogged, isAdmin } = authCtx;
    const [activeTournaments, setActiveTournaments] = useState([]);
    const [liveGames, setLiveGames] = useState([]);
    const [upcomingMatches, setUpcomingMatches] = useState([]);
    const [myGames, setMyGames] = useState([]);
    const [statusFilter, setStatusFilter] = useState('started');

    useEffect(() => {
        if (!isAdmin && ADMIN_ONLY_TOURNAMENT_FILTERS.has(statusFilter)) {
            setStatusFilter('started');
        }
    }, [isAdmin, statusFilter]);

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

    useEffect(() => {
        const fetchActiveTournaments = async () => {
            try {
                const response = await fetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3.json`
                );
                const data = await response.json();

                const usersResponse = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
                const usersData = await usersResponse.json();
                const historyResponse = await fetch(
                    `${FIREBASE_DATABASE_URL}/games/heroes3.json`
                );
                const historyData = await historyResponse.json();
                const avatarByNickname = {};
                const countryLookup = buildCountryLookup(usersData);
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
                                isPublicTournament(t) &&
                                (t.status === 'Registration' ||
                                    t.status === 'Registration Started' ||
                                    t.status === 'Started!' ||
                                    t.status === 'Tournament Finished')
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

                    const liveGamesList = [];
                    const upcomingList = [];
                    Object.keys(data).forEach((tournamentId) => {
                        const tournament = data[tournamentId];
                        const tournamentPlayers = Object.values(tournament?.players || {}).filter(Boolean);
                        if (
                            tournament &&
                            isPublicTournament(tournament) &&
                            tournament.status === 'Started!' &&
                            tournament.bracket &&
                            tournament.bracket.playoffPairs
                        ) {
                            tournament.bracket.playoffPairs.forEach((stage, stageIndex) => {
                                if (Array.isArray(stage)) {
                                    stage.forEach((pair, pairIndex) => {
                                        const team1Player = tournamentPlayers.find(
                                            (player) => player.name === pair.team1
                                        );
                                        const team2Player = tournamentPlayers.find(
                                            (player) => player.name === pair.team2
                                        );

                                        const bestOf =
                                            pair.type === 'bo-5' ? 5 : pair.type === 'bo-3' ? 3 : 1;
                                        const reqWins = Math.floor(bestOf / 2) + 1;
                                        const ps1 = Number(pair.score1) || 0;
                                        const ps2 = Number(pair.score2) || 0;
                                        const seriesDone =
                                            ps1 >= reqWins ||
                                            ps2 >= reqWins ||
                                            pair.winner ||
                                            pair.gameStatus === 'Processed';
                                        const team1Ready =
                                            pair.team1 && pair.team1 !== 'TBD' && pair.team1 !== 'null';
                                        const team2Ready =
                                            pair.team2 && pair.team2 !== 'TBD' && pair.team2 !== 'null';
                                        const pairPrediction = getHeadToHeadPrediction(
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

                                        let mapLiveForPair = false;
                                        if (pair.games && Array.isArray(pair.games)) {
                                            pair.games.forEach((game) => {
                                                if (game.castle1 && game.castle2 && !game.castleWinner) {
                                                    mapLiveForPair = true;
                                                    liveGamesList.push({
                                                        tournamentId,
                                                        tournamentName: tournament.name,
                                                        tournamentDate: tournament.date || null,
                                                        stageLabel: pair.stage || `Stage ${stageIndex + 1}`,
                                                        team1: pair.team1,
                                                        team2: pair.team2,
                                                        team1Avatar: avatarByNickname[pair.team1] || null,
                                                        team2Avatar: avatarByNickname[pair.team2] || null,
                                                        team1CountryCode: lookupCountryCode(pair.team1, countryLookup, team1Player),
                                                        team2CountryCode: lookupCountryCode(pair.team2, countryLookup, team2Player),
                                                        score1: pair.score1 || 0,
                                                        score2: pair.score2 || 0,
                                                        type: pair.type,
                                                        stageIndex,
                                                        pairIndex,
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
                                                        team1Prediction: pairPrediction.team1,
                                                        team2Prediction: pairPrediction.team2,
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

                                        if (!seriesDone && team1Ready && team2Ready && !mapLiveForPair) {
                                            upcomingList.push({
                                                tournamentId,
                                                tournamentName: tournament.name,
                                                tournamentDate: pair.scheduledAt || tournament.date || null,
                                                stageLabel: pair.stage || `Stage ${stageIndex + 1}`,
                                                team1: pair.team1,
                                                team2: pair.team2,
                                                team1Avatar: avatarByNickname[pair.team1] || null,
                                                team2Avatar: avatarByNickname[pair.team2] || null,
                                                team1CountryCode: lookupCountryCode(pair.team1, countryLookup, team1Player),
                                                team2CountryCode: lookupCountryCode(pair.team2, countryLookup, team2Player),
                                                score1: ps1,
                                                score2: ps2,
                                                scheduledAt: pair.scheduledAt || null,
                                                type: pair.type,
                                                stageIndex,
                                                pairIndex,
                                                team1Place:
                                                    rankByNickname[pair.team1] ||
                                                    team1Player?.placeInLeaderboard ||
                                                    '-',
                                                team2Place:
                                                    rankByNickname[pair.team2] ||
                                                    team2Player?.placeInLeaderboard ||
                                                    '-',
                                                team1Prediction: pairPrediction.team1,
                                                team2Prediction: pairPrediction.team2,
                                                team1Stars: parseNumericValue(pair.stars1 ?? team1Player?.stars),
                                                team2Stars: parseNumericValue(pair.stars2 ?? team2Player?.stars),
                                                statusLabel: ps1 + ps2 > 0 ? 'Next map' : 'Upcoming'
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                    setLiveGames(liveGamesList);
                    setUpcomingMatches(upcomingList);

                    const playerName =
                        userNickName && userNickName !== 'undefined'
                            ? userNickName
                            : localStorage.getItem('userName');

                    if (playerName) {
                        setMyGames(
                            collectMyUpcomingMatches(data, playerName, {
                                avatarByNickname,
                                countryLookup,
                                rankByNickname
                            })
                        );
                    } else {
                        setMyGames([]);
                    }
                }
            } catch (error) {
                console.error('Error fetching tournaments:', error);
            }
        };

        fetchActiveTournaments();
    }, [userNickName]);

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
        if (!isAdmin && !isPlayerVisibleTournament(tournament)) {
            return false;
        }
        if (statusFilter === 'all') {
            return isAdmin;
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

    const hasActiveCup = activeTournaments.some((t) => t.status === 'Started!');
    const featuredCup =
        activeTournaments.find((t) => t.status === 'Started!') ||
        activeTournaments.find(
            (t) => t.status === 'Registration' || t.status === 'Registration Started'
        );
    const featuredPrizeLabel = featuredCup ? getTournamentPrizeLabel(featuredCup) : null;
    const previewUpcoming = upcomingMatches.slice(0, MATCH_CENTER_PREVIEW_LIMIT);
    const previewLive = liveGames.slice(0, MATCH_CENTER_PREVIEW_LIMIT);
    const featuredMatch = previewLive[0] ? { ...previewLive[0], variant: 'live' } : null;
    const remainingLive = previewLive.slice(1).map((match) => ({ ...match, variant: 'live' }));
    const remainingUpcoming = previewUpcoming;

    const getBracketLink = getTournamentMatchLink;

    const renderAnnouncementCard = (match, key, { featured = false } = {}) => (
        <MatchAnnouncementCard
            key={key}
            to={getBracketLink(match)}
            team1={match.team1}
            team2={match.team2}
            team1Avatar={match.team1Avatar}
            team2Avatar={match.team2Avatar}
            team1CountryCode={match.team1CountryCode}
            team2CountryCode={match.team2CountryCode}
            score1={match.score1}
            score2={match.score2}
            tournamentName={match.tournamentName}
            stageLabel={match.stageLabel}
            tournamentDate={match.tournamentDate}
            variant={match.variant || 'upcoming'}
            statusLabel={match.statusLabel}
            type={match.type}
            featured={featured}
            castle1Image={getCastleImage(match.castle1)}
            castle2Image={getCastleImage(match.castle2)}
            gameNumber={match.gameNumber}
            team1Stars={match.team1Stars}
            team2Stars={match.team2Stars}
            team1Prediction={match.team1Prediction}
            team2Prediction={match.team2Prediction}
        />
    );

    return (
        <section className={classes.starting}>
            {hasActiveCup && (
                <div className={`${classes.matchCenterSection} ${classes.homeSectionFirst}`}>
                    <div className={classes.sectionHeader}>
                        <div>
                            <h2 className={`${classes.sectionTitle} ${classes.matchCenterTitle}`}>Match center</h2>
                            <p className={classes.matchCenterSubtitle}>
                                Live cups and bracket fixtures
                                {featuredPrizeLabel && featuredCup && (
                                    <>
                                        {' '}
                                        ·{' '}
                                        <Link
                                            to={`/tournaments/homm3/${featuredCup.id}`}
                                            className={classes.prizeLink}
                                        >
                                            {featuredCup.name}: {featuredPrizeLabel}
                                        </Link>
                                    </>
                                )}
                            </p>
                        </div>
                        <div className={classes.matchCenterLinks}>
                            <Link to="/live" className={classes.viewAllLink}>
                                Open Live Arena
                            </Link>
                            <Link to="/tournaments/homm3?status=started" className={classes.viewAllLink}>
                                View all tournaments
                            </Link>
                        </div>
                    </div>

                    {featuredMatch ? (
                        <div className={classes.featuredAnnouncement}>
                            {renderAnnouncementCard(featuredMatch, 'featured-match', { featured: true })}
                            {remainingLive.length > 0 && (
                                <div className={classes.announcementList}>
                                    {remainingLive.map((match, index) =>
                                        renderAnnouncementCard(
                                            match,
                                            `live-${match.tournamentId}-${match.stageIndex}-${match.pairIndex}-${match.gameNumber || 0}-${index}`
                                        )
                                    )}
                                </div>
                            )}
                            {liveGames.length > MATCH_CENTER_PREVIEW_LIMIT && (
                                <Link to="/live" className={classes.viewMoreLink}>
                                    +{liveGames.length - MATCH_CENTER_PREVIEW_LIMIT} more live — Open Live Arena
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className={classes.emptyLive}>
                            <p className={classes.emptyLiveTitle}>No maps in progress</p>
                            <p className={classes.emptyLiveHint}>
                                Bracket matches will appear here when players start a map.
                            </p>
                        </div>
                    )}

                    <h3 className={classes.matchCenterLabel}>Upcoming bracket matches</h3>
                    {upcomingMatches.length > 0 ? (
                        remainingUpcoming.length > 0 ? (
                            <>
                                <div className={classes.announcementList}>
                                    {remainingUpcoming.map((match, index) =>
                                        renderAnnouncementCard(
                                            { ...match, variant: 'upcoming' },
                                            `upcoming-${match.tournamentId}-${match.stageIndex}-${match.pairIndex}-${index}`
                                        )
                                    )}
                                </div>
                                {upcomingMatches.length > MATCH_CENTER_PREVIEW_LIMIT && (
                                    <Link to="/tournaments/homm3?status=started" className={classes.viewMoreLink}>
                                        +{upcomingMatches.length - MATCH_CENTER_PREVIEW_LIMIT} more upcoming — view
                                        brackets
                                    </Link>
                                )}
                            </>
                        ) : null
                    ) : (
                        <div className={classes.emptyUpcoming}>
                            <p className={classes.emptyLiveTitle}>No upcoming fixtures</p>
                            <p className={classes.emptyLiveHint}>Open brackets to see who plays next.</p>
                        </div>
                    )}

                    <div className={classes.prizePoolWrap}>
                        <PrizePoolPanel compact />
                    </div>
                </div>
            )}

            {isLogged && (
                <MyUpcomingMatchesSection
                    matches={myGames}
                    title="My upcoming matches"
                    className={classes.homeSection}
                />
            )}

            {activeTournaments.length > 0 && (
                <div className={`${classes.tournamentsSection} ${classes.homeSection}`}>
                    <div className={classes.sectionHeader}>
                        <h2 className={`${classes.sectionTitle} ${classes.sectionTitleLines}`}>Active tournaments</h2>
                        <select
                            className={classes.statusFilter}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            {isAdmin && <option value="all">All tournaments</option>}
                            <option value="registration">Registration open</option>
                            <option value="started">In progress</option>
                            <option value="live">Live games</option>
                            {isAdmin && <option value="finished">Finished</option>}
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
                                {getTournamentPrizeLabel(tournament) && (
                                    <div className={classes.tournamentPrize}>
                                        {getTournamentPrizeLabel(tournament)}
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <div className={classes.homeSection}>
                <DonationLeaderboard limit={5} supportLink />
            </div>

        </section>
    );
};

export default StartingPageContent;
