import { useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { FIREBASE_DATABASE_URL } from '../../config/firebase';

import MatchAnnouncementCard from '../MatchAnnouncement/MatchAnnouncementCard';

import { fetchTwitchLiveLogins } from '../../api/twitchStreams';

import { fetchMatchCenterMatches } from '../../utils/matchCenterData';

import { enrichMatchWithPrediction } from '../../utils/matchPredictions';

import { getMatchCenterLink } from '../../utils/matchCenterRoute';

import { getTournamentMatchLink } from '../../utils/tournamentBracketNavigation';

import { pickMatchStreamLogin } from '../../utils/twitchUtils';

import TwitchEmbed from './TwitchEmbed';

import classes from './LiveArenaPage.module.css';

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



const getMatchKey = (match) =>

    `${match.tournamentId}-${match.stageIndex}-${match.pairIndex}-${match.gameNumber || 0}`;



const LiveArenaPage = () => {

    const [liveGames, setLiveGames] = useState([]);

    const [upcomingMatches, setUpcomingMatches] = useState([]);

    const [gamesHistory, setGamesHistory] = useState({});

    const [liveLogins, setLiveLogins] = useState(new Set());

    const [loading, setLoading] = useState(true);



    useEffect(() => {

        let cancelled = false;



        const load = async () => {

            setLoading(true);

            try {

                const [matchCenterResult, historyResponse] = await Promise.all([

                    fetchMatchCenterMatches(),

                    fetch(`${FIREBASE_DATABASE_URL}/games/heroes3.json`)

                ]);



                if (cancelled) {

                    return;

                }



                const { liveGames: live, upcomingMatches: upcoming } = matchCenterResult;

                const historyData = historyResponse.ok ? await historyResponse.json() : {};



                setLiveGames(live);

                setUpcomingMatches(upcoming);

                setGamesHistory(historyData || {});



                const logins = [...live, ...upcoming].flatMap((match) => [

                    match.commentatorStreamLogin,

                    match.streamLogin,

                    match.team1TwitchLogin,

                    match.team2TwitchLogin

                ]);

                const liveSet = await fetchTwitchLiveLogins(logins);

                if (!cancelled) {

                    setLiveLogins(liveSet);

                }

            } catch (error) {

                console.error('Failed to load Live Arena:', error);

            } finally {

                if (!cancelled) {

                    setLoading(false);

                }

            }

        };



        load();

        const interval = setInterval(load, 120000);



        return () => {

            cancelled = true;

        };

    }, []);



    const featuredMatch = useMemo(() => {

        const onAirLive = liveGames.find((match) => {

            const login = pickMatchStreamLogin(match, liveLogins);

            return login && liveLogins.has(login);

        });

        if (onAirLive) {

            return onAirLive;

        }

        return liveGames[0] || null;

    }, [liveGames, liveLogins]);



    const featuredMatchKey = featuredMatch ? getMatchKey(featuredMatch) : null;

    const featuredChannel = featuredMatch ? pickMatchStreamLogin(featuredMatch, liveLogins) : null;



    const otherLiveGames = useMemo(

        () => liveGames.filter((match) => getMatchKey(match) !== featuredMatchKey),

        [liveGames, featuredMatchKey]

    );



    const getBracketLink = getTournamentMatchLink;



    const renderMatchCard = (match, key, { featured = false } = {}) => {

        const enriched = enrichMatchWithPrediction(match, gamesHistory);

        const streamLogin = pickMatchStreamLogin(enriched, liveLogins);

        const matchCenterUrl = getMatchCenterLink(enriched);



        return (

            <MatchAnnouncementCard

                key={key}

                to={getBracketLink(enriched)}

                team1={enriched.team1}

                team2={enriched.team2}

                team1Avatar={enriched.team1Avatar}

                team2Avatar={enriched.team2Avatar}

                team1CountryCode={enriched.team1CountryCode}

                team2CountryCode={enriched.team2CountryCode}

                score1={enriched.score1}

                score2={enriched.score2}

                tournamentName={enriched.tournamentName}

                tournamentType={enriched.tournamentType}

                stageLabel={enriched.stageLabel}

                tournamentDate={enriched.scheduledAt || enriched.tournamentDate}

                variant={enriched.variant || 'upcoming'}

                statusLabel={enriched.statusLabel}

                type={enriched.type}

                featured={featured}

                compact={!featured}

                gameNumber={enriched.gameNumber}

                team1Stars={enriched.team1Stars}

                team2Stars={enriched.team2Stars}

                team1Prediction={enriched.team1Prediction}

                team2Prediction={enriched.team2Prediction}

                castle1Image={getCastleImage(enriched.castle1)}

                castle2Image={getCastleImage(enriched.castle2)}

                matchCenterUrl={matchCenterUrl}

                streamLive={Boolean(streamLogin && liveLogins.has(streamLogin))}

            />

        );

    };



    const featuredCard = featuredMatch

        ? renderMatchCard(

              featuredMatch,

              `featured-${getMatchKey(featuredMatch)}`,

              { featured: true }

          )

        : null;



    return (

        <section className={classes.page}>

            <header className={classes.header}>

                <div>

                    <h1 className={classes.title}>Live Arena</h1>

                    <p className={classes.subtitle}>Cup fixtures, live maps, and Twitch broadcasts.</p>

                </div>

                <Link to="/tournaments/homm3?status=started" className={classes.viewAllLink}>

                    All tournaments

                </Link>

            </header>



            {loading ? (

                <p className={classes.loading}>Loading fixtures and streams…</p>

            ) : (

                <>

                    <div className={classes.featuredBlock}>

                        {featuredChannel ? (

                            <TwitchEmbed

                                channel={featuredChannel}

                                title={`${featuredMatch?.team1} vs ${featuredMatch?.team2}`}

                            />

                        ) : (

                            <div className={classes.embedPlaceholder}>

                                <p className={classes.embedPlaceholderTitle}>No Twitch broadcast detected</p>

                                <p className={classes.embedPlaceholderText}>

                                    When a registered player goes live on Twitch during a cup match, their stream

                                    appears here. Link your Twitch account via sign-in to enable Watch buttons.

                                </p>

                            </div>

                        )}



                        {featuredCard && <div className={classes.featuredCardWrap}>{featuredCard}</div>}

                    </div>



                    <div className={classes.section}>

                        <h2 className={classes.sectionTitle}>Live maps</h2>

                        {otherLiveGames.length === 0 ? (

                            <p className={classes.empty}>

                                {liveGames.length === 0

                                    ? 'No live games in progress right now.'

                                    : 'Featured match shown above.'}

                            </p>

                        ) : (

                            <div className={classes.matchCardGrid}>

                                {otherLiveGames.map((match) =>

                                    renderMatchCard(

                                        match,

                                        `live-map-${getMatchKey(match)}`

                                    )

                                )}

                            </div>

                        )}

                    </div>



                    <div className={classes.section}>

                        <h2 className={classes.sectionTitle}>Upcoming fixtures</h2>

                        {upcomingMatches.length === 0 ? (

                            <p className={classes.empty}>No scheduled bracket matches in active cups.</p>

                        ) : (

                            <div className={classes.matchCardGrid}>

                                {upcomingMatches.map((match) =>

                                    renderMatchCard(

                                        match,

                                        `upcoming-${getMatchKey(match)}`

                                    )

                                )}

                            </div>

                        )}

                    </div>

                </>

            )}

        </section>

    );

};



export default LiveArenaPage;

