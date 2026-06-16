import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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
import MatchAnnouncementCard from '../MatchAnnouncement/MatchAnnouncementCard';
import PrizePoolPanel from '../PrizePoolPanel/PrizePoolPanel';
import { buildCountryLookup, lookupCountryCode } from '../../utils/country';
import { isPublicTournament } from '../../utils/tournamentVisibility';
import { buildMatchStageLabel } from '../../utils/matchFixtureLabels';
import { getMatchCenterLink } from '../../utils/matchCenterRoute';
import { getTournamentMatchLink } from '../../utils/tournamentBracketNavigation';
import { getHeadToHeadPrediction } from '../../utils/matchPredictions';
import { isGameSessionActive, isPairLive, hasScheduledAt } from '../../utils/matchCenterData';
import classes from './StartingPageContent.module.css';

const MATCH_CENTER_PREVIEW_LIMIT = 5;

const StartingPageContent = () => {
    const [liveGames, setLiveGames] = useState([]);
    const [upcomingMatches, setUpcomingMatches] = useState([]);

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

    useEffect(() => {
        const fetchActiveTournaments = async () => {
            try {
                const response = await fetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3.json`);
                const data = await response.json();

                const usersResponse = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
                const usersData = await usersResponse.json();
                const historyResponse = await fetch(`${FIREBASE_DATABASE_URL}/games/heroes3.json`);
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

                                        const bestOf = pair.type === 'bo-5' ? 5 : pair.type === 'bo-3' ? 3 : 1;
                                        const reqWins = Math.floor(bestOf / 2) + 1;
                                        const ps1 = Number(pair.score1) || 0;
                                        const ps2 = Number(pair.score2) || 0;
                                        const seriesDone =
                                            ps1 >= reqWins ||
                                            ps2 >= reqWins ||
                                            pair.winner ||
                                            pair.gameStatus === 'Processed';
                                        const team1Ready = pair.team1 && pair.team1 !== 'TBD' && pair.team1 !== 'null';
                                        const team2Ready = pair.team2 && pair.team2 !== 'TBD' && pair.team2 !== 'null';
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

                                        const pairIsLive = isPairLive(pair);
                                        const activeGame = (pair.games || []).find(isGameSessionActive) || null;

                                        if (pairIsLive && !seriesDone && team1Ready && team2Ready) {
                                            const game = activeGame;
                                            liveGamesList.push({
                                                tournamentId,
                                                tournamentName: tournament.name,
                                                tournamentType: tournament.type || null,
                                                tournamentDate: tournament.date || null,
                                                stageLabel: buildMatchStageLabel(tournament, pair, stageIndex),
                                                team1: pair.team1,
                                                team2: pair.team2,
                                                team1Avatar: avatarByNickname[pair.team1] || null,
                                                team2Avatar: avatarByNickname[pair.team2] || null,
                                                team1CountryCode: lookupCountryCode(
                                                    pair.team1,
                                                    countryLookup,
                                                    team1Player
                                                ),
                                                team2CountryCode: lookupCountryCode(
                                                    pair.team2,
                                                    countryLookup,
                                                    team2Player
                                                ),
                                                score1: pair.score1 || 0,
                                                score2: pair.score2 || 0,
                                                type: pair.type,
                                                stageIndex,
                                                pairIndex,
                                                castle1: game?.castle1 || null,
                                                castle2: game?.castle2 || null,
                                                color1: game?.color1 || pair.color1 || 'red',
                                                color2: game?.color2 || pair.color2 || 'blue',
                                                gameNumber: game ? (game.gameId || 0) + 1 : ps1 + ps2 + 1,
                                                team1Stars: parseNumericValue(pair.stars1 ?? team1Player?.stars),
                                                team2Stars: parseNumericValue(pair.stars2 ?? team2Player?.stars),
                                                team1Place:
                                                    rankByNickname[pair.team1] ||
                                                    team1Player?.placeInLeaderboard ||
                                                    '-',
                                                team2Place:
                                                    rankByNickname[pair.team2] ||
                                                    team2Player?.placeInLeaderboard ||
                                                    '-',
                                                team1Rating: parseNumericValue(pair.ratings1 ?? team1Player?.ratings),
                                                team2Rating: parseNumericValue(pair.ratings2 ?? team2Player?.ratings),
                                                team1Prediction: pairPrediction.team1,
                                                team2Prediction: pairPrediction.team2,
                                                gold1: game?.gold1 || 0,
                                                gold2: game?.gold2 || 0,
                                                restart1_111: game?.restart1_111 || 0,
                                                restart1_112: game?.restart1_112 || 0,
                                                restart2_111: game?.restart2_111 || 0,
                                                restart2_112: game?.restart2_112 || 0,
                                                restartsFinished: Boolean(game?.restartsFinished),
                                                scheduledAt: pair.scheduledAt || null,
                                                statusLabel: 'Live'
                                            });
                                        }

                                        if (
                                            !seriesDone &&
                                            team1Ready &&
                                            team2Ready &&
                                            !pairIsLive &&
                                            hasScheduledAt(pair)
                                        ) {
                                            upcomingList.push({
                                                tournamentId,
                                                tournamentName: tournament.name,
                                                tournamentType: tournament.type || null,
                                                tournamentDate: pair.scheduledAt || null,
                                                stageLabel: buildMatchStageLabel(tournament, pair, stageIndex),
                                                team1: pair.team1,
                                                team2: pair.team2,
                                                team1Avatar: avatarByNickname[pair.team1] || null,
                                                team2Avatar: avatarByNickname[pair.team2] || null,
                                                team1CountryCode: lookupCountryCode(
                                                    pair.team1,
                                                    countryLookup,
                                                    team1Player
                                                ),
                                                team2CountryCode: lookupCountryCode(
                                                    pair.team2,
                                                    countryLookup,
                                                    team2Player
                                                ),
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
                }
            } catch (error) {
                console.error('Error fetching tournaments:', error);
            }
        };

        fetchActiveTournaments();
    }, []);

    const previewUpcoming = upcomingMatches.slice(0, MATCH_CENTER_PREVIEW_LIMIT);
    const previewLive = liveGames.slice(0, MATCH_CENTER_PREVIEW_LIMIT).map((match) => ({ ...match, variant: 'live' }));
    const remainingUpcoming = previewUpcoming;

    const getBracketLink = getTournamentMatchLink;

    const renderAnnouncementCard = (match, key) => (
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
            tournamentType={match.tournamentType}
            stageLabel={match.stageLabel}
            tournamentDate={match.tournamentDate}
            variant={match.variant || 'upcoming'}
            statusLabel={match.statusLabel}
            type={match.type}
            compact
            castle1Image={getCastleImage(match.castle1)}
            castle2Image={getCastleImage(match.castle2)}
            gameNumber={match.gameNumber}
            team1Stars={match.team1Stars}
            team2Stars={match.team2Stars}
            team1Prediction={match.team1Prediction}
            team2Prediction={match.team2Prediction}
            matchCenterUrl={getMatchCenterLink(match)}
        />
    );

    return (
        <section className={classes.starting}>
            <div className={classes.homeLayout}>
                <div className={classes.homeMain}>
                    <div className={`${classes.matchCenterSection} ${classes.homeSectionFirst}`}>
                        <div className={classes.sectionHeader}>
                            <div>
                                <h2 className={`${classes.sectionTitle} ${classes.matchCenterTitle}`}>Match center</h2>
                                <p className={classes.matchCenterSubtitle}>
                                    Live tournament games and bracket fixtures
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

                        {previewLive.length > 0 ? (
                            <>
                                <div className={classes.announcementList}>
                                    {previewLive.map((match, index) =>
                                        renderAnnouncementCard(
                                            match,
                                            `live-${match.tournamentId}-${match.stageIndex}-${match.pairIndex}-${match.gameNumber || 0}-${index}`
                                        )
                                    )}
                                </div>
                                {liveGames.length > MATCH_CENTER_PREVIEW_LIMIT && (
                                    <Link to="/live" className={classes.viewMoreLink}>
                                        +{liveGames.length - MATCH_CENTER_PREVIEW_LIMIT} more live — Open Live Arena
                                    </Link>
                                )}
                            </>
                        ) : (
                            <div className={classes.emptyLive}>
                                <p className={classes.emptyLiveTitle}>No live games in progress</p>
                                <p className={classes.emptyLiveHint}>
                                    Matches will appear here when players start a game.
                                </p>
                            </div>
                        )}

                        <h3 className={classes.matchCenterLabel}>Upcoming matches</h3>
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
                                        <Link to="/live" className={classes.viewMoreLink}>
                                            +{upcomingMatches.length - MATCH_CENTER_PREVIEW_LIMIT} more upcoming — Open
                                            Live Arena
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
                    </div>
                </div>

                <aside className={classes.homeSidebar} aria-label="Tournament prize pools">
                    <PrizePoolPanel compact />
                </aside>
            </div>
        </section>
    );
};

export default StartingPageContent;
