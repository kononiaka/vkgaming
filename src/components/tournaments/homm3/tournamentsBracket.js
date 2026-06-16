import { useEffect, useState, useContext, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { stripUiFields, moveProgressFieldsToNested } from './progress/gameProgressApi';
import { updateGameStatusForPartialProgress } from './progress/gameStatusUtils';
import {
    addScoreToUser,
    getNewRating,
    getPlayerPrizeTotal,
    loadUserById,
    lookForTournamentName,
    lookForUserId,
    lookForUserPrevScore,
    pullTournamentPrizes,
    fetchCastlesList,
    calculateStarsFromRating,
    snapshotLeaderboardRanks,
    getPairProgress,
    savePairProgress,
    updatePairProgressStage,
    updatePairProgressCastle
} from '../../../api/api';
import { shuffleArray } from '../../tournaments/tournament_api';
import { PlayerBracket } from './PlayerBracket/PlayerBracket';
import StatsPopup from '../../StatsPopup/StatsPopup';
import SpinningWheel from '../../SpinningWheel/SpinningWheel';
import Modal from '../../Modal/Modal.js';
import ReportGameModal from './ReportGameModal';
import LeagueBracket from './LeagueBracket';
import { generateNextSwissRoundPairings, isSwissRoundComplete, normalizeGameType } from './swissUtils';
import { dropLoserToBracket, promoteLoserBracketWinner } from './loserBracketUtils';
import {
    generateKnockoutBracketStages,
    getGroupLabels,
    getKnockoutPlayerCount,
    getQualifiedPlayers,
    isChampionsLeagueGroupStageComplete,
    isGroupDrawGridComplete,
    prepareChampionsLeagueFromDrawGrid,
    prepareChampionsLeagueGroupStage
} from './championsLeagueUtils';
import { setStageLabels as computeStageLabels } from '../../tournaments/tournament_api';
import MatchScheduleControl from './MatchScheduleControl';
import AuthContext from '../../../store/auth-context';
import { FIREBASE_DATABASE_URL } from '../../../config/firebase';
import {
    calculateAvailableCastlesFromBracket,
    inferScheduleView,
    normalizePlayoffPairs
} from '../../../utils/tournamentBracketNavigation';
import { fetchHeadToHeadStats } from '../../../utils/headToHeadStats';
import { authFetch } from '../../../api/authFetch';
import classes from './tournamentsBracket.module.css';
import { getCastleImage } from '../../../utils/castleImages';
import TournamentPlayerChip from './TournamentPlayerChip';
import chipClasses from './TournamentPlayerChip.module.css';

const uniquePlayerNames = [];
let isManualScore = false;
let clickedRadioButton;
let playersObj = {};
let tournamentName = null;

const normalizeMatchType = (rawType) => {
    const normalized = String(rawType ?? '')
        .toLowerCase()
        .trim();
    if (normalized === 'bo-5' || normalized === '5' || normalized === 'bo5') {
        return 'bo-5';
    }
    if (normalized === 'bo-3' || normalized === '3' || normalized === 'bo3') {
        return 'bo-3';
    }
    return 'bo-1';
};

const getBestOfValue = (matchType) => {
    const normalized = normalizeMatchType(matchType);
    return Number(normalized.split('-')[1]) || 1;
};

const MOBILE_KNOCKOUT_MQ = '(max-width: 768px)';

const getKnockoutPaginationStages = (labels, isMobileView) => {
    const allDisplayStages = labels.filter((s) => s !== 'Third Place');
    if (isMobileView) {
        return allDisplayStages;
    }
    return allDisplayStages.length > 1 ? allDisplayStages.slice(0, -1) : allDisplayStages;
};

const useMobileKnockoutView = () => {
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(MOBILE_KNOCKOUT_MQ).matches
    );

    useEffect(() => {
        const mq = window.matchMedia(MOBILE_KNOCKOUT_MQ);
        const onChange = (event) => setIsMobile(event.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    return isMobile;
};

// Chains ELO across every played game in a series and returns the final ratings.
// Each game's result updates both running ratings before the next game is evaluated.
// Falls back to a single series-level calculation when no individual game data is available.
const calcSeriesRatings = (startRating1, startRating2, team1Name, team2Name, games, didWin1Fallback) => {
    const playedGames = Array.isArray(games) ? games.filter((g) => g.gameWinner && g.gameWinner !== '') : [];

    if (playedGames.length === 0) {
        return {
            r1: getNewRating(startRating1, startRating2, didWin1Fallback),
            r2: getNewRating(startRating2, startRating1, !didWin1Fallback)
        };
    }

    let r1 = startRating1;
    let r2 = startRating2;
    for (const game of playedGames) {
        const next1 = getNewRating(r1, r2, game.gameWinner === team1Name);
        const next2 = getNewRating(r2, r1, game.gameWinner === team2Name);
        r1 = next1;
        r2 = next2;
    }
    return { r1, r2 };
};

const buildMatchKey = (gameData, tournamentId) => {
    const normalize = (value) =>
        String(value ?? '')
            .trim()
            .toLowerCase();

    const gamesDigest = Array.isArray(gameData.games)
        ? gameData.games
              .map(
                  (g) =>
                      `${g.gameId ?? ''}:${normalize(g.gameWinner)}:${normalize(g.castle1)}:${normalize(g.castle2)}:${g.gold1 ?? 0}:${g.gold2 ?? 0}`
              )
              .join(';')
        : '';

    const rawKey = [
        normalize(tournamentId),
        normalize(gameData.tournamentName),
        normalize(gameData.gameType),
        normalize(gameData.opponent1),
        normalize(gameData.opponent2),
        normalize(gameData.score),
        normalize(gameData.winner),
        gamesDigest
    ].join('|');

    return encodeURIComponent(rawKey);
};

export const TournamentBracket = ({
    maxPlayers,
    tournamentId,
    tournamentStatus,
    tournamentWinners,
    fullScreen = false,
    strictCastlePick = false
}) => {
    const setDetailedProgressStage = (stage, extra = {}) => {
        setPlayoffPairs((prevPairs) => {
            const updatedPairs = [...prevPairs];
            const pair = updatedPairs[selectedStageIndex]?.[selectedPairIndex];
            if (pair) {
                pair.detailedStage = stage;
                Object.assign(pair, extra);
            }
            return updatedPairs;
        });
    };
    const authCtx = useContext(AuthContext);
    const [stageLabels, setStageLabels] = useState([]);
    const [playoffPairs, setPlayoffPairs] = useState([]);
    const [startTournament, setStartTournament] = useState(false);
    const reportDismissedRef = useRef(false);
    const [showCastlesModal, setShowCastlesModal] = useState(false);
    const [availableCastles, setAvailableCastles] = useState([]);
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [isSpinningWheelOpen, setIsSpinningWheelOpen] = useState(false);
    const [spinningWheelMode, setSpinningWheelMode] = useState('kickoff');
    const [isLeague, setIsLeague] = useState(false);
    const [isSwiss, setIsSwiss] = useState(false);
    const [hasLoserBracket, setHasLoserBracket] = useState(false);
    const [isChampionsLeague, setIsChampionsLeague] = useState(false);
    const [championsLeaguePhase, setChampionsLeaguePhase] = useState('group');
    const [championsGroups, setChampionsGroups] = useState({});
    const [championsGroupLabels, setChampionsGroupLabels] = useState([]);
    const [swissCurrentRound, setSwissCurrentRound] = useState(1);
    const [swissTotalRounds, setSwissTotalRounds] = useState(0);
    const [usesScheduleView, setUsesScheduleView] = useState(false);
    const [registeredPlayerNames, setRegisteredPlayerNames] = useState([]);
    const [showReportGameModal, setShowReportGameModal] = useState(false);
    const [selectedStageIndex, setSelectedStageIndex] = useState(null);
    const [selectedPairIndex, setSelectedPairIndex] = useState(null);
    const [selectedPairId, setSelectedPairId] = useState(null);
    const [selectedInitialGameId, setSelectedInitialGameId] = useState(null);
    const [activeBracketStage, setActiveBracketStage] = useState(0);
    const isMobileKnockoutView = useMobileKnockoutView();
    const [, setDisplayName] = useState('');
    const [urlHighlightPair, setUrlHighlightPair] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const highlightedPairRef = useRef(null);
    const lastTournamentIdRef = useRef(null);

    useEffect(() => {
        if (lastTournamentIdRef.current !== tournamentId) {
            reportDismissedRef.current = false;
            lastTournamentIdRef.current = tournamentId;
        }
        setShowReportGameModal(false);
        setSelectedStageIndex(null);
        setSelectedPairIndex(null);
        setSelectedPairId(null);
        setSelectedInitialGameId(null);
        setUrlHighlightPair(null);
        setIsLeague(false);
        setIsSwiss(false);
        setIsChampionsLeague(false);
        setChampionsLeaguePhase('group');
        setUsesScheduleView(false);
        setPlayoffPairs([]);
        setStageLabels([]);
        setActiveBracketStage(0);
    }, [tournamentId]);

    const resolveKnockoutDisplayStage = (storageStageIdx, labels, isMobileView = false) => {
        const allDisplayStages = labels.filter((s) => s !== 'Third Place');
        const displayStages = getKnockoutPaginationStages(labels, isMobileView);
        if (displayStages.length === 0) {
            return 0;
        }

        const label = labels[storageStageIdx];
        if (!label) {
            return Math.min(storageStageIdx, displayStages.length - 1);
        }
        if (label === 'Final' || label === 'Third Place') {
            if (isMobileView) {
                const finalIdx = allDisplayStages.indexOf('Final');
                return finalIdx !== -1 ? finalIdx : displayStages.length - 1;
            }
            return displayStages.length - 1;
        }

        const direct = displayStages.indexOf(label);
        if (direct !== -1) {
            return direct;
        }

        for (let i = 0; i < displayStages.length; i++) {
            const nextLabel =
                displayStages[i + 1] ??
                (allDisplayStages.length > displayStages.length ? allDisplayStages[allDisplayStages.length - 1] : null);
            if (nextLabel === label) {
                return i;
            }
        }

        return Math.min(storageStageIdx, displayStages.length - 1);
    };

    // Auto-navigate to the stage+pair indicated by URL params (from Match Center / Live Arena)
    useEffect(() => {
        const stageParam = searchParams.get('stage');
        const pairParam = searchParams.get('pair');
        if (stageParam === null || pairParam === null || playoffPairs.length === 0) {
            return;
        }

        const targetStageIndex = Number(stageParam);
        const targetPairIndex = Number(pairParam);

        highlightedPairRef.current = { stageIndex: targetStageIndex, pairIndex: targetPairIndex };
        setUrlHighlightPair({ stageIndex: targetStageIndex, pairIndex: targetPairIndex });

        if (!usesScheduleView) {
            if (stageLabels.length === 0) {
                return;
            }

            const clKnockoutOffset = isChampionsLeague && championsLeaguePhase === 'knockout' ? 1 : 0;
            const labelStageIndex = targetStageIndex - clKnockoutOffset;
            setActiveBracketStage(resolveKnockoutDisplayStage(labelStageIndex, stageLabels, isMobileKnockoutView));
        }

        const timer = setTimeout(() => {
            const el = document.getElementById(`pair-s${targetStageIndex}-p${targetPairIndex}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 400);

        // Only open the report dialog when explicitly requested (?report=1)
        const reportParam = searchParams.get('report');
        if (reportParam === '1' && !reportDismissedRef.current) {
            const pair = playoffPairs[targetStageIndex]?.[targetPairIndex];
            if (
                pair &&
                pair.team1 !== 'TBD' &&
                pair.team2 !== 'TBD' &&
                pair.team1 &&
                pair.team2 &&
                pair.gameStatus !== 'Processed' &&
                canReportGameForPair(pair)
            ) {
                const pairId = `${tournamentId}_s${targetStageIndex}_p${targetPairIndex}`;
                setSelectedPairId(pairId);
                if (pair.gameStatus !== 'PartiallyProcessed') {
                    savePairProgress(tournamentId, pairId, null);
                }
                const gameParam = searchParams.get('game');
                setSelectedInitialGameId(gameParam !== null ? Number(gameParam) : null);
                setSelectedStageIndex(targetStageIndex);
                setSelectedPairIndex(targetPairIndex);
                setShowReportGameModal(true);
            }
        }

        return () => clearTimeout(timer);
    }, [
        searchParams,
        stageLabels,
        playoffPairs,
        tournamentId,
        isLeague,
        isSwiss,
        isChampionsLeague,
        championsLeaguePhase,
        usesScheduleView,
        isMobileKnockoutView
    ]);

    const normalizeName = (value) =>
        String(value || '')
            .trim()
            .toLowerCase();
    const canViewReportButtonForPair = (pair) => {
        if (!pair) {
            return false;
        }

        if (authCtx.isAdmin) {
            return true;
        }

        const currentUser = normalizeName(authCtx.userNickName);
        if (!currentUser) {
            return false;
        }

        return currentUser === normalizeName(pair.team1) || currentUser === normalizeName(pair.team2);
    };

    const canReportGameForPair = (pair) => {
        if (!canViewReportButtonForPair(pair)) {
            return false;
        }

        // Once processed, only admins can re-report.
        if (pair.gameStatus === 'Processed') {
            return Boolean(authCtx.isAdmin);
        }

        return true;
    };

    const canSchedulePairForPair = (pair) => {
        if (!pair || !canViewReportButtonForPair(pair)) {
            return false;
        }
        if (pair.winner || pair.gameStatus === 'Processed') {
            return false;
        }
        if (pair.team1 === 'TBD' || pair.team2 === 'TBD' || !pair.team1 || !pair.team2) {
            return false;
        }
        return true;
    };

    const getCurrentRating = (ratings) => {
        if (typeof ratings === 'string' && ratings.includes(',')) {
            return parseFloat(parseFloat(ratings.split(',').at(-1)).toFixed(2));
        }

        return ratings ? parseFloat(Number(ratings).toFixed(2)) : 0;
    };

    const recalculatePlayerStars = async ({ attendeeNames = null } = {}) => {
        const usersResponse = await authFetch(`${FIREBASE_DATABASE_URL}/users.json`);
        const usersData = await usersResponse.json();

        const allPlayers = Object.entries(usersData || {})
            .map(([id, userData]) => ({
                id,
                name: userData.enteredNickname || userData.name,
                ratings: getCurrentRating(userData.ratings)
            }))
            .filter((player) => player.name && player.ratings > 0)
            .sort((a, b) => b.ratings - a.ratings);

        if (allPlayers.length === 0) {
            return { updatedCount: 0 };
        }

        const highestRating = allPlayers[0].ratings;
        const lowestRating = Math.min(...allPlayers.map((player) => player.ratings));
        const playersToUpdate = attendeeNames
            ? allPlayers.filter((player) => attendeeNames.includes(player.name))
            : allPlayers;

        for (const player of playersToUpdate) {
            const newStars = calculateStarsFromRating(player.ratings, highestRating, lowestRating);

            await authFetch(`${FIREBASE_DATABASE_URL}/users/${player.id}.json`, {
                method: 'PATCH',
                body: JSON.stringify({ stars: newStars }),
                headers: { 'Content-Type': 'application/json' }
            });

            console.log(`Updated ${player.name}: ${player.ratings} rating -> ${newStars} stars`);
        }

        return {
            updatedCount: playersToUpdate.length,
            highestRating,
            lowestRating
        };
    };

    // Determine the stage label based on the number of max players
    //TODO when there is a winner move him to the prior stage
    useEffect(() => {
        let labels = [];
        const fetchData = async () => {
            const tournamentResponseName = await lookForTournamentName(tournamentId);

            tournamentName = tournamentResponseName.name;
            setDisplayName(tournamentResponseName.name);
        };

        fetchData();

        const loadStageLabels = async () => {
            try {
                const [loserBracketRes, stageLabelsRes] = await Promise.all([
                    authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/loserBracket.json`),
                    authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/stageLabels.json`)
                ]);

                if (loserBracketRes.ok) {
                    const loserBracketEnabled = await loserBracketRes.json();
                    setHasLoserBracket(loserBracketEnabled === true);
                }

                if (stageLabelsRes.ok) {
                    const storedLabels = await stageLabelsRes.json();
                    if (Array.isArray(storedLabels) && storedLabels.length > 0) {
                        setStageLabels(storedLabels);
                        return;
                    }
                }
            } catch (error) {
                console.error('Failed to load tournament stage labels:', error);
            }

            if (+maxPlayers === 4) {
                labels = ['Semi-final', 'Third Place', 'Final'];
            } else if (+maxPlayers === 8) {
                labels = ['Quarter-final', 'Semi-final', 'Third Place', 'Final'];
            } else if (+maxPlayers === 16) {
                labels = ['1/8 Final', 'Quarter-final', 'Semi-final', 'Third Place', 'Final'];
            } else if (+maxPlayers === 32) {
                labels = ['1/16 Final', '1/8 Final', 'Quarter-final', 'Semi-final', 'Third Place', 'Final'];
            }

            setStageLabels(labels);
        };

        loadStageLabels();

        const fetchPlayoffPairs = async () => {
            let typeData = null;
            let resolvedChampionsPhase = 'group';

            try {
                // Detect league tournament type from tournament root
                const typeResponse = await authFetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/type.json`
                );
                if (typeResponse.ok) {
                    typeData = await typeResponse.json();
                    if (typeData === 'league') {
                        setIsLeague(true);
                    }
                    if (typeData === 'champions-league') {
                        setIsChampionsLeague(true);

                        const [phaseRes, groupsRes] = await Promise.all([
                            authFetch(
                                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/championsLeaguePhase.json`
                            ),
                            authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/groups.json`)
                        ]);

                        if (phaseRes.ok) {
                            const phase = await phaseRes.json();
                            if (phase === 'group' || phase === 'knockout') {
                                resolvedChampionsPhase = phase;
                                setChampionsLeaguePhase(phase);
                            }
                        }

                        if (groupsRes.ok) {
                            const groups = await groupsRes.json();
                            if (groups && typeof groups === 'object') {
                                setChampionsGroups(groups);
                                setChampionsGroupLabels(getGroupLabels(Object.keys(groups).length));
                            }
                        }
                    }
                    if (typeData === 'swiss') {
                        setIsSwiss(true);

                        const [currentRoundRes, totalRoundsRes] = await Promise.all([
                            authFetch(
                                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/swissCurrentRound.json`
                            ),
                            authFetch(
                                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/swissTotalRounds.json`
                            )
                        ]);

                        if (currentRoundRes.ok) {
                            const currentRound = await currentRoundRes.json();
                            if (Number.isFinite(Number(currentRound))) {
                                setSwissCurrentRound(Number(currentRound));
                            }
                        }

                        if (totalRoundsRes.ok) {
                            const totalRounds = await totalRoundsRes.json();
                            if (Number.isFinite(Number(totalRounds))) {
                                setSwissTotalRounds(Number(totalRounds));
                            }
                        }
                    }
                }

                // Fetch registered players for pre-start standings
                const playersResponse = await authFetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/players.json`
                );
                if (playersResponse.ok) {
                    const playersData = await playersResponse.json();
                    if (playersData) {
                        playersObj = playersData;
                        const names = Object.values(playersData)
                            .map((p) => p && p.name)
                            .filter((name) => name && name.trim() !== 'TBD');
                        setRegisteredPlayerNames(names);
                    }
                }

                const bracketResponse = await authFetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/bracket/.json`
                );

                if (bracketResponse.ok) {
                    const data = await bracketResponse.json();
                    if (data) {
                        const valuesArray = Object.values(data);

                        let playoffPairsDetermined = data?.playoffPairs;
                        if (!playoffPairsDetermined) {
                            playoffPairsDetermined = valuesArray[0]?.playoffPairs;
                        }

                        const normalizedPairs = normalizePlayoffPairs(playoffPairsDetermined);

                        for (const round of normalizedPairs) {
                            if (!Array.isArray(round)) {
                                continue;
                            }
                            for (const pair of round) {
                                if (pair.games && Array.isArray(pair.games)) {
                                    pair.games = pair.games.map((g) => {
                                        if (g && g.progress) {
                                            const {
                                                restoreProgressFieldsFromNested
                                            } = require('./progress/gameProgressApi');

                                            const restored = restoreProgressFieldsFromNested(g);
                                            return updateGameStatusForPartialProgress(restored);
                                        }
                                        return g;
                                    });
                                }
                            }
                        }

                        setPlayoffPairs(normalizedPairs);
                        setUsesScheduleView(
                            inferScheduleView({
                                type: typeData,
                                playoffPairs: normalizedPairs,
                                maxPlayers,
                                championsLeaguePhase: resolvedChampionsPhase,
                                isChampionsLeague: typeData === 'champions-league'
                            })
                        );
                    }
                } else {
                    console.log('Failed to fetch playoff pairs');
                }
            } catch (error) {
                console.error('Error fetching playoff pairs:', error);
            }
        };

        fetchPlayoffPairs();
    }, [tournamentId, maxPlayers, tournamentStatus, uniquePlayerNames]);

    const handleShowStats = async (team1, team2) => {
        setStats({ playerA: team1, playerB: team2 });
        setStatsLoading(true);
        setShowStats(true);

        try {
            const statsData = await fetchHeadToHeadStats(team1, team2, {
                authFetch,
                firebaseUrl: FIREBASE_DATABASE_URL,
                playoffPairs
            });
            setStats(statsData);
        } catch (error) {
            console.error('Error loading head-to-head stats:', error);
            setShowStats(false);
            setStats(null);
            alert('Could not load head-to-head stats.');
        } finally {
            setStatsLoading(false);
        }
    };

    const handleCloseStats = () => {
        setShowStats(false);
        setStatsLoading(false);
        setStats(null);
    };

    const getWinner = (pair) => {
        const score1 = pair.type === 'bo-3' ? parseInt(pair.score1) : parseInt(pair.score1) || 0;
        const score2 = pair.type === 'bo-3' ? parseInt(pair.score2) : parseInt(pair.score2) || 0;

        if (pair.type === 'bo-3') {
            if (+score1 === 2 && +score2 < 2) {
                pair.winner = pair.team1;
            } else if (+score2 === 2 && +score1 < 2) {
                pair.winner = pair.team2;
            } else {
                pair.winner = '';
            }
        } else if (pair.type === 'bo-1') {
            if (+score1 > +score2) {
                pair.winner = pair.team1;
                pair.gameWinner = pair.castle1;
            } else if (+score1 < +score2) {
                pair.winner = pair.team2;
                pair.gameWinner = pair.castle2;
            } else {
                return 'Tie';
            }
        }
        // pair.gameStatus = pair.gameStatus !== 'Finished' ? 'Finished' : 'Not Started';
        if (pair.winner && pair.gameStatus !== 'Processed') {
            if (pair.type === 'bo-3') {
                let results = ['2-0', '2-1', '1-2', '0-2'];
                let combinedScore = `${score1}-${score2}`;

                if (results.includes(combinedScore)) {
                    pair.gameStatus = 'Finished';
                }
            } else {
                pair.gameStatus = 'Finished';
            }
        }
    };

    const handleStartTournament = async () => {
        console.log('handleStartTournament called');

        const tournamentResponseGET = await authFetch(
            `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/.json`,
            {
                method: 'GET'
            }
        );
        let tournamentResponse = null;
        if (tournamentResponseGET.ok) {
            const data = await tournamentResponseGET.json();
            console.log('Tournament data:', data);
            // const playoffsGames = data.tournamentPlayoffGames;
            // const tournamentPlayoffGamesFinal = data.tournamentPlayoffGamesFinal;
            const randomBrackets = data.type === 'league' || data.type === 'swiss' ? false : data.randomBracket;
            playersObj = data.players;
            console.log('playersObj:', playersObj);
            // let tournamentData = {};

            // Recalculate stars for tournament attendees before starting
            const confirmRecalculateStars = confirmWindow(
                `Recalculate stars for tournament attendees?\n\nThis will update stars for players participating in this tournament.\n\nRecalculate stars?`
            );

            if (confirmRecalculateStars) {
                try {
                    const attendeeNames = Object.values(playersObj)
                        .filter((player) => player && player.name)
                        .map((player) => player.name);
                    const result = await recalculatePlayerStars({ attendeeNames });

                    console.log(
                        `Tournament attendees stars recalculated successfully. Updated ${result.updatedCount} players.`
                    );
                    alert('Tournament attendees stars recalculated successfully!');
                } catch (error) {
                    console.error('Error recalculating stars:', error);
                    alert('Error recalculating stars: ' + error.message);
                    return;
                }
            } else {
                console.log('Star recalculation cancelled by user');
            }

            setStartTournament(true);

            // Automatically snapshot current leaderboard rankings before tournament starts
            try {
                const snapshotResult = await snapshotLeaderboardRanks();
                if (snapshotResult.success) {
                    console.log(
                        `Leaderboard snapshot taken: ${snapshotResult.successCount} players, ${snapshotResult.errorCount} errors`
                    );
                } else {
                    console.error('Failed to snapshot leaderboard:', snapshotResult.error);
                }
            } catch (error) {
                console.error('Error during leaderboard snapshot:', error);
            }

            // Prepare the tournament data
            console.log('Random Brackets setting:', randomBrackets);
            console.log('Should open spinning wheel?', !randomBrackets);
            if (randomBrackets) {
                console.log('Opening spinning wheel...');
                setSpinningWheelMode(data.type === 'champions-league' ? 'champions-league' : 'kickoff');
                setIsSpinningWheelOpen(true);
            } else if (data.type === 'champions-league') {
                const playerList = Object.values(playersObj || {}).filter(
                    (player) => player && player.name && player.name.trim() !== '' && player.name.trim() !== 'TBD'
                );
                const prepared = prepareChampionsLeagueGroupStage(playerList, data, { shuffle: true });
                if (!prepared.validation.valid) {
                    alert(prepared.validation.message);
                    return;
                }

                const bracketRes = await authFetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/bracket/playoffPairs.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify([prepared.groupPairs]),
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
                if (!bracketRes.ok) {
                    alert('Failed to save group stage matches');
                    return;
                }

                await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/groups.json`, {
                    method: 'PUT',
                    body: JSON.stringify(prepared.groups),
                    headers: { 'Content-Type': 'application/json' }
                });
                await authFetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/championsLeaguePhase.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify('group'),
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
                await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/status.json`, {
                    method: 'PUT',
                    body: JSON.stringify('Started!'),
                    headers: { 'Content-Type': 'application/json' }
                });

                setIsChampionsLeague(true);
                setChampionsLeaguePhase('group');
                setChampionsGroups(prepared.groups);
                setChampionsGroupLabels(getGroupLabels(prepared.groupCount));
                setPlayoffPairs([prepared.groupPairs]);
            } else {
                console.log('Random bracket disabled, skipping spinning wheel');
                tournamentResponse = await authFetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/.json`,
                    {
                        method: 'PATCH',
                        body: JSON.stringify({
                            status: 'Started!'
                        }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );
                try {
                    if (tournamentResponse.ok) {
                        console.log('Pairs posted to Firebase successfully');
                    } else {
                        console.log('Failed to post pairs to Firebase');
                    }
                } catch (error) {
                    console.error('Error posting pairs to Firebase:', error);
                }

                // window.location.reload();
            }
        }
    };

    const confirmWindow = (message) => {
        console.log('Auto-confirmed:', message);
        return true;
    };

    const handleScoreChange = (stageName, pairIndex, teamIndex, newScore) => {
        const stageMappings = {
            'Quarter-final': 0,
            'Semi-final': 1,
            'Third Place': 2,
            Final: 3
            // Add more stages and their numerical values as needed
        };

        // Map the stage name to a numerical stage value
        const stage = stageMappings[stageName]; // Convert to lowercase for case-insensitive matching

        if (stage === undefined) {
            // Handle the case where an invalid stage name is provided
            console.error(`Invalid stage name: ${stageName}`);
            return;
        }

        setPlayoffPairs((prevPairs) => {
            const updatedPairs = [...prevPairs];
            const pair = updatedPairs[stage][pairIndex];

            if (teamIndex === 1) {
                pair.score1 = newScore;
            } else if (teamIndex === 2) {
                pair.score2 = newScore;
            }

            if (pair.score1 && pair.score2) {
                getWinner(pair);
                console.log('FINALLY', pair);
            }
            return updatedPairs;
        });
    };

    function renderShowStatsButton(team1, team2, onShowStats) {
        // Only show button if both players are determined (not TBD)
        if (team1 === 'TBD' || team2 === 'TBD' || !team1 || !team2) {
            return null;
        }

        return (
            <button
                type="button"
                className={classes.knockoutStatsBtn}
                onClick={() => onShowStats(team1, team2)}
                title="Show head-to-head stats"
                aria-label="Show head-to-head stats"
            >
                ?
            </button>
        );
    }

    const handleGetAvailableCastles = async () => {
        let castles = await fetchCastlesList();
        console.log('castles', castles);

        const result = getAvailableCastles(castles);
        setAvailableCastles(result);
        setShowCastlesModal(true);
    };

    //TODO: implement the getAvailableCastles function to filter castles based on the number of games played
    function getAvailableCastles(castles) {
        return calculateAvailableCastlesFromBracket(castles, playoffPairs);
    }

    const onStartTournament = async (bracket) => {
        console.log('Tournament ID:', tournamentId);
        console.log('Tournament Bracket:', bracket);

        const isBracketComplete =
            spinningWheelMode === 'champions-league'
                ? isGroupDrawGridComplete(bracket)
                : bracket.every((pair) => pair[0] !== 'TBD' && pair[1] !== 'TBD');

        if (!isBracketComplete) {
            console.error('Bracket is not complete. Please fill all slots.');
            return;
        }

        if (spinningWheelMode === 'champions-league') {
            try {
                const tournamentResponseGET = await authFetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/.json`,
                    { method: 'GET' }
                );
                if (!tournamentResponseGET.ok) {
                    throw new Error('Failed to fetch tournament data');
                }

                const tournamentData = await tournamentResponseGET.json();
                const playerList = Object.values(tournamentData.players || {}).filter(
                    (player) => player && player.name && player.name.trim() !== '' && player.name.trim() !== 'TBD'
                );
                const prepared = prepareChampionsLeagueFromDrawGrid(bracket, tournamentData, playerList);

                if (!prepared.validation.valid) {
                    alert(prepared.validation.message);
                    return;
                }

                const bracketRes = await authFetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/bracket/playoffPairs.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify([prepared.groupPairs]),
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
                if (!bracketRes.ok) {
                    throw new Error('Failed to save group stage matches');
                }

                await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/groups.json`, {
                    method: 'PUT',
                    body: JSON.stringify(prepared.groups),
                    headers: { 'Content-Type': 'application/json' }
                });
                await authFetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/championsLeaguePhase.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify('group'),
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
                await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/status.json`, {
                    method: 'PUT',
                    body: JSON.stringify('Started!'),
                    headers: { 'Content-Type': 'application/json' }
                });

                setIsChampionsLeague(true);
                setChampionsLeaguePhase('group');
                setChampionsGroups(prepared.groups);
                setChampionsGroupLabels(getGroupLabels(prepared.groupCount));
                setPlayoffPairs([prepared.groupPairs]);
                setIsSpinningWheelOpen(false);
                setSpinningWheelMode('kickoff');
            } catch (error) {
                console.error('Error starting Champions League from wheel:', error);
                alert('Error starting Champions League: ' + error.message);
            }
            return;
        }

        // Calculate stage labels based on maxPlayers
        let currentStageLabels = [];
        if (+maxPlayers === 4) {
            currentStageLabels = ['Semi-final', 'Third Place', 'Final'];
        } else if (+maxPlayers === 8) {
            currentStageLabels = ['Quarter-final', 'Semi-final', 'Third Place', 'Final'];
        } else if (+maxPlayers === 16) {
            currentStageLabels = ['1/8 Final', 'Quarter-final', 'Semi-final', 'Third Place', 'Final'];
        } else if (+maxPlayers === 32) {
            currentStageLabels = ['1/16 Final', '1/8 Final', 'Quarter-final', 'Semi-final', 'Third Place', 'Final'];
        }

        // Fetch tournament data to get playoff games settings
        let tournamentPlayoffGames = 'bo-1';
        try {
            const tournamentResponseGET = await authFetch(
                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/.json`,
                {
                    method: 'GET'
                }
            );
            if (tournamentResponseGET.ok) {
                const tournamentData = await tournamentResponseGET.json();
                tournamentPlayoffGames = normalizeMatchType(tournamentData.tournamentPlayoffGames || 'bo-1');
            }
        } catch (error) {
            console.error('Error fetching tournament data:', error);
        }

        // Determine number of games based on bo-1 or bo-3
        const numGames = getBestOfValue(tournamentPlayoffGames);
        const gameType = tournamentPlayoffGames;

        // Format bracket pairs with player data following the exact structure
        const formattedBracket = bracket.map((pair) => {
            const player1 = Object.values(playersObj).find((p) => p.name === pair[0]);
            const player2 = Object.values(playersObj).find((p) => p.name === pair[1]);

            // Get the latest ratings as strings
            const ratings1 = player1?.ratings
                ? typeof player1.ratings === 'string' && player1.ratings.includes(',')
                    ? player1.ratings.split(',').pop().trim()
                    : String(player1.ratings)
                : '0';

            const ratings2 = player2?.ratings
                ? typeof player2.ratings === 'string' && player2.ratings.includes(',')
                    ? player2.ratings.split(',').pop().trim()
                    : String(player2.ratings)
                : '0';

            // Create games array based on tournament type
            const games = Array.from({ length: numGames }, (_, index) => ({
                castle1: '',
                castle2: '',
                castleWinner: '',
                gameId: index,
                gameStatus: 'Not Started',
                gameWinner: '',
                color1: 'red',
                color2: 'blue',
                gold1: 0,
                gold2: 0,
                restart1_111: 0,
                restart1_112: 0,
                restart2_111: 0,
                restart2_112: 0
            }));

            return {
                gameStatus: 'Not Started',
                games: games,
                ratings1: ratings1,
                ratings2: ratings2,
                score1: 0,
                score2: 0,
                stage: currentStageLabels[0] || 'Quarter-final',
                stars1: player1?.stars || 0,
                stars2: player2?.stars || 0,
                team1: pair[0],
                team2: pair[1],
                type: gameType,
                winner: null,
                color1: 'red',
                color2: 'blue'
            };
        });

        try {
            // Create the full bracket structure with all stages
            const fullBracketStructure = [formattedBracket]; // Stage 0: Quarter-final

            // Add empty stages for Semi-final, Third Place, and Final with placeholder objects
            for (let i = 1; i < currentStageLabels.length; i++) {
                const stageGames = [];
                let pairsInStage;

                // Determine number of pairs based on stage
                const stageName = currentStageLabels[i];
                if (stageName === 'Semi-final') {
                    pairsInStage = 2;
                } else if (stageName === 'Third Place' || stageName === 'Final') {
                    pairsInStage = 1;
                } else if (stageName === 'Quarter-final') {
                    pairsInStage = 4;
                } else if (stageName === '1/8 Final') {
                    pairsInStage = 8;
                } else if (stageName === '1/16 Final') {
                    pairsInStage = 16;
                } else {
                    pairsInStage = 1; // Default fallback
                }

                for (let j = 0; j < pairsInStage; j++) {
                    const emptyGames = Array.from({ length: numGames }, (_, index) => ({
                        castle1: '',
                        castle2: '',
                        castleWinner: '',
                        gameId: index,
                        gameStatus: 'Not Started',
                        gameWinner: '',
                        color1: 'red',
                        color2: 'blue',
                        gold1: 0,
                        gold2: 0,
                        restart1_111: 0,
                        restart1_112: 0,
                        restart2_111: 0,
                        restart2_112: 0
                    }));

                    stageGames.push({
                        gameStatus: 'Not Started',
                        games: emptyGames,
                        ratings1: null,
                        ratings2: null,
                        score1: 0,
                        score2: 0,
                        stage: currentStageLabels[i],
                        stars1: null,
                        stars2: null,
                        team1: 'TBD',
                        team2: 'TBD',
                        type: gameType,
                        winner: null,
                        color1: 'red',
                        color2: 'blue'
                    });
                }

                fullBracketStructure.push(stageGames);
            }

            console.log('Full bracket structure to be posted:', JSON.stringify(fullBracketStructure, null, 2));
            console.log('Stage labels:', currentStageLabels);
            console.log('Number of stages:', fullBracketStructure.length);

            const tournamentResponse = await authFetch(
                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/bracket/playoffPairs.json`,
                {
                    method: 'PUT',
                    body: JSON.stringify(fullBracketStructure),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (tournamentResponse.ok) {
                console.log('Tournament Bracket Updated successfully!');
                // Update tournament status
                await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/status.json`, {
                    method: 'PUT',
                    body: JSON.stringify('Started!'),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                console.log('Tournament successfully started!');
                setIsSpinningWheelOpen(false);

                // Fetch and update playoff pairs instead of reloading
                const bracketResponse = await authFetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/bracket/playoffPairs.json`
                );
                if (bracketResponse.ok) {
                    const updatedPairs = await bracketResponse.json();
                    console.log('Fetched updated playoff pairs:', updatedPairs);
                    setPlayoffPairs(updatedPairs);
                }
            } else {
                console.error('Failed to update tournament bracket');
            }
        } catch (error) {
            console.error('Error updating tournament:', error);
        }
    };

    const handleFinishLeague = async () => {
        const pairs = playoffPairs[0] || [];
        const allDone = pairs.length > 0 && pairs.every((p) => p.winner);
        if (!allDone) {
            alert('Not all matches have been completed yet.');
            return;
        }

        // Compute standings (same logic as LeagueBracket)
        const standingsMap = {};
        pairs.forEach((pair) => {
            if (!standingsMap[pair.team1]) {
                standingsMap[pair.team1] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
            }
            if (!standingsMap[pair.team2]) {
                standingsMap[pair.team2] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
            }
            if (pair.winner) {
                standingsMap[pair.team1].played++;
                standingsMap[pair.team2].played++;
                if (pair.winner === 'draw') {
                    standingsMap[pair.team1].draws++;
                    standingsMap[pair.team1].points += 1;
                    standingsMap[pair.team2].draws++;
                    standingsMap[pair.team2].points += 1;
                } else if (pair.winner === pair.team1) {
                    standingsMap[pair.team1].wins++;
                    standingsMap[pair.team1].points += pair.type === 'bo-2' ? 2 : 3;
                    standingsMap[pair.team2].losses++;
                } else {
                    standingsMap[pair.team2].wins++;
                    standingsMap[pair.team2].points += pair.type === 'bo-2' ? 2 : 3;
                    standingsMap[pair.team1].losses++;
                }
            }
        });
        const standings = Object.entries(standingsMap)
            .map(([name, s]) => ({ name, ...s }))
            .sort((a, b) => b.points - a.points || b.wins - a.wins);

        const first = standings[0]?.name;
        const second = standings[1]?.name;
        const third = standings[2]?.name;

        if (!first) {
            alert('Unable to determine standings. Cannot finish league.');
            return;
        }

        const standingsSummary = standings
            .slice(0, 3)
            .map((s, i) => {
                const drawPart = s.draws > 0 ? ` / ${s.draws}D` : '';
                return `${i + 1}. ${s.name} — ${s.points} pts (${s.wins}W${drawPart} / ${s.losses}L)`;
            })
            .join('\n');

        const finishLabel = isSwiss ? 'Swiss tournament' : 'league';
        const confirmed = window.confirm(
            `Final Standings:\n\n${standingsSummary}\n\nDistribute prizes and mark ${finishLabel} as finished?`
        );
        if (!confirmed) {
            return;
        }

        try {
            const prizes = await pullTournamentPrizes(tournamentId);
            if (!prizes || typeof prizes !== 'object') {
                alert('Could not load prize data. Aborting.');
                return;
            }

            const tName = tournamentName || 'Unknown Tournament';

            const placements = [
                { place: '1st Place', name: first, winnerKey: '1st place' },
                { place: '2nd Place', name: second, winnerKey: '2nd place' },
                { place: '3rd Place', name: third, winnerKey: '3rd place' }
            ];

            for (const { place, name, winnerKey } of placements) {
                if (!name) {
                    continue;
                }
                const prizeAmount = prizes[place];
                if (!prizeAmount) {
                    continue;
                }

                const userId = await lookForUserId(name);
                const userRecord = await loadUserById(userId);
                if (!userRecord || typeof userRecord !== 'object') {
                    console.error(`Failed to load user record for ${place}: ${name}`);
                    continue;
                }

                const currentTotal = await getPlayerPrizeTotal(userId);
                userRecord.totalPrize = +currentTotal + +prizeAmount;
                if (!Array.isArray(userRecord.prizes)) {
                    userRecord.prizes = [];
                }
                userRecord.prizes.push({ tournamentName: tName, place, prizeAmount });

                await authFetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userRecord)
                });
                await authFetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/winners/${winnerKey}.json`,
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(name)
                    }
                );
            }

            const res = await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/status.json`, {
                method: 'PUT',
                body: JSON.stringify('Tournament Finished'),
                headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) {
                alert('Failed to update tournament status.');
                return;
            }

            try {
                await recalculatePlayerStars();
            } catch (e) {
                console.warn('Star recalculation failed', e);
            }
            try {
                await snapshotLeaderboardRanks();
            } catch (e) {
                console.warn('Leaderboard snapshot failed', e);
            }

            alert('League finished! Prizes distributed and status updated.');
            window.location.reload();
        } catch (error) {
            console.error('Error finishing league:', error);
            alert('Error finishing league: ' + error.message);
        }
    };

    const handleGenerateNextSwissRound = async () => {
        const pairs = playoffPairs[0] || [];
        if (!isSwissRoundComplete(pairs, swissCurrentRound)) {
            alert(`Round ${swissCurrentRound} is not complete yet.`);
            return;
        }

        if (swissCurrentRound >= swissTotalRounds) {
            alert('All Swiss rounds have already been generated.');
            return;
        }

        const nextRound = swissCurrentRound + 1;
        const confirmed = window.confirm(`Generate pairings for round ${nextRound} of ${swissTotalRounds}?`);
        if (!confirmed) {
            return;
        }

        try {
            const tournamentResponse = await authFetch(
                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/.json`
            );
            if (!tournamentResponse.ok) {
                throw new Error('Failed to fetch tournament data');
            }

            const tournamentData = await tournamentResponse.json();
            const gameType = normalizeGameType(tournamentData.tournamentPlayoffGames || 'bo-1');
            const playerList = Object.values(tournamentData.players || {}).filter(
                (player) => player && player.name && player.name.trim() !== '' && player.name.trim() !== 'TBD'
            );

            const nextPairs = generateNextSwissRoundPairings(playerList, pairs, nextRound, gameType);
            const updatedPairs = [...pairs, ...nextPairs];

            const bracketRes = await authFetch(
                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/bracket/playoffPairs.json`,
                {
                    method: 'PUT',
                    body: JSON.stringify([updatedPairs]),
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            if (!bracketRes.ok) {
                throw new Error('Failed to save Swiss pairings');
            }

            await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/swissCurrentRound.json`, {
                method: 'PUT',
                body: JSON.stringify(nextRound),
                headers: { 'Content-Type': 'application/json' }
            });

            setPlayoffPairs([updatedPairs]);
            setSwissCurrentRound(nextRound);
            alert(`Round ${nextRound} generated (${nextPairs.length} matches).`);
        } catch (error) {
            console.error('Error generating Swiss round:', error);
            alert('Error generating Swiss round: ' + error.message);
        }
    };

    const handleStartChampionsKnockout = async () => {
        const groupPairs = playoffPairs[0] || [];
        if (!isChampionsLeagueGroupStageComplete(groupPairs)) {
            alert('Group stage is not complete yet.');
            return;
        }

        const summary = Object.entries(championsGroups)
            .map(([groupLabel]) => {
                const qualified = getQualifiedPlayers(championsGroups, groupPairs).filter(
                    (player) => player.group === groupLabel
                );
                return `Group ${groupLabel}: ${qualified.map((player) => `${player.place}. ${player.name}`).join(', ')}`;
            })
            .join('\n');

        const confirmed = window.confirm(
            `Start knockout stage with these qualifiers?\n\n${summary}\n\nGenerate knockout bracket?`
        );
        if (!confirmed) {
            return;
        }

        try {
            const tournamentResponse = await authFetch(
                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/.json`
            );
            if (!tournamentResponse.ok) {
                throw new Error('Failed to fetch tournament data');
            }

            const tournamentData = await tournamentResponse.json();
            const qualifiers = getQualifiedPlayers(championsGroups, groupPairs);
            const knockoutSize = getKnockoutPlayerCount(tournamentData.maxPlayers);
            const gameType = tournamentData.tournamentPlayoffGames || '1';
            const finalGameType = tournamentData.tournamentPlayoffGamesFinal || gameType;
            const thirdPlaceGameType = tournamentData.tournamentPlayoffGamesThirdPlace || gameType;
            const knockoutStages = generateKnockoutBracketStages(
                qualifiers,
                knockoutSize,
                gameType,
                finalGameType,
                thirdPlaceGameType
            );
            const updatedPairs = [groupPairs, ...knockoutStages];
            const knockoutLabels = computeStageLabels(knockoutSize);

            const bracketRes = await authFetch(
                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/bracket/playoffPairs.json`,
                {
                    method: 'PUT',
                    body: JSON.stringify(updatedPairs),
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            if (!bracketRes.ok) {
                throw new Error('Failed to save knockout bracket');
            }

            await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/championsLeaguePhase.json`, {
                method: 'PUT',
                body: JSON.stringify('knockout'),
                headers: { 'Content-Type': 'application/json' }
            });

            await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/stageLabels.json`, {
                method: 'PUT',
                body: JSON.stringify(knockoutLabels),
                headers: { 'Content-Type': 'application/json' }
            });

            setPlayoffPairs(updatedPairs);
            setStageLabels(knockoutLabels);
            setChampionsLeaguePhase('knockout');
            setUsesScheduleView(
                inferScheduleView({
                    type: 'champions-league',
                    playoffPairs: updatedPairs,
                    maxPlayers,
                    championsLeaguePhase: 'knockout',
                    isChampionsLeague: true
                })
            );
            setActiveBracketStage(0);
            alert('Knockout stage started!');
        } catch (error) {
            console.error('Error starting Champions League knockout:', error);
            alert('Error starting knockout: ' + error.message);
        }
    };

    const handleOpenReportGame = (pair, stageIdx, pairIdx) => {
        if (pair.isBye || pair.team2 === 'BYE') {
            return;
        }
        if (pair.team1 === 'TBD' || pair.team2 === 'TBD' || !pair.team1 || !pair.team2) {
            alert('Cannot report game until both players are assigned.');
            return;
        }
        if (pair.gameStatus === 'Processed' && !authCtx.isAdmin) {
            alert('This game is already processed. Only admin can re-report it.');
            return;
        }
        if (!canReportGameForPair(pair)) {
            alert('Only match players or admin can report this game.');
            return;
        }
        const pairId = `${tournamentId}_s${stageIdx}_p${pairIdx}`;
        setSelectedPairId(pairId);
        // If the game is not PartiallyProcessed, wipe any stale progress record so
        // a fresh submission never inherits skip flags from a previous abandoned run
        if (pair.gameStatus !== 'PartiallyProcessed') {
            savePairProgress(tournamentId, pairId, null);
        }
        setSelectedStageIndex(stageIdx);
        setSelectedPairIndex(pairIdx);
        setShowReportGameModal(true);
    };

    const handleSaveMatchSchedule = async (stageIdx, pairIdx, scheduledAt) => {
        const pair = playoffPairs[stageIdx]?.[pairIdx];
        if (!pair) {
            return;
        }
        if (!canSchedulePairForPair(pair)) {
            alert('Only match players can set the start time.');
            return;
        }

        const base = `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/bracket/playoffPairs/${stageIdx}/${pairIdx}`;
        const scheduledBy = scheduledAt ? authCtx.userNickName : null;

        try {
            if (scheduledAt) {
                const atRes = await authFetch(`${base}/scheduledAt.json`, {
                    method: 'PUT',
                    body: JSON.stringify(scheduledAt)
                });
                const byRes = await authFetch(`${base}/scheduledBy.json`, {
                    method: 'PUT',
                    body: JSON.stringify(scheduledBy)
                });
                if (!atRes.ok || !byRes.ok) {
                    throw new Error('Failed to save schedule');
                }
            } else {
                await authFetch(`${base}/scheduledAt.json`, { method: 'DELETE' });
                await authFetch(`${base}/scheduledBy.json`, { method: 'DELETE' });
            }

            setPlayoffPairs((prev) => {
                const next = prev.map((stage) => [...stage]);
                next[stageIdx] = next[stageIdx].map((item, index) =>
                    index === pairIdx
                        ? { ...item, scheduledAt: scheduledAt || null, scheduledBy: scheduledBy || null }
                        : item
                );
                return next;
            });
        } catch (error) {
            console.error('Error saving match schedule:', error);
            throw error;
        }
    };

    // Helper function to update player ratings and statistics after a game
    const updatePlayerRatings = async (
        team1,
        team2,
        winnerId,
        { skipRatings = false, skipPlayerStats = false, seriesGames = null, onCheckpoint = null } = {}
    ) => {
        try {
            // Get player IDs
            const opponent1Id = await lookForUserId(team1);
            const opponent2Id = await lookForUserId(team2);

            const confirmPlayerIds = confirmWindow(
                `Player IDs fetched:\n${team1}: ${opponent1Id}\n${team2}: ${opponent2Id}\n\nContinue?`
            );
            if (!confirmPlayerIds) {
                return { success: false, newRatings: {} };
            }

            // Fetch current player data
            const opponent1PrevData = await lookForUserPrevScore(opponent1Id);
            const opponent2PrevData = await lookForUserPrevScore(opponent2Id);

            const opponent1Stats = opponent1PrevData.games?.heroes3 || { total: 0, win: 0, lose: 0 };
            console.log('opponent1Stats', opponent1Stats);
            const opponent2Stats = opponent2PrevData.games?.heroes3 || { total: 0, win: 0, lose: 0 };

            //TODO: Fix database structure - 'win' field may be missing in all records
            // Calculate win from total - lose if win field is missing
            const opponent1Win =
                opponent1Stats.win !== undefined
                    ? opponent1Stats.win
                    : (opponent1Stats.total || 0) - (opponent1Stats.lose || 0);
            const opponent2Win =
                opponent2Stats.win !== undefined
                    ? opponent2Stats.win
                    : (opponent2Stats.total || 0) - (opponent2Stats.lose || 0);

            // Extract most recent ratings
            const opponent1Rating = opponent1PrevData.ratings?.split(',').pop().trim() || '0';
            console.log('opponent1Rating', opponent1Rating);
            const opponent2Rating = opponent2PrevData.ratings?.split(',').pop().trim() || '0';

            const confirmCurrentStats = confirmWindow(
                `Current Stats:\n\n${team1}:\nRating: ${opponent1Rating}\nTotal: ${opponent1Stats.total}, Win: ${opponent1Win}, Lose: ${opponent1Stats.lose}\n\n${team2}:\nRating: ${opponent2Rating}\nTotal: ${opponent2Stats.total}, Win: ${opponent2Win}, Lose: ${opponent2Stats.lose}\n\nContinue?`
            );
            if (!confirmCurrentStats) {
                return { success: false, newRatings: {} };
            }

            // Determine winners
            const didWinOpponent1 = winnerId === opponent1Id;
            const didWinOpponent2 = winnerId === opponent2Id;

            const winnerName = didWinOpponent1 ? team1 : team2;
            const loserName = didWinOpponent1 ? team2 : team1;

            const confirmWinner = confirmWindow(`Winner determined: ${winnerName}\nLoser: ${loserName}\n\nContinue?`);
            if (!confirmWinner) {
                return { success: false, newRatings: {} };
            }

            // Update player game statistics (win/lose/total) - calculate before rating updates
            // Use calculated opponent1Win/opponent2Win instead of opponent1Stats.win to handle missing 'win' field
            const updatedOpponent1Stats = {
                total: (opponent1Stats.total || 0) + 1,
                win: opponent1Win + (didWinOpponent1 ? 1 : 0),
                lose: (opponent1Stats.lose || 0) + (didWinOpponent1 ? 0 : 1)
            };

            const updatedOpponent2Stats = {
                total: (opponent2Stats.total || 0) + 1,
                win: opponent2Win + (didWinOpponent2 ? 1 : 0),
                lose: (opponent2Stats.lose || 0) + (didWinOpponent2 ? 0 : 1)
            };

            // Extract latest ratings
            const opponent1CurrentRating = parseFloat(opponent1PrevData.ratings.split(',').pop().trim());
            const opponent2CurrentRating = parseFloat(opponent2PrevData.ratings.split(',').pop().trim());

            // Calculate new ratings — chain ELO across each played game in the series
            const { r1: opponent1NewRating, r2: opponent2NewRating } = calcSeriesRatings(
                opponent1CurrentRating,
                opponent2CurrentRating,
                team1,
                team2,
                seriesGames,
                didWinOpponent1
            );
            const playedGames = Array.isArray(seriesGames)
                ? seriesGames.filter((g) => g.gameWinner && g.gameWinner !== '')
                : [];
            const playedGamesCount = playedGames.length;
            console.log(`ELO chained across ${playedGamesCount || 1} game(s)`);

            // Build ELO context explanation for the confirmation dialog
            const buildEloExplanation = (playerName, currentRating, opponentRating, newRating) => {
                const change = newRating - currentRating;
                const changeStr = (change >= 0 ? '+' : '') + change.toFixed(2);
                let explanation = `${playerName}:\nOld: ${currentRating.toFixed(2)}  →  New: ${newRating.toFixed(2)}  (${changeStr})`;

                if (playedGamesCount > 1) {
                    const playerWins = playedGames.filter((g) => g.gameWinner === playerName).length;
                    const playerLosses = playedGamesCount - playerWins;
                    const wonSeries = playerWins > playerLosses;
                    const expectedPerGame = 1 / (1 + Math.pow(10, (opponentRating - currentRating) / 10));
                    const actualPerGame = playerWins / playedGamesCount;
                    explanation += `\n  Series: ${playerWins}-${playerLosses} (${playedGamesCount} games)`;
                    explanation += `\n  Expected win rate: ${(expectedPerGame * 100).toFixed(0)}%  |  Actual: ${(actualPerGame * 100).toFixed(0)}%`;
                    if (change < 0 && wonSeries) {
                        explanation += `\n  ↓ Won the series but underperformed expectations — rating reflects actual play level.`;
                    } else if (change < 0) {
                        explanation += `\n  ↓ Lost the series — rating dropped.`;
                    } else {
                        explanation += `\n  ↑ Outperformed or met expectations.`;
                    }
                }
                return explanation;
            };

            const confirmRatingChanges = confirmWindow(
                `Rating Changes:\n\n` +
                    buildEloExplanation(team1, opponent1CurrentRating, opponent2CurrentRating, opponent1NewRating) +
                    `\n\n` +
                    buildEloExplanation(team2, opponent2CurrentRating, opponent1CurrentRating, opponent2NewRating) +
                    `\n\nUpdate ratings?`
            );
            if (!confirmRatingChanges) {
                console.log('Rating changes preview cancelled - skipping ratings update but continuing to statistics');
            }

            // Confirm before updating ratings (only if preview was confirmed)
            if (confirmRatingChanges) {
                const confirmRatingsUpdate = confirmWindow(
                    `Update player ratings to database?\n\n${team1}: ${opponent1CurrentRating.toFixed(2)} → ${opponent1NewRating.toFixed(2)}\n${team2}: ${opponent2CurrentRating.toFixed(2)} → ${opponent2NewRating.toFixed(2)}\n\nUpdate ratings?`
                );
                if (confirmRatingsUpdate) {
                    if (!skipRatings) {
                        try {
                            console.log(
                                `Updating ${team1} (${opponent1Id}) rating: ${opponent1CurrentRating.toFixed(2)} → ${opponent1NewRating.toFixed(2)}`
                            );
                            await addScoreToUser(
                                opponent1Id,
                                opponent1PrevData,
                                opponent1NewRating,
                                winnerId,
                                tournamentId,
                                team1
                            );
                            console.log(`✓ ${team1} rating updated successfully`);

                            console.log(
                                `Updating ${team2} (${opponent2Id}) rating: ${opponent2CurrentRating.toFixed(2)} → ${opponent2NewRating.toFixed(2)}`
                            );
                            await addScoreToUser(
                                opponent2Id,
                                opponent2PrevData,
                                opponent2NewRating,
                                winnerId,
                                tournamentId,
                                team2
                            );
                            console.log(`✓ ${team2} rating updated successfully`);
                        } catch (error) {
                            console.error('Error updating player ratings:', error);
                            alert(`Error updating ratings: ${error.message}`);
                        }
                    } else {
                        console.log('Ratings update skipped (already done in previous session)');
                    }
                    if (onCheckpoint) {
                        await onCheckpoint('ratings');
                    }
                } else {
                    console.log('Player ratings update skipped by user');
                }
            }

            // Separate step for player statistics
            if (skipPlayerStats) {
                console.log('Player statistics update skipped (already done in previous session)');
                return {
                    success: true,
                    newRatings: {
                        [team1]: opponent1NewRating.toFixed(2),
                        [team2]: opponent2NewRating.toFixed(2)
                    }
                };
            }
            const confirmStatistics = confirmWindow(
                `Update Player Statistics?\n\n${team1}:\nOld - Total: ${opponent1Stats.total}, Win: ${opponent1Win}, Lose: ${opponent1Stats.lose}\nNew - Total: ${updatedOpponent1Stats.total}, Win: ${updatedOpponent1Stats.win}, Lose: ${updatedOpponent1Stats.lose}\n\n${team2}:\nOld - Total: ${opponent2Stats.total}, Win: ${opponent2Win}, Lose: ${opponent2Stats.lose}\nNew - Total: ${updatedOpponent2Stats.total}, Win: ${updatedOpponent2Stats.win}, Lose: ${updatedOpponent2Stats.lose}\n\nUpdate?`
            );
            if (!confirmStatistics) {
                console.log('Player statistics update skipped by user');
                alert('⚠️ Player statistics update skipped - continuing with next steps');
                return {
                    success: true,
                    newRatings: {
                        [team1]: opponent1NewRating.toFixed(2),
                        [team2]: opponent2NewRating.toFixed(2)
                    }
                };
            }

            // Update opponent 1 statistics
            const confirmStats1 = confirmWindow(
                `Update ${team1} statistics to database?\n\nTotal: ${updatedOpponent1Stats.total}, Win: ${updatedOpponent1Stats.win}, Lose: ${updatedOpponent1Stats.lose}\n\nUpdate?`
            );
            if (confirmStats1) {
                await authFetch(`${FIREBASE_DATABASE_URL}/users/${opponent1Id}/gamesPlayed/heroes3.json`, {
                    method: 'PUT',
                    body: JSON.stringify(updatedOpponent1Stats),
                    headers: { 'Content-Type': 'application/json' }
                });
                console.log(`${team1} statistics updated successfully`);
            } else {
                console.log(`${team1} statistics update skipped by user`);
            }

            // Update opponent 2 statistics
            const confirmStats2 = confirmWindow(
                `Update ${team2} statistics to database?\n\nTotal: ${updatedOpponent2Stats.total}, Win: ${updatedOpponent2Stats.win}, Lose: ${updatedOpponent2Stats.lose}\n\nUpdate?`
            );
            if (confirmStats2) {
                await authFetch(`${FIREBASE_DATABASE_URL}/users/${opponent2Id}/gamesPlayed/heroes3.json`, {
                    method: 'PUT',
                    body: JSON.stringify(updatedOpponent2Stats),
                    headers: { 'Content-Type': 'application/json' }
                });
                console.log(`${team2} statistics updated successfully`);
            } else {
                console.log(`${team2} statistics update skipped by user`);
            }

            console.log('Player ratings and statistics process completed');
            if (onCheckpoint) {
                await onCheckpoint('player_stats');
            }
            alert('✅ Player ratings and statistics process completed!');
            return {
                success: true,
                newRatings: {
                    [team1]: opponent1NewRating.toFixed(2),
                    [team2]: opponent2NewRating.toFixed(2)
                }
            };
        } catch (error) {
            console.error('Error updating player ratings and statistics:', error);
            throw error;
        }
    };

    const handleSubmitGameReport = async (reportData) => {
        // Ordered processing stages — used for skip logic on session restore
        const STAGES = [
            'castle_stats',
            'ratings',
            'player_stats',
            'game_posted',
            'prizes',
            'promotion',
            'tournament_status',
            'bracket'
        ];
        const stageAtLeast = (latest, target) => STAGES.indexOf(latest) >= STAGES.indexOf(target);

        await setDetailedProgressStage('Started');
        try {
            // Update the specific pair in playoffPairs
            const updatedPairs = [...playoffPairs];
            const pair = updatedPairs[selectedStageIndex][selectedPairIndex];

            // Always check Firebase for saved progress — latestStage existence is the restore trigger,
            // not pair.gameStatus (which only reaches Firebase at the very end of the process)
            let skipCastleStats = false;
            let skipRatings = false;
            let skipPlayerStats = false;
            let skipGamePost = false;
            let skipPrizes = false;
            let skipPromotion = false;
            let skipTournamentStatus = false;
            let skipBracket = false;
            const savedProgress = await getPairProgress(tournamentId, selectedPairId);
            const latestStage = savedProgress?.latestStage || '';
            // Per-castle checkpoint keys stored as { g0_c1: true, g0_c2: true, g1_c1: true, ... }
            const completedCastleKeys = new Set(Object.keys(savedProgress || {}).filter((k) => /^g\d+_c[12]$/.test(k)));
            if (latestStage && latestStage !== 'submitted') {
                // 'submitted' means form was saved but processing hadn't started yet — no stages to skip
                skipCastleStats = stageAtLeast(latestStage, 'castle_stats');
                skipRatings = stageAtLeast(latestStage, 'ratings');
                skipPlayerStats = stageAtLeast(latestStage, 'player_stats');
                skipGamePost = stageAtLeast(latestStage, 'game_posted');
                skipPrizes = stageAtLeast(latestStage, 'prizes');
                skipPromotion = stageAtLeast(latestStage, 'promotion');
                skipTournamentStatus = stageAtLeast(latestStage, 'tournament_status');
                skipBracket = stageAtLeast(latestStage, 'bracket');
            }

            if (reportData.mockMode) {
                skipCastleStats = true;
                skipRatings = true;
                skipPlayerStats = true;
                skipGamePost = true;
                skipPrizes = true;
                skipTournamentStatus = true;
                skipPromotion = false;
                skipBracket = false;
            }

            // Build upfront summary of all DB operations and ask for one confirmation
            // Pre-fetch castle data here so we can show exact stats and reuse in the write loop
            const castleDataCache = new Map();
            // Pre-fetch player + prize data for summary (reused in updatePlayerRatings via cache)
            let summaryPlayerData = null; // { team1: { id, prevData, newRating, updatedStats }, team2: { ... } }
            let summaryPrizes = null;
            {
                const currentStage = stageLabels[selectedStageIndex];
                const isResume = !!(latestStage && latestStage !== 'submitted');
                const hasWinner = !!reportData.winner && reportData.winner !== 'draw';
                const castleGames = reportData.games.filter(
                    (g) => g.castle1 && g.castle2 && g.gameWinner && g.gameStatus !== 'Processed'
                );

                // Pre-fetch current castle stats from DB
                if (!skipCastleStats && castleGames.length > 0) {
                    const uniqueCastles = [...new Set(castleGames.flatMap((g) => [g.castle1, g.castle2]))];
                    await Promise.all(
                        uniqueCastles.map(async (castle) => {
                            try {
                                const r = await authFetch(
                                    `${FIREBASE_DATABASE_URL}/statistic/heroes3/castles/${castle}.json`
                                );
                                if (r.ok) {
                                    castleDataCache.set(castle, await r.json());
                                }
                            } catch (e) {
                                console.warn(`Could not pre-fetch castle stats for ${castle}`, e);
                            }
                        })
                    );
                }

                // Pre-fetch player and prize data for ELO/stats/prize summary lines
                if (hasWinner && (!skipRatings || !skipPlayerStats || !skipPrizes)) {
                    try {
                        const [p1Id, p2Id] = await Promise.all([lookForUserId(pair.team1), lookForUserId(pair.team2)]);
                        const [p1Data, p2Data] = await Promise.all([
                            lookForUserPrevScore(p1Id),
                            lookForUserPrevScore(p2Id)
                        ]);

                        const winnerId = await lookForUserId(reportData.winner);
                        const didWin1 = winnerId === p1Id;
                        const didWin2 = winnerId === p2Id;

                        const p1CurrentRating = parseFloat(p1Data.ratings?.split(',').pop().trim() || '0');
                        const p2CurrentRating = parseFloat(p2Data.ratings?.split(',').pop().trim() || '0');
                        const { r1: p1NewRating, r2: p2NewRating } = calcSeriesRatings(
                            p1CurrentRating,
                            p2CurrentRating,
                            pair.team1,
                            pair.team2,
                            reportData.games,
                            didWin1
                        );

                        const p1Stats = p1Data.games?.heroes3 || { total: 0, win: 0, lose: 0 };
                        const p2Stats = p2Data.games?.heroes3 || { total: 0, win: 0, lose: 0 };
                        const p1Win =
                            p1Stats.win !== undefined ? p1Stats.win : (p1Stats.total || 0) - (p1Stats.lose || 0);
                        const p2Win =
                            p2Stats.win !== undefined ? p2Stats.win : (p2Stats.total || 0) - (p2Stats.lose || 0);

                        summaryPlayerData = {
                            team1: {
                                id: p1Id,
                                prevData: p1Data,
                                currentRating: p1CurrentRating,
                                newRating: p1NewRating,
                                currentStats: { total: p1Stats.total || 0, win: p1Win, lose: p1Stats.lose || 0 },
                                updatedStats: {
                                    total: (p1Stats.total || 0) + 1,
                                    win: p1Win + (didWin1 ? 1 : 0),
                                    lose: (p1Stats.lose || 0) + (didWin1 ? 0 : 1)
                                }
                            },
                            team2: {
                                id: p2Id,
                                prevData: p2Data,
                                currentRating: p2CurrentRating,
                                newRating: p2NewRating,
                                currentStats: { total: p2Stats.total || 0, win: p2Win, lose: p2Stats.lose || 0 },
                                updatedStats: {
                                    total: (p2Stats.total || 0) + 1,
                                    win: p2Win + (didWin2 ? 1 : 0),
                                    lose: (p2Stats.lose || 0) + (didWin2 ? 0 : 1)
                                }
                            },
                            winnerId
                        };

                        if (!skipPrizes && (currentStage === 'Third Place' || currentStage === 'Final')) {
                            summaryPrizes = await pullTournamentPrizes(tournamentId);
                        }
                    } catch (e) {
                        console.warn('Could not pre-fetch player data for summary', e);
                    }
                }

                const lines = [];

                if (isResume) {
                    lines.push(`⚡ RESUMING from checkpoint: "${latestStage}"`);
                    lines.push('');
                }

                lines.push('The following DB operations will run automatically:');
                lines.push('');

                if (reportData.mockMode) {
                    lines.push('  🧪 TEST MODE — tournament bracket only');
                    lines.push('  • Skipped: ELO, castle stats, player stats, game archive, prize payouts');
                    lines.push('  • Still runs: match result, promotion, bracket save');
                    lines.push('');
                }

                if (skipCastleStats) {
                    lines.push(
                        reportData.mockMode
                            ? '  • Castle stats: skipped (test mode)'
                            : '  ✓ Castle stats (already done)'
                    );
                } else if (castleGames.length > 0) {
                    castleGames.forEach((g, i) => {
                        const gameIndex = reportData.games.indexOf(g);
                        const alreadyC1 = completedCastleKeys.has(`g${gameIndex}_c1`);
                        const alreadyC2 = completedCastleKeys.has(`g${gameIndex}_c2`);
                        const isWinner1 = g.castleWinner === g.castle1;
                        const isWinner2 = g.castleWinner === g.castle2;
                        if (!alreadyC1) {
                            const d = castleDataCache.get(g.castle1) || { win: 0, lose: 0, total: 0 };
                            const label = isWinner1 ? 'W' : 'L';
                            lines.push(
                                `  • ${g.castle1} (game ${i + 1}) [${label}]: W${d.win || 0}→${(d.win || 0) + (isWinner1 ? 1 : 0)} L${d.lose || 0}→${(d.lose || 0) + (isWinner1 ? 0 : 1)} T${d.total || 0}→${(d.total || 0) + 1}`
                            );
                        }
                        if (!alreadyC2) {
                            const d = castleDataCache.get(g.castle2) || { win: 0, lose: 0, total: 0 };
                            const label = isWinner2 ? 'W' : 'L';
                            lines.push(
                                `  • ${g.castle2} (game ${i + 1}) [${label}]: W${d.win || 0}→${(d.win || 0) + (isWinner2 ? 1 : 0)} L${d.lose || 0}→${(d.lose || 0) + (isWinner2 ? 0 : 1)} T${d.total || 0}→${(d.total || 0) + 1}`
                            );
                        }
                    });
                } else {
                    lines.push('  • Castle stats: will update for games with castles + winner set');
                }

                if (!hasWinner) {
                    lines.push('');
                    if (reportData.winner === 'draw') {
                        lines.push('  • Draw (1-1) — ELO ratings and player stats will NOT be updated.');
                        if (!skipGamePost) {
                            lines.push('  • Post game record to /games/heroes3/ (with winner: draw)');
                        }
                    } else {
                        lines.push(
                            'No series winner selected — ratings, game post, prizes and bracket update will be skipped.'
                        );
                    }
                }

                if (hasWinner) {
                    if (!skipRatings) {
                        if (summaryPlayerData) {
                            const { team1, team2, winnerId } = summaryPlayerData;
                            const ch1 = (team1.newRating - team1.currentRating).toFixed(2);
                            const ch2 = (team2.newRating - team2.currentRating).toFixed(2);
                            lines.push(
                                `  • ELO: ${pair.team1} ${team1.currentRating.toFixed(2)}→${team1.newRating.toFixed(2)} (${ch1 > 0 ? '+' : ''}${ch1})`
                            );
                            lines.push(
                                `  • ELO: ${pair.team2} ${team2.currentRating.toFixed(2)}→${team2.newRating.toFixed(2)} (${ch2 > 0 ? '+' : ''}${ch2})`
                            );
                            const previewPlayedGames = reportData.games
                                ? reportData.games.filter((g) => g.gameWinner && g.gameWinner !== '')
                                : [];
                            if (previewPlayedGames.length > 1) {
                                const check = (playerName, data, isWinner, opponentCurrentRating) => {
                                    if (isWinner && data.newRating < data.currentRating) {
                                        const playerWins = previewPlayedGames.filter(
                                            (g) => g.gameWinner === playerName
                                        ).length;
                                        const ratingDiff = opponentCurrentRating - data.currentRating;
                                        const expectedPct = Math.round(100 / (1 + Math.pow(10, ratingDiff / 10)));
                                        const actualPct = Math.round((playerWins / previewPlayedGames.length) * 100);
                                        lines.push(
                                            `    ↓ ${playerName} won series (${playerWins}-${previewPlayedGames.length - playerWins}) but underperformed expectations (expected ${expectedPct}%, actual ${actualPct}%) — rating dropped.`
                                        );
                                    }
                                };
                                check(pair.team1, team1, winnerId === team1.id, team2.currentRating);
                                check(pair.team2, team2, winnerId === team2.id, team1.currentRating);
                            }
                        } else {
                            lines.push(`  • Update ELO ratings: ${pair.team1}, ${pair.team2}`);
                        }
                    } else {
                        lines.push(
                            reportData.mockMode ? '  • ELO ratings: skipped (test mode)' : '  ✓ Ratings (already done)'
                        );
                    }

                    if (!skipPlayerStats) {
                        if (summaryPlayerData) {
                            const { team1, team2 } = summaryPlayerData;
                            lines.push(
                                `  • Stats: ${pair.team1} W${team1.currentStats.win}→${team1.updatedStats.win} L${team1.currentStats.lose}→${team1.updatedStats.lose} T${team1.currentStats.total}→${team1.updatedStats.total}`
                            );
                            lines.push(
                                `  • Stats: ${pair.team2} W${team2.currentStats.win}→${team2.updatedStats.win} L${team2.currentStats.lose}→${team2.updatedStats.lose} T${team2.currentStats.total}→${team2.updatedStats.total}`
                            );
                        } else {
                            lines.push(`  • Update player stats (W/L/total): ${pair.team1}, ${pair.team2}`);
                        }
                    } else {
                        lines.push(
                            reportData.mockMode
                                ? '  • Player stats: skipped (test mode)'
                                : '  ✓ Player stats (already done)'
                        );
                    }

                    if (!skipGamePost) {
                        lines.push('  • Post game record to /games/heroes3/');
                    } else {
                        lines.push(
                            reportData.mockMode
                                ? '  • Game archive: skipped (test mode)'
                                : '  ✓ Game post (already done)'
                        );
                    }

                    if (!skipPrizes) {
                        if (currentStage === 'Third Place') {
                            if (summaryPrizes) {
                                const amt = summaryPrizes['3rd Place'];
                                lines.push(
                                    `  • Award 3rd place prize: ${reportData.winner} +${amt} (updates player prizes[] + totalPrize)`
                                );
                            } else {
                                lines.push(
                                    `  • Award 3rd place prize to winner (updates player prizes[] + totalPrize)`
                                );
                            }
                        } else if (currentStage === 'Final') {
                            if (summaryPrizes) {
                                const loser = pair.team1 === reportData.winner ? pair.team2 : pair.team1;
                                lines.push(
                                    `  • Award 1st place prize: ${reportData.winner} +${summaryPrizes['1st Place']} (updates player prizes[] + totalPrize)`
                                );
                                lines.push(
                                    `  • Award 2nd place prize: ${loser} +${summaryPrizes['2nd Place']} (updates player prizes[] + totalPrize)`
                                );
                            } else {
                                lines.push(`  • Award 1st & 2nd place prizes (updates player prizes[] + totalPrize)`);
                            }
                        } else {
                            lines.push('  • Prizes: N/A for this stage');
                        }
                    } else {
                        lines.push(
                            reportData.mockMode ? '  • Prize payouts: skipped (test mode)' : '  ✓ Prizes (already done)'
                        );
                    }

                    if (!skipPromotion) {
                        const winner = reportData.winner;
                        const loser = pair.team1 === winner ? pair.team2 : pair.team1;
                        if (currentStage === 'Semi-final') {
                            const finalIdx = stageLabels.indexOf('Final');
                            const thirdIdx = stageLabels.indexOf('Third Place');
                            const slot = selectedPairIndex === 0 ? 'team1' : 'team2';
                            if (finalIdx !== -1) {
                                lines.push(`  • Promote: ${winner} → Final ${slot}`);
                            }
                            if (thirdIdx !== -1) {
                                lines.push(`  • Promote: ${loser} → Third Place ${slot}`);
                            }
                            if (finalIdx === -1 && thirdIdx === -1) {
                                lines.push(`  • Promote: ${winner} → next stage`);
                            }
                        } else if (currentStage === 'Quarter-final') {
                            const semiIdx = stageLabels.indexOf('Semi-final');
                            const semiPairIdx = Math.floor(selectedPairIndex / 2);
                            const slot = selectedPairIndex % 2 === 0 ? 'team1' : 'team2';
                            lines.push(
                                `  • Promote: ${winner} → Semi-final ${semiPairIdx + 1} ${slot}${semiIdx === -1 ? ' (stage not found)' : ''}`
                            );
                        } else if (currentStage === '1/8 Final') {
                            const quarterIdx = stageLabels.indexOf('Quarter-final');
                            const quarterPairIdx = Math.floor(selectedPairIndex / 2);
                            const slot = selectedPairIndex % 2 === 0 ? 'team1' : 'team2';
                            lines.push(
                                `  • Promote: ${winner} → Quarter-final ${quarterPairIdx + 1} ${slot}${quarterIdx === -1 ? ' (stage not found)' : ''}`
                            );
                        } else if (currentStage === '1/16 Final') {
                            const eighthIdx = stageLabels.indexOf('1/8 Final');
                            const eighthPairIdx = Math.floor(selectedPairIndex / 2);
                            const slot = selectedPairIndex % 2 === 0 ? 'team1' : 'team2';
                            lines.push(
                                `  • Promote: ${winner} → 1/8 Final ${eighthPairIdx + 1} ${slot}${eighthIdx === -1 ? ' (stage not found)' : ''}`
                            );
                        } else if (currentStage === 'Final' || currentStage === 'Third Place') {
                            lines.push(`  • No promotion (${currentStage} is the final stage)`);
                        } else if (isLeague || isSwiss || isChampionsLeague) {
                            lines.push(
                                `  • Promotion: N/A (${isSwiss ? 'Swiss' : isChampionsLeague ? 'Champions League group' : 'league'} format)`
                            );
                        } else {
                            lines.push(`  • Promote: ${winner} → next stage`);
                        }
                    } else {
                        lines.push('  ✓ Promotion (already done)');
                    }

                    if (!skipTournamentStatus && currentStage === 'Final') {
                        lines.push('  • Set tournament status → Finished + snapshot leaderboard + recalculate stars');
                    } else if (currentStage === 'Final' && (skipTournamentStatus || reportData.mockMode)) {
                        lines.push(
                            reportData.mockMode
                                ? '  • Tournament status / star recalc: skipped (test mode)'
                                : '  ✓ Tournament status (already done)'
                        );
                    }

                    if (!skipBracket) {
                        lines.push('  • Save bracket to DB (PUT /bracket/playoffPairs)');
                    } else {
                        lines.push('  ✓ Bracket update (already done)');
                    }
                }

                const confirmed = window.confirm(
                    reportData.mockMode
                        ? `🧪 TEST MODE — bracket + promotion only\n\n${lines.join('\n')}\n\nContinue?`
                        : lines.join('\n')
                );
                if (!confirmed) {
                    setDetailedProgressStage('Cancelled');
                    alert('Game report submission cancelled. No changes were made.');
                    return;
                }
            }

            if (pair.gameStatus === 'Processed' && !authCtx.isAdmin) {
                alert('This game is already processed. Only admin can re-report it.');
                return;
            }

            if (!canReportGameForPair(pair)) {
                alert('Only match players or admin can submit this game report.');
                return;
            }

            pair.score1 = reportData.score1;
            pair.score2 = reportData.score2;
            pair.winner = reportData.winner;
            pair.testReport = Boolean(reportData.mockMode);
            // Ensure all progress fields are nested under 'progress' in each game
            pair.games = reportData.games.map((g) => {
                const stored = moveProgressFieldsToNested(stripUiFields(g));
                if (reportData.mockMode) {
                    stored.testOnly = true;
                }
                return stored;
            });
            // Set game status based on whether winner is selected
            pair.gameStatus = reportData.winner ? 'Finished' : 'In Progress';

            setPlayoffPairs(updatedPairs);
            await setDetailedProgressStage('Pair state updated');

            // Update castle statistics for each game (runs regardless of overall winner)
            let anyCastleWritten = false; // tracks if any castle stat was actually saved to DB
            if (!skipCastleStats && !reportData.mockMode) {
                for (let gameIndex = 0; gameIndex < reportData.games.length; gameIndex++) {
                    const game = reportData.games[gameIndex];
                    const castleIdx = gameIndex + 1;
                    // Per-game flags for downstream stages
                    game._skipRatings = skipRatings;
                    game._skipGamePost = skipGamePost;
                    game._skipPrizes = skipPrizes;

                    // Skip games that have already been fully processed
                    if (game.gameStatus === 'Processed') {
                        setDetailedProgressStage(`Game ${castleIdx} already processed`);
                        console.log(`Game ${game.gameId + 1} already processed, skipping castle stats update`);
                        continue;
                    }

                    if (game.castle1 && game.castle2 && game.gameWinner) {
                        console.log('game', game);
                        const c1Key = `g${gameIndex}_c1`;
                        const c2Key = `g${gameIndex}_c2`;
                        let castle1Skipped = false;
                        let castle2Skipped = false;

                        // Update castle1 stats
                        if (!completedCastleKeys.has(c1Key)) {
                            setDetailedProgressStage(`First castle processed`, {
                                castle: game.castle1,
                                gameId: game.gameId
                            });
                            // Use pre-fetched data if available, otherwise fetch now
                            let castle1Data = castleDataCache.get(game.castle1);
                            if (!castle1Data) {
                                const castle1Response = await authFetch(
                                    `${FIREBASE_DATABASE_URL}/statistic/heroes3/castles/${game.castle1}.json`
                                );
                                if (castle1Response.ok) {
                                    castle1Data = await castle1Response.json();
                                }
                            }
                            if (castle1Data !== undefined) {
                                const isWinner = game.castleWinner === game.castle1;
                                const updatedCastle1Stats = {
                                    win: (castle1Data.win || 0) + (isWinner ? 1 : 0),
                                    lose: (castle1Data.lose || 0) + (isWinner ? 0 : 1),
                                    total: (castle1Data.total || 0) + 1
                                };
                                const confirmCastle1 = confirmWindow(
                                    `Update ${game.castle1} castle stats?\n\nOld - Win: ${castle1Data.win || 0}, Lose: ${castle1Data.lose || 0}, Total: ${castle1Data.total || 0}\nNew - Win: ${updatedCastle1Stats.win}, Lose: ${updatedCastle1Stats.lose}, Total: ${updatedCastle1Stats.total}\n\nUpdate?`
                                );
                                if (confirmCastle1) {
                                    await authFetch(
                                        `${FIREBASE_DATABASE_URL}/statistic/heroes3/castles/${game.castle1}.json`,
                                        {
                                            method: 'PUT',
                                            body: JSON.stringify(updatedCastle1Stats),
                                            headers: { 'Content-Type': 'application/json' }
                                        }
                                    );
                                    console.log(`${game.castle1} castle stats updated`);
                                    updateGameStatusForPartialProgress(game);
                                    await updatePairProgressCastle(tournamentId, selectedPairId, c1Key);
                                    anyCastleWritten = true;
                                } else {
                                    castle1Skipped = true;
                                    console.log(`${game.castle1} castle stats update skipped`);
                                }
                            }
                        } else {
                            console.log(`${game.castle1} (game ${castleIdx}) already checkpointed, skipping`);
                        }

                        // Update castle2 stats
                        if (!completedCastleKeys.has(c2Key)) {
                            setDetailedProgressStage(`Second castle processed`, {
                                castle: game.castle2,
                                gameId: game.gameId
                            });
                            // Use pre-fetched data if available, otherwise fetch now
                            let castle2Data = castleDataCache.get(game.castle2);
                            if (!castle2Data) {
                                const castle2Response = await authFetch(
                                    `${FIREBASE_DATABASE_URL}/statistic/heroes3/castles/${game.castle2}.json`
                                );
                                if (castle2Response.ok) {
                                    castle2Data = await castle2Response.json();
                                }
                            }
                            if (castle2Data !== undefined) {
                                const isWinner = game.castleWinner === game.castle2;
                                const updatedCastle2Stats = {
                                    win: (castle2Data.win || 0) + (isWinner ? 1 : 0),
                                    lose: (castle2Data.lose || 0) + (isWinner ? 0 : 1),
                                    total: (castle2Data.total || 0) + 1
                                };
                                const confirmCastle2 = confirmWindow(
                                    `Update ${game.castle2} castle stats?\n\nOld - Win: ${castle2Data.win || 0}, Lose: ${castle2Data.lose || 0}, Total: ${castle2Data.total || 0}\nNew - Win: ${updatedCastle2Stats.win}, Lose: ${updatedCastle2Stats.lose}, Total: ${updatedCastle2Stats.total}\n\nUpdate?`
                                );
                                if (confirmCastle2) {
                                    await authFetch(
                                        `${FIREBASE_DATABASE_URL}/statistic/heroes3/castles/${game.castle2}.json`,
                                        {
                                            method: 'PUT',
                                            body: JSON.stringify(updatedCastle2Stats),
                                            headers: { 'Content-Type': 'application/json' }
                                        }
                                    );
                                    console.log(`${game.castle2} castle stats updated`);
                                    updateGameStatusForPartialProgress(game);
                                    await updatePairProgressCastle(tournamentId, selectedPairId, c2Key);
                                    anyCastleWritten = true;
                                } else {
                                    castle2Skipped = true;
                                    console.log(`${game.castle2} castle stats update skipped`);
                                }
                            }
                        } else {
                            console.log(`${game.castle2} (game ${castleIdx}) already checkpointed, skipping`);
                        }

                        // If both castle updates were skipped, still mark as processed
                        if (castle1Skipped && castle2Skipped) {
                            game.gameStatus = 'Processed';
                            if (pair.games[gameIndex]) {
                                pair.games[gameIndex].gameStatus = 'Processed';
                            }
                            setDetailedProgressStage(`Game ${castleIdx} marked as Processed (skipped)`, {
                                gameId: game.gameId
                            });
                            console.log(`Game ${game.gameId + 1} marked as Processed (skipped)`);
                        } else if (!castle1Skipped || !castle2Skipped) {
                            // At least one castle was written — mark the individual game as Processed
                            game.gameStatus = 'Processed';
                            if (pair.games[gameIndex]) {
                                pair.games[gameIndex].gameStatus = 'Processed';
                            }
                        }
                    }
                }

                // Save castle_stats stage checkpoint only if at least one castle was actually written to DB
                if (anyCastleWritten) {
                    await updatePairProgressStage(tournamentId, selectedPairId, 'castle_stats');
                    pair.gameStatus = 'PartiallyProcessed';
                    setPlayoffPairs(updatedPairs);
                }
            } else {
                console.log('Castle stats step skipped (already done in previous session)');
            }

            // If overall winner is selected, handle ratings, game posting, and promotions
            if (reportData.winner) {
                const isDraw = reportData.winner === 'draw';
                // Update player ratings and stats (each writes its own checkpoint via onCheckpoint callback)
                let ratingResult = null;
                if (!isDraw && (!skipRatings || !skipPlayerStats)) {
                    const winnerId = await lookForUserId(reportData.winner);
                    ratingResult = await updatePlayerRatings(pair.team1, pair.team2, winnerId, {
                        skipRatings,
                        skipPlayerStats,
                        seriesGames: pair.games,
                        onCheckpoint: (stage) => updatePairProgressStage(tournamentId, selectedPairId, stage)
                    });
                    setDetailedProgressStage('Ratings and stats updated');
                } else {
                    console.log('Ratings and player_stats steps skipped (already done in previous session)');
                }

                // Use the newly calculated ratings directly
                let team1NewRating = null;
                let team2NewRating = null;
                if (ratingResult && ratingResult.newRatings) {
                    team1NewRating = ratingResult.newRatings[pair.team1];
                    team2NewRating = ratingResult.newRatings[pair.team2];

                    if (team1NewRating !== null && team1NewRating !== undefined) {
                        const currentRatings1 =
                            typeof pair.ratings1 === 'string'
                                ? pair.ratings1
                                : pair.ratings1 !== null && pair.ratings1 !== undefined
                                  ? String(pair.ratings1)
                                  : '';
                        pair.ratings1 = currentRatings1 ? `${currentRatings1}, ${team1NewRating}` : `${team1NewRating}`;
                    }
                    if (team2NewRating !== null && team2NewRating !== undefined) {
                        const currentRatings2 =
                            typeof pair.ratings2 === 'string'
                                ? pair.ratings2
                                : pair.ratings2 !== null && pair.ratings2 !== undefined
                                  ? String(pair.ratings2)
                                  : '';
                        pair.ratings2 = currentRatings2 ? `${currentRatings2}, ${team2NewRating}` : `${team2NewRating}`;
                    }
                }
                // Update state to reflect the new ratings for tooltip display
                setPlayoffPairs(updatedPairs);

                if (!skipGamePost) {
                    // Post game to database
                    const gameData = {
                        opponent1: pair.team1,
                        opponent2: pair.team2,
                        date: new Date().toISOString(),
                        games: reportData.games.map((g) => moveProgressFieldsToNested(stripUiFields(g))),
                        tournamentName: tournamentName,
                        tournamentId,
                        stage: pair.stage || stageLabels[selectedStageIndex] || null,
                        stageIndex: selectedStageIndex,
                        pairIndex: selectedPairIndex,
                        gameType: pair.type,
                        opponent1Castle: reportData.games[0]?.castle1 || '',
                        opponent2Castle: reportData.games[0]?.castle2 || '',
                        score: `${reportData.score1}-${reportData.score2}`,
                        winner: reportData.winner,
                        streamUrl: pair.streamUrl || pair.streamLogin || null,
                        streamLogin: pair.streamLogin || null
                    };

                    console.log('Game data to be posted:', JSON.stringify(gameData, null, 2));
                    console.log(
                        'Games with gold and restarts:',
                        gameData.games.map((g) => ({
                            gameId: g.gameId,
                            gold1: g.gold1,
                            gold2: g.gold2,
                            restart1_111: g.restart1_111,
                            restart1_112: g.restart1_112,
                            restart2_111: g.restart2_111,
                            restart2_112: g.restart2_112
                        }))
                    );

                    const confirmGamePost = confirmWindow(
                        `Post game to database?\n\n${pair.team1} vs ${pair.team2}\nScore: ${reportData.score1}-${reportData.score2}\nWinner: ${reportData.winner}\n\nPost game?`
                    );
                    if (confirmGamePost) {
                        const matchKey = buildMatchKey(gameData, tournamentId);
                        gameData.matchKey = matchKey;

                        const existingGameResponse = await authFetch(
                            `${FIREBASE_DATABASE_URL}/games/heroes3/${matchKey}.json`
                        );
                        const existingGameData = await existingGameResponse.json();

                        if (existingGameData) {
                            console.log('Skipping duplicate game record:', gameData);
                        } else {
                            const fetchResponse = await authFetch(
                                `${FIREBASE_DATABASE_URL}/games/heroes3/${matchKey}.json`,
                                {
                                    method: 'PUT',
                                    body: JSON.stringify(gameData),
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                }
                            );

                            if (fetchResponse.ok) {
                                console.log('Game posted to database successfully');
                                console.log('Gold and restart data stored for all games');
                            } else {
                                console.error('Error posting game to database:', fetchResponse.statusText);
                            }
                        }
                    } else {
                        console.log('Game posting skipped by user');
                    }
                    await updatePairProgressStage(tournamentId, selectedPairId, 'game_posted');
                } else {
                    console.log('Game post step skipped (already done in previous session)');
                }

                if (!skipPromotion) {
                    setDetailedProgressStage('Promotion processing');
                    // Promote winner and loser to next stage
                    const currentStage = stageLabels[selectedStageIndex];
                    const winner = reportData.winner;
                    const loser = pair.team1 === winner ? pair.team2 : pair.team1;

                    console.log(`Current stage: ${currentStage}, Winner: ${winner}, Loser: ${loser}`);

                    // Promote based on current stage
                    if (currentStage === 'Semi-final') {
                        // Winner goes to Final, Loser goes to Third Place
                        const finalStageIndex = stageLabels.indexOf('Final');
                        const thirdPlaceStageIndex = stageLabels.indexOf('Third Place');

                        // Use the newly calculated ratings
                        const winnerRating = winner === pair.team1 ? team1NewRating : team2NewRating;
                        const loserRating = winner === pair.team1 ? team2NewRating : team1NewRating;

                        // Promote winner to Final
                        if (
                            finalStageIndex !== -1 &&
                            updatedPairs[finalStageIndex] &&
                            updatedPairs[finalStageIndex][0]
                        ) {
                            const finalPair = updatedPairs[finalStageIndex][0];
                            const teamSlot = selectedPairIndex === 0 ? 'team1' : 'team2';

                            const confirmPromoteToFinal = confirmWindow(
                                `Promote winner to Final?\n\n${winner} → Final ${teamSlot}\n\nPromote?`
                            );

                            if (confirmPromoteToFinal) {
                                // Determine which slot to fill based on which semi-final this is
                                if (selectedPairIndex === 0) {
                                    // First semi-final winner goes to team1 of Final
                                    if (finalPair.team1 === 'TBD' || !finalPair.team1) {
                                        finalPair.team1 = winner;
                                        finalPair.ratings1 =
                                            winnerRating ||
                                            (pair.winner === pair.team1 ? pair.ratings1 : pair.ratings2);
                                        finalPair.stars1 = pair.winner === pair.team1 ? pair.stars1 : pair.stars2;
                                        console.log(
                                            `Promoted ${winner} to Final team1 with updated rating: ${finalPair.ratings1}`
                                        );
                                    }
                                } else if (selectedPairIndex === 1) {
                                    // Second semi-final winner goes to team2 of Final
                                    if (finalPair.team2 === 'TBD' || !finalPair.team2) {
                                        finalPair.team2 = winner;
                                        finalPair.ratings2 =
                                            winnerRating ||
                                            (pair.winner === pair.team1 ? pair.ratings1 : pair.ratings2);
                                        finalPair.stars2 = pair.winner === pair.team1 ? pair.stars1 : pair.stars2;
                                        console.log(
                                            `Promoted ${winner} to Final team2 with updated rating: ${finalPair.ratings2}`
                                        );
                                    }
                                }
                            } else {
                                console.log(`Promotion to Final cancelled by user`);
                            }
                        }

                        // Promote loser to Third Place
                        if (
                            thirdPlaceStageIndex !== -1 &&
                            updatedPairs[thirdPlaceStageIndex] &&
                            updatedPairs[thirdPlaceStageIndex][0]
                        ) {
                            const thirdPlacePair = updatedPairs[thirdPlaceStageIndex][0];
                            const teamSlot = selectedPairIndex === 0 ? 'team1' : 'team2';

                            const confirmPromoteToThirdPlace = confirmWindow(
                                `Promote loser to Third Place?\n\n${loser} → Third Place ${teamSlot}\n\nPromote?`
                            );

                            if (confirmPromoteToThirdPlace) {
                                // Determine which slot to fill based on which semi-final this is
                                if (selectedPairIndex === 0) {
                                    // First semi-final loser goes to team1 of Third Place
                                    if (thirdPlacePair.team1 === 'TBD' || !thirdPlacePair.team1) {
                                        thirdPlacePair.team1 = loser;
                                        thirdPlacePair.ratings1 =
                                            loserRating || (pair.winner === pair.team1 ? pair.ratings2 : pair.ratings1);
                                        thirdPlacePair.stars1 = pair.winner === pair.team1 ? pair.stars2 : pair.stars1;
                                        console.log(
                                            `Promoted ${loser} to Third Place team1 with updated rating: ${thirdPlacePair.ratings1}`
                                        );
                                    }
                                } else if (selectedPairIndex === 1) {
                                    // Second semi-final loser goes to team2 of Third Place
                                    if (thirdPlacePair.team2 === 'TBD' || !thirdPlacePair.team2) {
                                        thirdPlacePair.team2 = loser;
                                        thirdPlacePair.ratings2 =
                                            loserRating || (pair.winner === pair.team1 ? pair.ratings2 : pair.ratings1);
                                        thirdPlacePair.stars2 = pair.winner === pair.team1 ? pair.stars2 : pair.stars1;
                                        console.log(
                                            `Promoted ${loser} to Third Place team2 with updated rating: ${thirdPlacePair.ratings2}`
                                        );
                                    }
                                }
                            } else {
                                console.log(`Promotion to Third Place cancelled by user`);
                            }
                        }
                    } else if (currentStage === 'Quarter-final') {
                        // Winner goes to Semi-final
                        // Use the newly calculated rating for the winner
                        const winnerRating = winner === pair.team1 ? team1NewRating : team2NewRating;

                        const semiStageIndex = stageLabels.indexOf('Semi-final');
                        if (semiStageIndex !== -1 && updatedPairs[semiStageIndex]) {
                            const semiPairIndex = Math.floor(selectedPairIndex / 2);
                            const semiPair = updatedPairs[semiStageIndex][semiPairIndex];
                            if (semiPair) {
                                const teamSlot = selectedPairIndex % 2 === 0 ? 'team1' : 'team2';
                                const ratingsSlot = selectedPairIndex % 2 === 0 ? 'ratings1' : 'ratings2';
                                const starsSlot = selectedPairIndex % 2 === 0 ? 'stars1' : 'stars2';

                                const confirmPromoteToSemi = confirmWindow(
                                    `Promote winner to Semi-final?\n\n${winner} → Semi-final ${semiPairIndex + 1} ${teamSlot}\n\nPromote?`
                                );

                                if (confirmPromoteToSemi) {
                                    if (semiPair[teamSlot] === 'TBD' || !semiPair[teamSlot]) {
                                        semiPair[teamSlot] = winner;
                                        semiPair[ratingsSlot] =
                                            winnerRating ||
                                            (pair.winner === pair.team1 ? pair.ratings1 : pair.ratings2);
                                        semiPair[starsSlot] = pair.winner === pair.team1 ? pair.stars1 : pair.stars2;
                                        console.log(
                                            `Promoted ${winner} to Semi-final ${semiPairIndex} ${teamSlot} with updated rating: ${semiPair[ratingsSlot]}`
                                        );
                                    }
                                } else {
                                    console.log(`Promotion to Semi-final cancelled by user`);
                                }
                            }
                        }
                    } else if (currentStage === '1/8 Final') {
                        // Winner goes to Quarter-final
                        // Use the newly calculated rating for the winner
                        const winnerRating = winner === pair.team1 ? team1NewRating : team2NewRating;

                        const quarterStageIndex = stageLabels.indexOf('Quarter-final');
                        if (quarterStageIndex !== -1 && updatedPairs[quarterStageIndex]) {
                            const quarterPairIndex = Math.floor(selectedPairIndex / 2);
                            const quarterPair = updatedPairs[quarterStageIndex][quarterPairIndex];
                            if (quarterPair) {
                                const teamSlot = selectedPairIndex % 2 === 0 ? 'team1' : 'team2';
                                const ratingsSlot = selectedPairIndex % 2 === 0 ? 'ratings1' : 'ratings2';
                                const starsSlot = selectedPairIndex % 2 === 0 ? 'stars1' : 'stars2';

                                const confirmPromoteToQuarter = confirmWindow(
                                    `Promote winner to Quarter-final?\n\n${winner} → Quarter-final ${quarterPairIndex + 1} ${teamSlot}\n\nPromote?`
                                );

                                if (confirmPromoteToQuarter) {
                                    if (quarterPair[teamSlot] === 'TBD' || !quarterPair[teamSlot]) {
                                        quarterPair[teamSlot] = winner;
                                        quarterPair[ratingsSlot] =
                                            winnerRating ||
                                            (pair.winner === pair.team1 ? pair.ratings1 : pair.ratings2);
                                        quarterPair[starsSlot] = pair.winner === pair.team1 ? pair.stars1 : pair.stars2;
                                        console.log(
                                            `Promoted ${winner} to Quarter-final ${quarterPairIndex} ${teamSlot} with updated rating: ${quarterPair[ratingsSlot]}`
                                        );
                                    }
                                } else {
                                    console.log(`Promotion to Quarter-final cancelled by user`);
                                }
                            }
                        }
                    } else if (currentStage === '1/16 Final') {
                        // Winner goes to 1/8 Final
                        // Use the newly calculated rating for the winner
                        const winnerRating = winner === pair.team1 ? team1NewRating : team2NewRating;

                        const eighthStageIndex = stageLabels.indexOf('1/8 Final');
                        if (eighthStageIndex !== -1 && updatedPairs[eighthStageIndex]) {
                            const eighthPairIndex = Math.floor(selectedPairIndex / 2);
                            const eighthPair = updatedPairs[eighthStageIndex][eighthPairIndex];
                            if (eighthPair) {
                                const teamSlot = selectedPairIndex % 2 === 0 ? 'team1' : 'team2';
                                const ratingsSlot = selectedPairIndex % 2 === 0 ? 'ratings1' : 'ratings2';
                                const starsSlot = selectedPairIndex % 2 === 0 ? 'stars1' : 'stars2';

                                const confirmPromoteToEighth = confirmWindow(
                                    `Promote winner to 1/8 Final?\n\n${winner} → 1/8 Final ${eighthPairIndex + 1} ${teamSlot}\n\nPromote?`
                                );

                                if (confirmPromoteToEighth) {
                                    if (eighthPair[teamSlot] === 'TBD' || !eighthPair[teamSlot]) {
                                        eighthPair[teamSlot] = winner;
                                        eighthPair[ratingsSlot] =
                                            winnerRating ||
                                            (pair.winner === pair.team1 ? pair.ratings1 : pair.ratings2);
                                        eighthPair[starsSlot] = pair.winner === pair.team1 ? pair.stars1 : pair.stars2;
                                        console.log(
                                            `Promoted ${winner} to 1/8 Final ${eighthPairIndex} ${teamSlot} with updated rating: ${eighthPair[ratingsSlot]}`
                                        );
                                    }
                                } else {
                                    console.log(`Promotion to 1/8 Final cancelled by user`);
                                }
                            }
                        }
                    }

                    if (hasLoserBracket && reportData.winner) {
                        const loserRating = winner === pair.team1 ? team2NewRating : team1NewRating;
                        const loserStars = winner === pair.team1 ? pair.stars2 : pair.stars1;
                        const winnerRating = winner === pair.team1 ? team1NewRating : team2NewRating;
                        const winnerStars = winner === pair.team1 ? pair.stars1 : pair.stars2;

                        if (
                            !currentStage.startsWith('LB') &&
                            currentStage !== 'Grand Final' &&
                            loser &&
                            loser !== 'TBD'
                        ) {
                            dropLoserToBracket({
                                updatedPairs,
                                stageLabels,
                                currentStage,
                                pairIndex: selectedPairIndex,
                                loser,
                                loserRating,
                                loserStars,
                                maxPlayers
                            });
                        }

                        if (currentStage.startsWith('LB') || currentStage === 'LB Final') {
                            promoteLoserBracketWinner({
                                updatedPairs,
                                stageLabels,
                                currentStage,
                                pairIndex: selectedPairIndex,
                                winner,
                                winnerRating,
                                winnerStars,
                                maxPlayers
                            });
                        }
                    }

                    // Update the local state with promoted players
                    setPlayoffPairs(updatedPairs);
                    setDetailedProgressStage('Finished');
                    await updatePairProgressStage(tournamentId, selectedPairId, 'promotion');
                }

                if (!skipPrizes) {
                    const currentStage = stageLabels[selectedStageIndex];
                    const winner = reportData.winner;
                    const loser = pair.team1 === winner ? pair.team2 : pair.team1;

                    if (currentStage === 'Third Place') {
                        // Award Third Place prize to the winner
                        console.log(`Third Place game completed. Winner: ${winner}`);

                        const confirmThirdPlacePrize = confirmWindow(
                            `Award Third Place prize to ${winner}?\n\nThis will update the tournament winners and player's prize record.\n\nAward prize?`
                        );

                        if (confirmThirdPlacePrize) {
                            try {
                                // Get tournament prizes
                                const prizes = await pullTournamentPrizes(tournamentId);
                                const prizeAmount = prizes['3rd Place'];

                                console.log('Third Place Prize:', prizeAmount);

                                // Find and update player record
                                const playerId = await lookForUserId(winner);
                                if (playerId) {
                                    const playerData = await loadUserById(playerId);

                                    if (playerData) {
                                        // Initialize prizes array if it doesn't exist
                                        if (!playerData.prizes) {
                                            playerData.prizes = [];
                                        }

                                        // Add new prize
                                        playerData.prizes.push({
                                            tournamentName: tournamentName,
                                            place: '3rd Place',
                                            prizeAmount: prizeAmount
                                        });

                                        // Calculate new total prize
                                        const currentTotal = await getPlayerPrizeTotal(playerId);
                                        const newTotal = parseFloat(currentTotal || 0) + parseFloat(prizeAmount);
                                        playerData.totalPrize = newTotal;

                                        console.log('Updated player data:', playerData);

                                        // Update tournament winners
                                        const confirmUpdateWinner = confirmWindow(
                                            `Update tournament 3rd place winner?\n\nWinner: ${winner}\nPrize: ${prizeAmount}\n\nUpdate?`
                                        );

                                        if (confirmUpdateWinner) {
                                            await authFetch(
                                                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/winners/3rd place.json`,
                                                {
                                                    method: 'PUT',
                                                    body: JSON.stringify(winner),
                                                    headers: { 'Content-Type': 'application/json' }
                                                }
                                            );
                                            console.log('Tournament 3rd place winner updated');
                                        }

                                        // Update player record
                                        const confirmUpdatePlayer = confirmWindow(
                                            `Update player record with prize?\n\nPlayer: ${winner}\nOld Total: ${currentTotal}\nNew Total: ${newTotal}\n\nUpdate?`
                                        );

                                        if (confirmUpdatePlayer) {
                                            await authFetch(`${FIREBASE_DATABASE_URL}/users/${playerId}.json`, {
                                                method: 'PUT',
                                                body: JSON.stringify(playerData),
                                                headers: { 'Content-Type': 'application/json' }
                                            });
                                            console.log('Player record updated with 3rd place prize');
                                        }
                                    } else {
                                        console.log('Player data not found');
                                        alert('Could not load player data for prize award');
                                    }
                                } else {
                                    console.log('Player ID not found');
                                    alert('Could not find player ID for prize award');
                                }
                            } catch (error) {
                                console.error('Error awarding Third Place prize:', error);
                                alert('Error awarding Third Place prize: ' + error.message);
                            }

                            console.log('Third Place prizes awarded');
                            await updatePairProgressStage(tournamentId, selectedPairId, 'prizes');
                        } else {
                            console.log('Third Place prize award cancelled by user');
                        }
                    } else if (currentStage === 'Final') {
                        // Award Final prizes to winner (1st place) and loser (2nd place)
                        console.log(`Final game completed. Winner: ${winner}, Runner-up: ${loser}`);

                        const confirmFinalPrizes = confirmWindow(
                            `Award Final prizes?\n\n1st Place: ${winner}\n2nd Place: ${loser}\n\nThis will update tournament winners and player prize records.\n\nAward prizes?`
                        );

                        if (confirmFinalPrizes) {
                            try {
                                // Get tournament prizes
                                const prizes = await pullTournamentPrizes(tournamentId);
                                const firstPlacePrize = prizes['1st Place'];
                                const secondPlacePrize = prizes['2nd Place'];

                                console.log('1st Place Prize:', firstPlacePrize);
                                console.log('2nd Place Prize:', secondPlacePrize);

                                // Award 1st place prize
                                const firstPlacePlayerId = await lookForUserId(winner);
                                if (firstPlacePlayerId) {
                                    const winnerData = await loadUserById(firstPlacePlayerId);
                                    if (winnerData) {
                                        // Initialize prizes array if it doesn't exist
                                        if (!winnerData.prizes) {
                                            winnerData.prizes = [];
                                        }

                                        // Add new prize
                                        winnerData.prizes.push({
                                            tournamentName: tournamentName,
                                            place: '1st Place',
                                            prizeAmount: firstPlacePrize
                                        });

                                        // Calculate new total prize
                                        const winnerCurrentTotal = await getPlayerPrizeTotal(firstPlacePlayerId);
                                        const winnerNewTotal =
                                            parseFloat(winnerCurrentTotal || 0) + parseFloat(firstPlacePrize);
                                        winnerData.totalPrize = winnerNewTotal;

                                        console.log('Updated winner data:', winnerData);

                                        // Update tournament 1st place winner
                                        const confirmUpdateWinner = confirmWindow(
                                            `Update tournament 1st place winner?\n\nWinner: ${winner}\nPrize: ${firstPlacePrize}\n\nUpdate?`
                                        );

                                        if (confirmUpdateWinner) {
                                            await authFetch(
                                                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/winners/1st place.json`,
                                                {
                                                    method: 'PUT',
                                                    body: JSON.stringify(winner),
                                                    headers: { 'Content-Type': 'application/json' }
                                                }
                                            );
                                            console.log('Tournament 1st place winner updated');
                                        }

                                        // Update winner record
                                        const confirmUpdateWinnerPlayer = confirmWindow(
                                            `Update winner record with prize?\n\nPlayer: ${winner}\nOld Total: ${winnerCurrentTotal}\nNew Total: ${winnerNewTotal}\n\nUpdate?`
                                        );

                                        if (confirmUpdateWinnerPlayer) {
                                            await authFetch(
                                                `${FIREBASE_DATABASE_URL}/users/${firstPlacePlayerId}.json`,
                                                {
                                                    method: 'PUT',
                                                    body: JSON.stringify(winnerData),
                                                    headers: { 'Content-Type': 'application/json' }
                                                }
                                            );
                                            console.log('Winner record updated with 1st place prize');
                                        }
                                    } else {
                                        console.log('Winner data not found');
                                        alert('Could not load winner data for prize award');
                                    }
                                } else {
                                    console.log('Winner ID not found');
                                    alert('Could not find winner ID for prize award');
                                }

                                // Award 2nd place prize
                                const secondPlacePlayerId = await lookForUserId(loser);
                                if (secondPlacePlayerId) {
                                    const loserData = await loadUserById(secondPlacePlayerId);
                                    if (loserData) {
                                        // Initialize prizes array if it doesn't exist
                                        if (!loserData.prizes) {
                                            loserData.prizes = [];
                                        }

                                        // Add new prize
                                        loserData.prizes.push({
                                            tournamentName: tournamentName,
                                            place: '2nd Place',
                                            prizeAmount: secondPlacePrize
                                        });

                                        // Calculate new total prize
                                        const loserCurrentTotal = await getPlayerPrizeTotal(secondPlacePlayerId);
                                        const loserNewTotal =
                                            parseFloat(loserCurrentTotal || 0) + parseFloat(secondPlacePrize);
                                        loserData.totalPrize = loserNewTotal;

                                        console.log('Updated runner-up data:', loserData);

                                        // Update tournament 2nd place winner
                                        const confirmUpdateRunnerUp = confirmWindow(
                                            `Update tournament 2nd place winner?\n\nRunner-up: ${loser}\nPrize: ${secondPlacePrize}\n\nUpdate?`
                                        );

                                        if (confirmUpdateRunnerUp) {
                                            await authFetch(
                                                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/winners/2nd place.json`,
                                                {
                                                    method: 'PUT',
                                                    body: JSON.stringify(loser),
                                                    headers: { 'Content-Type': 'application/json' }
                                                }
                                            );
                                            console.log('Tournament 2nd place winner updated');
                                        }

                                        // Update runner-up record
                                        const confirmUpdateLoserPlayer = confirmWindow(
                                            `Update runner-up record with prize?\n\nPlayer: ${loser}\nOld Total: ${loserCurrentTotal}\nNew Total: ${loserNewTotal}\n\nUpdate?`
                                        );

                                        if (confirmUpdateLoserPlayer) {
                                            await authFetch(
                                                `${FIREBASE_DATABASE_URL}/users/${secondPlacePlayerId}.json`,
                                                {
                                                    method: 'PUT',
                                                    body: JSON.stringify(loserData),
                                                    headers: { 'Content-Type': 'application/json' }
                                                }
                                            );
                                            console.log('Runner-up record updated with 2nd place prize');
                                        }
                                    } else {
                                        console.log('Runner-up data not found');
                                        alert('Could not load runner-up data for prize award');
                                    }
                                } else {
                                    console.log('Runner-up ID not found');
                                    alert('Could not find runner-up ID for prize award');
                                }
                            } catch (error) {
                                console.error('Error awarding Final prizes:', error);
                                alert('Error awarding Final prizes: ' + error.message);
                            }

                            console.log('Final prizes awarded');
                            await updatePairProgressStage(tournamentId, selectedPairId, 'prizes');

                            if (!skipTournamentStatus) {
                                // Update tournament status to "Tournament Finished"
                                const confirmStatusUpdate = confirmWindow(
                                    `Update tournament status to 'Tournament Finished'?\n\nThis will mark the tournament as complete.\n\nUpdate status?`
                                );

                                if (confirmStatusUpdate) {
                                    try {
                                        await authFetch(
                                            `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/status.json`,
                                            {
                                                method: 'PUT',
                                                body: JSON.stringify('Tournament Finished'),
                                                headers: { 'Content-Type': 'application/json' }
                                            }
                                        );
                                        console.log('Tournament status updated to Tournament Finished');

                                        // Automatically snapshot current leaderboard rankings after tournament finishes
                                        try {
                                            const snapshotResult = await snapshotLeaderboardRanks();
                                            if (snapshotResult.success) {
                                                console.log(
                                                    `Leaderboard snapshot taken after tournament: ${snapshotResult.successCount} players, ${snapshotResult.errorCount} errors`
                                                );
                                            } else {
                                                console.error(
                                                    'Failed to snapshot leaderboard after tournament:',
                                                    snapshotResult.error
                                                );
                                            }
                                        } catch (error) {
                                            console.error('Error during leaderboard snapshot after tournament:', error);
                                        }

                                        // Recalculate stars for all players based on new ratings
                                        const confirmRecalculateStars = confirmWindow(
                                            `Recalculate stars for all players based on updated ratings?\n\nThis will update every player's star count.`
                                        );

                                        if (confirmRecalculateStars) {
                                            try {
                                                const result = await recalculatePlayerStars();
                                                console.log(
                                                    `All player stars recalculated successfully. Updated ${result.updatedCount} players.`
                                                );
                                                alert('Player stars recalculated successfully!');
                                            } catch (error) {
                                                console.error('Error recalculating stars:', error);
                                                alert('Error recalculating stars: ' + error.message);
                                            }
                                        } else {
                                            console.log('Star recalculation cancelled by user');
                                        }
                                    } catch (error) {
                                        console.error('Error updating tournament status:', error);
                                        alert('Error updating tournament status: ' + error.message);
                                    }
                                } else {
                                    console.log('Tournament status update cancelled by user');
                                }
                                await updatePairProgressStage(tournamentId, selectedPairId, 'tournament_status');
                            }
                        } else {
                            console.log('Final prizes award cancelled by user');
                        }
                    }
                }
            } // end if (reportData.winner)

            // All stages done — mark pair and games as Processed only when there's an overall winner
            if (reportData.winner) {
                pair.gameStatus = 'Processed';
                reportData.games.forEach((game) => {
                    game.gameStatus = 'Processed';
                });
            }
            // Sync games back into updatedPairs
            updatedPairs[selectedStageIndex][selectedPairIndex].games = pair.games;

            // Post to Firebase
            if (!skipBracket) {
                const confirmBracketUpdate =
                    reportData.mockMode ||
                    confirmWindow(
                        `Update tournament bracket in database?\n\nThis will save all changes to the tournament.\n\nUpdate bracket?`
                    );
                if (confirmBracketUpdate) {
                    const response = await authFetch(
                        `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/bracket/playoffPairs.json`,
                        {
                            method: 'PUT',
                            body: JSON.stringify(updatedPairs),
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    if (response.ok) {
                        await updatePairProgressStage(tournamentId, selectedPairId, 'bracket');
                        await savePairProgress(tournamentId, selectedPairId, null); // clear saved progress on success
                        setShowReportGameModal(false);
                        const skippedList = [
                            skipCastleStats && 'castle_stats',
                            skipRatings && 'ratings',
                            skipPlayerStats && 'player_stats',
                            skipGamePost && 'game_posted',
                            skipPrizes && 'prizes',
                            skipPromotion && 'promotion',
                            skipTournamentStatus && 'tournament_status',
                            skipBracket && 'bracket'
                        ].filter(Boolean);
                        const skippedMsg = reportData.mockMode
                            ? '\n\n(Test mode — bracket saved; global stats and castle availability were not updated.)'
                            : skippedList.length > 0
                              ? `\n\nAlready completed (skipped): ${skippedList.join(', ')}`
                              : '';
                        alert(`Game result reported successfully!${skippedMsg}`);
                    } else {
                        alert('Error updating tournament bracket');
                    }
                } else {
                    console.log('Bracket update skipped by user');
                    alert('Bracket update cancelled - local changes saved but not synced to database');
                    setShowReportGameModal(false);
                }
            } else {
                console.log('Bracket update step skipped (already done in previous session)');
                setShowReportGameModal(false);
                await savePairProgress(tournamentId, selectedPairId, null);
                const skippedList = [
                    skipCastleStats && 'castle_stats',
                    skipRatings && 'ratings',
                    skipPlayerStats && 'player_stats',
                    skipGamePost && 'game_posted',
                    skipPrizes && 'prizes',
                    skipPromotion && 'promotion',
                    skipTournamentStatus && 'tournament_status',
                    skipBracket && 'bracket'
                ].filter(Boolean);
                const skippedMsg = reportData.mockMode
                    ? '\n\n(Test mode — bracket saved; global stats and castle availability were not updated.)'
                    : skippedList.length > 0
                      ? `\n\nAlready completed (skipped): ${skippedList.join(', ')}`
                      : '';
                alert(`Game result reported successfully!${skippedMsg}`);
            }
        } catch (error) {
            setDetailedProgressStage('Error', { error: error.message });
            console.error('Error reporting game result:', error);
            alert('Error reporting game result');
        }
    };
    const selectedReportPair =
        selectedStageIndex !== null && selectedPairIndex !== null
            ? playoffPairs[selectedStageIndex]?.[selectedPairIndex]
            : null;
    const canShowReportModal =
        showReportGameModal &&
        selectedStageIndex !== null &&
        selectedPairIndex !== null &&
        selectedReportPair &&
        selectedReportPair.team1 &&
        selectedReportPair.team2 &&
        selectedReportPair.team1 !== 'TBD' &&
        selectedReportPair.team2 !== 'TBD';

    const clearReportUrlParams = () => {
        if (!searchParams.get('report') && !searchParams.get('game')) {
            return;
        }
        const next = new URLSearchParams(searchParams);
        next.delete('report');
        next.delete('game');
        setSearchParams(next, { replace: true });
    };

    const handleCloseReportModal = () => {
        reportDismissedRef.current = true;
        setShowReportGameModal(false);
        clearReportUrlParams();
    };

    const renderMatchScheduleControl = (pair, stageIndex, pairIndex) => {
        const canSchedule = canSchedulePairForPair(pair);
        if (!pair?.scheduledAt && !canSchedule) {
            return null;
        }

        return (
            <div className={classes.knockoutScheduleWrap}>
                <MatchScheduleControl
                    scheduledAt={pair.scheduledAt}
                    scheduledBy={pair.scheduledBy}
                    canEdit={canSchedule}
                    onSave={(iso) => handleSaveMatchSchedule(stageIndex, pairIndex, iso)}
                    showMissingHint={canSchedule}
                />
            </div>
        );
    };

    const _renderKnockoutReportButton = (pair, stageIndex, pairIndex) => {
        if (pair.team1 === 'TBD' || pair.team2 === 'TBD') {
            return null;
        }
        if (!canViewReportButtonForPair(pair)) {
            return null;
        }
        if (pair.gameStatus === 'Processed' && !authCtx.isAdmin) {
            return null;
        }
        const isProcessed = pair.gameStatus === 'Processed';
        return (
            <button
                type="button"
                className={`${classes.knockoutReportBtn} ${isProcessed ? classes.knockoutReportBtnMuted : ''}`}
                onClick={() => handleOpenReportGame(pair, stageIndex, pairIndex)}
            >
                {isProcessed ? 'Re-report Game' : 'Report Game'}
            </button>
        );
    };

    const _renderMatchFormatBadge = (pair) => {
        const label = pair.type === 'bo-5' ? 'BO5' : pair.type === 'bo-3' ? 'BO3' : 'BO1';
        const extraClass =
            pair.type === 'bo-5'
                ? classes.matchFormatBadgeBo5
                : pair.type === 'bo-3'
                  ? classes.matchFormatBadgeBo3
                  : '';
        return <div className={`${classes.matchFormatBadge} ${extraClass}`}>⚔ {label}</div>;
    };

    const _getKnockoutGameBlockClass = (isHighlighted) =>
        `${classes['game-block']} ${isHighlighted ? classes.gameBlockHighlighted : ''}`;

    return (
        <div
            className={`scrollable-list-class brackets-class ${classes.bracketShell} ${fullScreen ? classes.bracketShellFull : ''}`}
        >
            <div className={classes.fixedHeader}>
                {!startTournament && (
                    <div className={classes.headerBar}>
                        <div className={classes.headerSide} aria-hidden="true" />

                        <div className={classes.headerCenter}>
                            <div className={classes.headerTitle}>{tournamentName}</div>
                            {tournamentWinners && (
                                <div className={classes.headerWinners}>
                                    {tournamentWinners['1st place'] && (
                                        <span className={classes.headerWinnerGold}>
                                            🥇 Gold: {tournamentWinners['1st place']}
                                        </span>
                                    )}
                                    {tournamentWinners['2nd place'] && (
                                        <span className={classes.headerWinnerSilver}>
                                            🥈 Silver: {tournamentWinners['2nd place']}
                                        </span>
                                    )}
                                    {tournamentWinners['3rd place'] && (
                                        <span className={classes.headerWinnerBronze}>
                                            🥉 Bronze: {tournamentWinners['3rd place']}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className={`${classes.headerSide} ${classes.headerSideEnd}`}>
                            {authCtx.isAdmin && strictCastlePick && (
                                <button onClick={() => handleGetAvailableCastles()} className={classes.actionButton}>
                                    Get Available Castles
                                </button>
                            )}
                            {authCtx.isAdmin &&
                                (tournamentStatus === 'Tournament Finished' ||
                                    String(tournamentStatus || '').includes('Finished')) && (
                                    <button
                                        onClick={async () => {
                                            const confirmed = window.confirm(
                                                "Recalculate stars for ALL players based on their current ratings?\n\nThis will update every player's star count."
                                            );
                                            if (!confirmed) {
                                                return;
                                            }
                                            try {
                                                const result = await recalculatePlayerStars();
                                                alert(
                                                    `Stars recalculated successfully! Updated ${result.updatedCount} players.`
                                                );
                                            } catch (error) {
                                                console.error('Error recalculating stars:', error);
                                                alert('Error recalculating stars: ' + error.message);
                                            }
                                        }}
                                        className={`${classes.actionButton} ${classes.actionButtonSecondary}`}
                                    >
                                        Recalculate stars
                                    </button>
                                )}
                        </div>
                    </div>
                )}
            </div>

            {/* Render the spinning wheel modal */}
            {isSpinningWheelOpen && (
                <Modal
                    onClose={() => {
                        setIsSpinningWheelOpen(false);
                        setSpinningWheelMode('kickoff');
                    }}
                >
                    <SpinningWheel
                        players={playersObj}
                        onStartTournament={onStartTournament}
                        mode={spinningWheelMode}
                    />
                </Modal>
            )}

            {strictCastlePick && showCastlesModal && (
                <div className={classes.castlesModalBackdrop} onClick={() => setShowCastlesModal(false)}>
                    <div className={classes.castlesModal} onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className={classes.castlesModalClose}
                            onClick={() => setShowCastlesModal(false)}
                            aria-label="Close"
                        >
                            ×
                        </button>
                        <div className={classes.castlesModalHeader}>
                            <h3 className={classes.castlesModalTitle}>Available Castles</h3>
                            <div className={classes.castlesModalLegend}>
                                <span className={classes.castlesModalLegendItem}>
                                    <span
                                        className={`${classes.castlesModalLegendSwatch} ${classes.castlesModalLegendLow}`}
                                    />
                                    Fewest games
                                </span>
                                <span className={classes.castlesModalLegendItem}>
                                    <span
                                        className={`${classes.castlesModalLegendSwatch} ${classes.castlesModalLegendHigh}`}
                                    />
                                    Most games
                                </span>
                                <span className={classes.castlesModalLegendItem}>
                                    <span
                                        className={`${classes.castlesModalLegendSwatch} ${classes.castlesModalLegendLive}`}
                                    />
                                    Live in progress
                                </span>
                            </div>
                        </div>
                        <ul className={classes.castlesModalList}>
                            {(() => {
                                const totals = availableCastles.map((castle) => castle.total + (castle.liveGames || 0));
                                const minTotal = Math.min(...totals);
                                const maxTotal = Math.max(...totals);

                                return availableCastles.map((castle, idx) => {
                                    const isLive = castle.liveGames > 0;
                                    const castleTotal = castle.total + (castle.liveGames || 0);
                                    const castleImage = getCastleImage(castle.name);
                                    const rowClass = [
                                        classes.castlesModalRow,
                                        isLive ? classes.castlesModalRowLive : '',
                                        castleTotal === minTotal ? classes.castlesModalRowLow : '',
                                        castleTotal === maxTotal ? classes.castlesModalRowHigh : ''
                                    ]
                                        .filter(Boolean)
                                        .join(' ');

                                    return (
                                        <li key={idx} className={rowClass}>
                                            <div className={classes.castlesModalMain}>
                                                {castleImage ? (
                                                    <img
                                                        src={castleImage}
                                                        alt=""
                                                        className={classes.castlesModalThumb}
                                                    />
                                                ) : (
                                                    <div
                                                        className={classes.castlesModalThumbFallback}
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                <span className={classes.castlesModalName}>
                                                    {castle.name}
                                                    {isLive && (
                                                        <span className={classes.castlesModalLiveBadge}>
                                                            <span className={classes.liveDot} />
                                                            Live ({castle.liveGames})
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                            <span className={classes.castlesModalStats}>
                                                Games: {castle.total}
                                                {isLive && (
                                                    <span className={classes.castlesModalLiveCount}>
                                                        +{castle.liveGames}
                                                    </span>
                                                )}
                                            </span>
                                        </li>
                                    );
                                });
                            })()}
                        </ul>
                        <div className={classes.castlesModalFooter}>
                            <button
                                type="button"
                                className={`${classes.actionButton} ${classes.castlesModalFooterBtn}`}
                                onClick={() => setShowCastlesModal(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!startTournament &&
                tournamentStatus === 'Registration finished!' &&
                !isLeague &&
                !isSwiss &&
                !isChampionsLeague && (
                    <button onClick={handleStartTournament} className={classes.actionButton}>
                        Start Tournament
                    </button>
                )}
            {startTournament && playoffPairs.length === 0 && (
                <button onClick={() => shuffleArray(uniquePlayerNames)} className={classes.actionButton}>
                    Shuffle
                </button>
            )}

            {stageLabels.length === 0 && !isLeague && !isSwiss && !isChampionsLeague ? (
                <h6>Tournament registration hasn't started</h6>
            ) : usesScheduleView ? (
                <div className={classes.bracketBody}>
                    {isChampionsLeague && (
                        <p style={{ textAlign: 'center', margin: '0 0 1rem', color: 'var(--color-text-muted)' }}>
                            Group stage — top 2 from each group advance to knockout
                        </p>
                    )}
                    {isSwiss && swissTotalRounds > 0 && (
                        <p style={{ textAlign: 'center', margin: '0 0 1rem', color: 'var(--color-text-muted)' }}>
                            Swiss round {swissCurrentRound} of {swissTotalRounds}
                        </p>
                    )}
                    <LeagueBracket
                        pairs={playoffPairs[0] || []}
                        registeredPlayers={registeredPlayerNames}
                        playersObj={playersObj}
                        roundLabel={isSwiss ? 'Round' : 'Matchday'}
                        scheduleTitle={
                            isChampionsLeague ? 'Champions League groups' : isSwiss ? 'Swiss views' : 'League views'
                        }
                        groupLabels={isChampionsLeague ? championsGroupLabels : []}
                        highlightPair={urlHighlightPair}
                        storageStageIndex={0}
                        onSelectPair={(pairIdx) => {
                            const pair = playoffPairs[0]?.[pairIdx];
                            if (pair) {
                                handleOpenReportGame(pair, 0, pairIdx);
                            }
                        }}
                        canViewReportButton={canViewReportButtonForPair}
                        canSchedulePair={canSchedulePairForPair}
                        onSaveSchedule={(pairIdx, iso) => handleSaveMatchSchedule(0, pairIdx, iso)}
                    />
                    {authCtx.isAdmin &&
                        isChampionsLeague &&
                        championsLeaguePhase === 'group' &&
                        tournamentStatus !== 'Tournament Finished' &&
                        isChampionsLeagueGroupStageComplete(playoffPairs[0] || []) && (
                            <div style={{ textAlign: 'center', padding: '1.5rem 0 0.5rem' }}>
                                <button className={classes.actionButton} onClick={handleStartChampionsKnockout}>
                                    Start knockout stage
                                </button>
                            </div>
                        )}
                    {authCtx.isAdmin &&
                        isSwiss &&
                        tournamentStatus !== 'Tournament Finished' &&
                        swissCurrentRound < swissTotalRounds &&
                        isSwissRoundComplete(playoffPairs[0] || [], swissCurrentRound) && (
                            <div style={{ textAlign: 'center', padding: '1.5rem 0 0.5rem' }}>
                                <button className={classes.actionButton} onClick={handleGenerateNextSwissRound}>
                                    Generate round {swissCurrentRound + 1}
                                </button>
                            </div>
                        )}
                    {authCtx.isAdmin &&
                        (isLeague || isSwiss) &&
                        tournamentStatus !== 'Tournament Finished' &&
                        (playoffPairs[0] || []).length > 0 &&
                        (playoffPairs[0] || []).every((p) => p.winner) &&
                        (!isSwiss || swissCurrentRound >= swissTotalRounds) && (
                            <div style={{ textAlign: 'center', padding: '1.5rem 0 0.5rem' }}>
                                <button
                                    className={classes.actionButton}
                                    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)' }}
                                    onClick={handleFinishLeague}
                                >
                                    {isSwiss ? '🏆 Finish Swiss' : '🏆 Finish League'}
                                </button>
                            </div>
                        )}
                </div>
            ) : (
                (() => {
                    const clKnockoutOffset = isChampionsLeague && championsLeaguePhase === 'knockout' ? 1 : 0;
                    const bracketPairs = clKnockoutOffset > 0 ? playoffPairs.slice(clKnockoutOffset) : playoffPairs;
                    const storageStage = (labelIndex) => labelIndex + clKnockoutOffset;

                    const allDisplayStages = stageLabels.filter((s) => s !== 'Third Place');
                    const displayStages = getKnockoutPaginationStages(stageLabels, isMobileKnockoutView);
                    const clampedStage = Math.min(activeBracketStage, displayStages.length - 1);
                    const currentDisplayStage = displayStages[clampedStage];
                    const stageIndex = stageLabels.indexOf(currentDisplayStage);
                    const thirdPlaceIndex = stageLabels.indexOf('Third Place');
                    const nextDisplayStage = isMobileKnockoutView
                        ? null
                        : (displayStages[clampedStage + 1] ??
                          (clampedStage === displayStages.length - 1 && allDisplayStages.length > displayStages.length
                              ? allDisplayStages[allDisplayStages.length - 1]
                              : null));
                    const nextStageIndex = nextDisplayStage !== null ? stageLabels.indexOf(nextDisplayStage) : -1;

                    // Shared bracket layout constants
                    const BLOCK_H = 180;
                    const BLOCK_GAP = 16;
                    const leftMatchCount = bracketPairs[stageIndex]?.length ?? 0;
                    const rightMatchCount = nextStageIndex !== -1 ? (bracketPairs[nextStageIndex]?.length ?? 0) : 0;
                    const leftColHeight = leftMatchCount * BLOCK_H + Math.max(0, leftMatchCount - 1) * BLOCK_GAP;
                    const bracketRatio = rightMatchCount > 0 ? leftMatchCount / rightMatchCount : 2;
                    // Pixel distance from top of right column to top of right block i
                    const getRightBlockTop = (i) =>
                        ((2 * i * bracketRatio + bracketRatio - 1) * (BLOCK_H + BLOCK_GAP)) / 2;
                    // SVG Y% for left block i (out of leftColHeight)
                    const getSvgLeftY = (i) =>
                        (((i * (BLOCK_H + BLOCK_GAP) + BLOCK_H / 2) / leftColHeight) * 100).toFixed(2);
                    // SVG Y% for right block i (center of absolutely-positioned block, out of leftColHeight)
                    const getSvgRightY = (i) =>
                        (((getRightBlockTop(i) + BLOCK_H / 2) / leftColHeight) * 100).toFixed(2);

                    return (
                        <div className={classes.bracketBody} style={{ width: '100%' }}>
                            {clKnockoutOffset > 0 && (
                                <p className={classes.knockoutBanner}>
                                    Knockout stage — group winners vs runners-up from other groups
                                </p>
                            )}
                            <div className={classes.knockoutNav}>
                                <button
                                    type="button"
                                    className={classes.knockoutNavBtn}
                                    onClick={() => setActiveBracketStage((prev) => Math.max(0, prev - 1))}
                                    disabled={clampedStage === 0}
                                    aria-label="Previous stage"
                                >
                                    ←
                                </button>
                                <div className={classes.knockoutNavCenter}>
                                    <div className={classes.knockoutStageTitle}>
                                        {isMobileKnockoutView
                                            ? currentDisplayStage === 'Final'
                                                ? 'Final & Third Place'
                                                : currentDisplayStage
                                            : nextDisplayStage !== null
                                              ? `${currentDisplayStage === 'Final' ? 'Final' : currentDisplayStage} → ${nextDisplayStage === 'Final' ? 'Final' : nextDisplayStage}`
                                              : currentDisplayStage === 'Final'
                                                ? 'Final & Third Place'
                                                : currentDisplayStage}
                                    </div>
                                    <div className={classes.knockoutStageMeta}>
                                        Stage {clampedStage + 1}
                                        {!isMobileKnockoutView && nextDisplayStage !== null
                                            ? `–${clampedStage + 2}`
                                            : ''}{' '}
                                        of {displayStages.length}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={classes.knockoutNavBtn}
                                    onClick={() =>
                                        setActiveBracketStage((prev) => Math.min(displayStages.length - 1, prev + 1))
                                    }
                                    disabled={clampedStage === displayStages.length - 1}
                                    aria-label="Next stage"
                                >
                                    →
                                </button>
                            </div>

                            <div className={classes.knockoutDots}>
                                {displayStages.map((label, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className={`${classes.knockoutDot} ${idx === clampedStage ? classes.knockoutDotActive : ''}`}
                                        onClick={() => setActiveBracketStage(idx)}
                                        title={label}
                                        aria-label={`Go to ${label}`}
                                    />
                                ))}
                            </div>

                            <div
                                className={`${classes.knockoutColumns} ${isMobileKnockoutView ? classes.knockoutColumnsMobile : ''}`}
                            >
                                <div className={classes['bracket-stage-single']}>
                                    <h3 className={classes.knockoutColumnTitle}>
                                        {currentDisplayStage === 'Final' ? 'Final' : currentDisplayStage}
                                    </h3>
                                    {currentDisplayStage === 'Final' ? (
                                        /* === FINAL + THIRD PLACE === */
                                        <div>
                                            {(bracketPairs[stageIndex] || []).map((pair, pairIndex) => {
                                                const { team1, team2 } = pair;
                                                const hasTruthyPlayers =
                                                    (team1 && team2 && team1 !== 'TBD') || team2 !== 'TBD';
                                                const isFinalHighlighted =
                                                    highlightedPairRef.current?.stageIndex ===
                                                        storageStage(stageIndex) &&
                                                    highlightedPairRef.current?.pairIndex === pairIndex;
                                                return (
                                                    <div
                                                        key={`final-${pairIndex}`}
                                                        id={`pair-s${storageStage(stageIndex)}-p${pairIndex}`}
                                                        className={classes['game-block']}
                                                        style={{
                                                            position: 'relative',
                                                            ...(isFinalHighlighted && {
                                                                outline: '3px solid #ffd700',
                                                                boxShadow: '0 0 18px rgba(255,215,0,0.55)'
                                                            })
                                                        }}
                                                    >
                                                        {renderMatchScheduleControl(
                                                            pair,
                                                            storageStage(stageIndex),
                                                            pairIndex
                                                        )}
                                                        <div
                                                            style={{
                                                                display: 'grid',
                                                                gridTemplateColumns: 'minmax(0, 1fr) auto',
                                                                alignItems: 'center',
                                                                gap: '0.75rem',
                                                                width: '100%'
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: '0.5rem',
                                                                    minWidth: 0
                                                                }}
                                                            >
                                                                <PlayerBracket
                                                                    pair={pair}
                                                                    team={'team1'}
                                                                    pairIndex={pairIndex}
                                                                    hasTruthyPlayers={hasTruthyPlayers}
                                                                    stageIndex={storageStage(stageIndex)}
                                                                    setPlayoffPairs={setPlayoffPairs}
                                                                    handleCastleChange={handleCastleChange}
                                                                    handleScoreChange={handleScoreChange}
                                                                    handleBlur={handleBlur}
                                                                    handleRadioChange={handleRadioChange}
                                                                    stage={'Final'}
                                                                    teamIndex={1}
                                                                    getWinner={getWinner}
                                                                    clickedRadioButton={clickedRadioButton}
                                                                    playersObj={playersObj}
                                                                />
                                                                <PlayerBracket
                                                                    pair={pair}
                                                                    team={'team2'}
                                                                    pairIndex={pairIndex}
                                                                    hasTruthyPlayers={hasTruthyPlayers}
                                                                    stageIndex={storageStage(stageIndex)}
                                                                    setPlayoffPairs={setPlayoffPairs}
                                                                    handleCastleChange={handleCastleChange}
                                                                    handleScoreChange={handleScoreChange}
                                                                    handleBlur={handleBlur}
                                                                    handleRadioChange={handleRadioChange}
                                                                    stage={'Final'}
                                                                    teamIndex={2}
                                                                    getWinner={getWinner}
                                                                    isManualScore={isManualScore}
                                                                    clickedRadioButton={clickedRadioButton}
                                                                    playersObj={playersObj}
                                                                />
                                                            </div>
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    gap: '0.5rem',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'flex-end'
                                                                }}
                                                            >
                                                                {pair.team1 !== 'TBD' &&
                                                                pair.team2 !== 'TBD' &&
                                                                canViewReportButtonForPair(pair) &&
                                                                (pair.gameStatus !== 'Processed' || authCtx.isAdmin) ? (
                                                                    <button
                                                                        onClick={() =>
                                                                            handleOpenReportGame(
                                                                                pair,
                                                                                storageStage(stageIndex),
                                                                                pairIndex
                                                                            )
                                                                        }
                                                                        style={{
                                                                            padding: '0.5rem 1rem',
                                                                            background:
                                                                                pair.gameStatus === 'Processed'
                                                                                    ? '#808080'
                                                                                    : 'gold',
                                                                            border: 'none',
                                                                            borderRadius: '6px',
                                                                            color:
                                                                                pair.gameStatus === 'Processed'
                                                                                    ? '#ffffff'
                                                                                    : 'rgb(62, 32, 192)',
                                                                            fontWeight: 'bold',
                                                                            cursor: 'pointer',
                                                                            fontSize: '0.9rem'
                                                                        }}
                                                                    >
                                                                        {pair.gameStatus === 'Processed'
                                                                            ? 'Re-report Game'
                                                                            : 'Report Game'}
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    bottom: '0.5rem',
                                                                    right: '0.5rem',
                                                                    zIndex: 2
                                                                }}
                                                            >
                                                                {renderShowStatsButton(
                                                                    pair.team1,
                                                                    pair.team2,
                                                                    handleShowStats
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <h3 className={classes.knockoutSubTitle}>Third Place</h3>
                                            {thirdPlaceIndex !== -1 &&
                                                (bracketPairs[thirdPlaceIndex] || []).map((pair, pairIndex) => {
                                                    const { team1, team2 } = pair;
                                                    const hasTruthyPlayers =
                                                        (team1 && team2 && team1 !== 'TBD') || team2 !== 'TBD';
                                                    const isThirdHighlighted =
                                                        highlightedPairRef.current?.stageIndex ===
                                                            storageStage(thirdPlaceIndex) &&
                                                        highlightedPairRef.current?.pairIndex === pairIndex;
                                                    return (
                                                        <div
                                                            key={`thirdplace-${pairIndex}`}
                                                            id={`pair-s${storageStage(thirdPlaceIndex)}-p${pairIndex}`}
                                                            className={classes['game-block']}
                                                            style={{
                                                                position: 'relative',
                                                                ...(isThirdHighlighted && {
                                                                    outline: '3px solid #ffd700',
                                                                    boxShadow: '0 0 18px rgba(255,215,0,0.55)'
                                                                })
                                                            }}
                                                        >
                                                            {renderMatchScheduleControl(
                                                                pair,
                                                                storageStage(thirdPlaceIndex),
                                                                pairIndex
                                                            )}
                                                            <div
                                                                style={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                                                                    alignItems: 'center',
                                                                    gap: '0.75rem',
                                                                    width: '100%'
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        gap: '0.5rem',
                                                                        minWidth: 0
                                                                    }}
                                                                >
                                                                    <PlayerBracket
                                                                        pair={pair}
                                                                        team={'team1'}
                                                                        pairIndex={pairIndex}
                                                                        hasTruthyPlayers={hasTruthyPlayers}
                                                                        stageIndex={storageStage(thirdPlaceIndex)}
                                                                        setPlayoffPairs={setPlayoffPairs}
                                                                        handleCastleChange={handleCastleChange}
                                                                        handleScoreChange={handleScoreChange}
                                                                        handleBlur={handleBlur}
                                                                        handleRadioChange={handleRadioChange}
                                                                        stage={'Third Place'}
                                                                        teamIndex={1}
                                                                        getWinner={getWinner}
                                                                        clickedRadioButton={clickedRadioButton}
                                                                        playersObj={playersObj}
                                                                        sourcePair={
                                                                            bracketPairs[thirdPlaceIndex - 1]?.[
                                                                                pairIndex * 2
                                                                            ]
                                                                        }
                                                                        sourceIsLoser={true}
                                                                    />
                                                                    <PlayerBracket
                                                                        pair={pair}
                                                                        team={'team2'}
                                                                        pairIndex={pairIndex}
                                                                        hasTruthyPlayers={hasTruthyPlayers}
                                                                        stageIndex={storageStage(thirdPlaceIndex)}
                                                                        setPlayoffPairs={setPlayoffPairs}
                                                                        handleCastleChange={handleCastleChange}
                                                                        handleScoreChange={handleScoreChange}
                                                                        handleBlur={handleBlur}
                                                                        handleRadioChange={handleRadioChange}
                                                                        stage={'Third Place'}
                                                                        teamIndex={2}
                                                                        getWinner={getWinner}
                                                                        isManualScore={isManualScore}
                                                                        clickedRadioButton={clickedRadioButton}
                                                                        playersObj={playersObj}
                                                                        sourcePair={
                                                                            bracketPairs[thirdPlaceIndex - 1]?.[
                                                                                pairIndex * 2 + 1
                                                                            ]
                                                                        }
                                                                        sourceIsLoser={true}
                                                                    />
                                                                </div>
                                                                <div
                                                                    style={{
                                                                        display: 'flex',
                                                                        gap: '0.5rem',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'flex-end'
                                                                    }}
                                                                >
                                                                    {pair.team1 !== 'TBD' &&
                                                                    pair.team2 !== 'TBD' &&
                                                                    canViewReportButtonForPair(pair) &&
                                                                    (pair.gameStatus !== 'Processed' ||
                                                                        authCtx.isAdmin) ? (
                                                                        <button
                                                                            onClick={() =>
                                                                                handleOpenReportGame(
                                                                                    pair,
                                                                                    storageStage(thirdPlaceIndex),
                                                                                    pairIndex
                                                                                )
                                                                            }
                                                                            style={{
                                                                                padding: '0.5rem 1rem',
                                                                                background:
                                                                                    pair.gameStatus === 'Processed'
                                                                                        ? '#808080'
                                                                                        : 'gold',
                                                                                border: 'none',
                                                                                borderRadius: '6px',
                                                                                color:
                                                                                    pair.gameStatus === 'Processed'
                                                                                        ? '#ffffff'
                                                                                        : 'rgb(62, 32, 192)',
                                                                                fontWeight: 'bold',
                                                                                cursor: 'pointer',
                                                                                fontSize: '0.9rem'
                                                                            }}
                                                                        >
                                                                            {pair.gameStatus === 'Processed'
                                                                                ? 'Re-report Game'
                                                                                : 'Report Game'}
                                                                        </button>
                                                                    ) : null}
                                                                </div>
                                                                <div
                                                                    style={{
                                                                        position: 'absolute',
                                                                        bottom: '0.5rem',
                                                                        right: '0.5rem',
                                                                        zIndex: 2
                                                                    }}
                                                                >
                                                                    {renderShowStatsButton(
                                                                        pair.team1,
                                                                        pair.team2,
                                                                        handleShowStats
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    ) : (
                                        /* === OTHER STAGES === */
                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '1rem' }}>
                                            {bracketPairs[stageIndex]?.map((pair, pairIndex) => {
                                                const { team1, team2 } = pair;
                                                const hasTruthyPlayers =
                                                    (team1 && team2 && team1 !== 'TBD') || team2 !== 'TBD';
                                                const isOtherHighlighted =
                                                    highlightedPairRef.current?.stageIndex ===
                                                        storageStage(stageIndex) &&
                                                    highlightedPairRef.current?.pairIndex === pairIndex;
                                                return (
                                                    <div
                                                        key={pairIndex}
                                                        id={`pair-s${storageStage(stageIndex)}-p${pairIndex}`}
                                                        className={classes['game-block']}
                                                        style={{
                                                            position: 'relative',
                                                            minHeight: '180px',
                                                            marginBottom: 0,
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            justifyContent: 'flex-start',
                                                            gap: '0.5rem',
                                                            ...(isOtherHighlighted && {
                                                                outline: '3px solid #ffd700',
                                                                boxShadow: '0 0 18px rgba(255,215,0,0.55)'
                                                            })
                                                        }}
                                                    >
                                                        {renderMatchScheduleControl(
                                                            pair,
                                                            storageStage(stageIndex),
                                                            pairIndex
                                                        )}
                                                        <div
                                                            style={{
                                                                position: 'absolute',
                                                                bottom: '0.5rem',
                                                                right: '0.5rem',
                                                                zIndex: 2
                                                            }}
                                                        >
                                                            {renderShowStatsButton(
                                                                pair.team1,
                                                                pair.team2,
                                                                handleShowStats
                                                            )}
                                                        </div>
                                                        <div
                                                            style={{
                                                                display: 'grid',
                                                                gridTemplateColumns: 'minmax(0, 1fr) auto',
                                                                alignItems: 'center',
                                                                gap: '0.75rem',
                                                                width: '100%'
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: '0.5rem',
                                                                    minWidth: 0
                                                                }}
                                                            >
                                                                <PlayerBracket
                                                                    pair={pair}
                                                                    team={'team1'}
                                                                    pairIndex={pairIndex}
                                                                    hasTruthyPlayers={hasTruthyPlayers}
                                                                    stageIndex={storageStage(stageIndex)}
                                                                    setPlayoffPairs={setPlayoffPairs}
                                                                    handleCastleChange={handleCastleChange}
                                                                    handleScoreChange={handleScoreChange}
                                                                    handleBlur={handleBlur}
                                                                    handleRadioChange={handleRadioChange}
                                                                    stage={currentDisplayStage}
                                                                    teamIndex={1}
                                                                    getWinner={getWinner}
                                                                    clickedRadioButton={clickedRadioButton}
                                                                    sourcePair={
                                                                        stageIndex > 0
                                                                            ? bracketPairs[stageIndex - 1]?.[
                                                                                  pairIndex * 2
                                                                              ]
                                                                            : undefined
                                                                    }
                                                                />
                                                                <PlayerBracket
                                                                    pair={pair}
                                                                    team={'team2'}
                                                                    pairIndex={pairIndex}
                                                                    hasTruthyPlayers={hasTruthyPlayers}
                                                                    stageIndex={storageStage(stageIndex)}
                                                                    setPlayoffPairs={setPlayoffPairs}
                                                                    handleCastleChange={handleCastleChange}
                                                                    handleScoreChange={handleScoreChange}
                                                                    handleBlur={handleBlur}
                                                                    handleRadioChange={handleRadioChange}
                                                                    stage={currentDisplayStage}
                                                                    teamIndex={2}
                                                                    getWinner={getWinner}
                                                                    isManualScore={isManualScore}
                                                                    clickedRadioButton={clickedRadioButton}
                                                                    sourcePair={
                                                                        stageIndex > 0
                                                                            ? bracketPairs[stageIndex - 1]?.[
                                                                                  pairIndex * 2 + 1
                                                                              ]
                                                                            : undefined
                                                                    }
                                                                />
                                                            </div>
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    gap: '0.5rem',
                                                                    alignItems: 'center'
                                                                }}
                                                            >
                                                                {pair.team1 !== 'TBD' &&
                                                                pair.team2 !== 'TBD' &&
                                                                canViewReportButtonForPair(pair) &&
                                                                (pair.gameStatus !== 'Processed' || authCtx.isAdmin) ? (
                                                                    <button
                                                                        onClick={() =>
                                                                            handleOpenReportGame(
                                                                                pair,
                                                                                storageStage(stageIndex),
                                                                                pairIndex
                                                                            )
                                                                        }
                                                                        style={{
                                                                            padding: '0.5rem 1rem',
                                                                            background:
                                                                                pair.gameStatus === 'Processed'
                                                                                    ? '#808080'
                                                                                    : 'gold',
                                                                            border: 'none',
                                                                            borderRadius: '6px',
                                                                            color:
                                                                                pair.gameStatus === 'Processed'
                                                                                    ? '#ffffff'
                                                                                    : 'rgb(62, 32, 192)',
                                                                            fontWeight: 'bold',
                                                                            cursor: 'pointer',
                                                                            fontSize: '0.9rem'
                                                                        }}
                                                                    >
                                                                        {pair.gameStatus === 'Processed'
                                                                            ? 'Re-report Game'
                                                                            : 'Report Game'}
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <div
                                                            style={{
                                                                position: 'absolute',
                                                                top: '0.5rem',
                                                                right: '0.5rem',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                background: 'rgba(0,0,0,0.55)',
                                                                border: `1px solid ${pair.type === 'bo-5' ? 'rgba(180,80,255,0.7)' : pair.type === 'bo-3' ? 'rgba(255,120,80,0.7)' : 'rgba(255,215,0,0.5)'}`,
                                                                borderRadius: '4px',
                                                                padding: '1px 7px',
                                                                fontSize: '0.65rem',
                                                                fontWeight: 'bold',
                                                                color:
                                                                    pair.type === 'bo-5'
                                                                        ? '#cc88ff'
                                                                        : pair.type === 'bo-3'
                                                                          ? '#ff9966'
                                                                          : '#FFD700',
                                                                letterSpacing: '1.5px',
                                                                zIndex: 2,
                                                                textTransform: 'uppercase'
                                                            }}
                                                        >
                                                            ⚔{' '}
                                                            {pair.type === 'bo-5'
                                                                ? 'BO5'
                                                                : pair.type === 'bo-3'
                                                                  ? 'BO3'
                                                                  : 'BO1'}
                                                        </div>
                                                        {pair.games &&
                                                            pair.games.some(
                                                                (g) => g.castle1 && g.castle2 && !g.castleWinner
                                                            ) && (
                                                                <span
                                                                    className={classes.liveDot}
                                                                    style={{
                                                                        position: 'absolute',
                                                                        top: '0.5rem',
                                                                        left: '0.5rem',
                                                                        zIndex: 3
                                                                    }}
                                                                />
                                                            )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                {nextDisplayStage !== null &&
                                    currentDisplayStage !== 'Final' &&
                                    (() => {
                                        if (!leftMatchCount || !rightMatchCount) {
                                            return null;
                                        }
                                        return (
                                            <svg
                                                className={classes.knockoutConnector}
                                                viewBox="0 0 100 100"
                                                preserveAspectRatio="none"
                                            >
                                                {Array.from({ length: leftMatchCount }, (_, i) => {
                                                    const leftY = getSvgLeftY(i);
                                                    const rightMatchIdx = Math.min(
                                                        Math.floor(i / 2),
                                                        rightMatchCount - 1
                                                    );
                                                    const rightY = getSvgRightY(rightMatchIdx);
                                                    return (
                                                        <path
                                                            key={i}
                                                            d={`M 0,${leftY} C 50,${leftY} 50,${rightY} 100,${rightY}`}
                                                            stroke="rgba(201, 162, 39, 0.35)"
                                                            strokeWidth="2"
                                                            fill="none"
                                                            vectorEffect="non-scaling-stroke"
                                                        />
                                                    );
                                                })}
                                            </svg>
                                        );
                                    })()}
                                {nextDisplayStage !== null && (
                                    <div className={classes['bracket-stage-single']}>
                                        {/* Column header */}
                                        <h3 className={classes.knockoutColumnTitle}>
                                            {nextDisplayStage === 'Final' ? 'Final' : nextDisplayStage}
                                        </h3>
                                        {nextDisplayStage === 'Final' ? (
                                            /* === FINAL + THIRD PLACE === */
                                            <div>
                                                {(bracketPairs[nextStageIndex] || []).map((pair, pairIndex) => {
                                                    const { team1, team2 } = pair;
                                                    const hasTruthyPlayers =
                                                        (team1 && team2 && team1 !== 'TBD') || team2 !== 'TBD';
                                                    const isFinalNextHighlighted =
                                                        highlightedPairRef.current?.stageIndex ===
                                                            storageStage(nextStageIndex) &&
                                                        highlightedPairRef.current?.pairIndex === pairIndex;
                                                    return (
                                                        <div
                                                            key={`final-next-${pairIndex}`}
                                                            id={`pair-s${storageStage(nextStageIndex)}-p${pairIndex}`}
                                                            className={classes['game-block']}
                                                            style={{
                                                                position: 'relative',
                                                                ...(isFinalNextHighlighted && {
                                                                    outline: '3px solid #ffd700',
                                                                    boxShadow: '0 0 18px rgba(255,215,0,0.55)'
                                                                })
                                                            }}
                                                        >
                                                            {renderMatchScheduleControl(
                                                                pair,
                                                                storageStage(nextStageIndex),
                                                                pairIndex
                                                            )}
                                                            <div
                                                                style={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                                                                    alignItems: 'center',
                                                                    gap: '0.75rem',
                                                                    width: '100%'
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        gap: '0.5rem',
                                                                        minWidth: 0
                                                                    }}
                                                                >
                                                                    <PlayerBracket
                                                                        pair={pair}
                                                                        team={'team1'}
                                                                        pairIndex={pairIndex}
                                                                        hasTruthyPlayers={hasTruthyPlayers}
                                                                        stageIndex={storageStage(nextStageIndex)}
                                                                        setPlayoffPairs={setPlayoffPairs}
                                                                        handleCastleChange={handleCastleChange}
                                                                        handleScoreChange={handleScoreChange}
                                                                        handleBlur={handleBlur}
                                                                        handleRadioChange={handleRadioChange}
                                                                        stage={'Final'}
                                                                        teamIndex={1}
                                                                        getWinner={getWinner}
                                                                        clickedRadioButton={clickedRadioButton}
                                                                        playersObj={playersObj}
                                                                        sourcePair={
                                                                            bracketPairs[stageIndex]?.[pairIndex * 2]
                                                                        }
                                                                    />
                                                                    <PlayerBracket
                                                                        pair={pair}
                                                                        team={'team2'}
                                                                        pairIndex={pairIndex}
                                                                        hasTruthyPlayers={hasTruthyPlayers}
                                                                        stageIndex={storageStage(nextStageIndex)}
                                                                        setPlayoffPairs={setPlayoffPairs}
                                                                        handleCastleChange={handleCastleChange}
                                                                        handleScoreChange={handleScoreChange}
                                                                        handleBlur={handleBlur}
                                                                        handleRadioChange={handleRadioChange}
                                                                        stage={'Final'}
                                                                        teamIndex={2}
                                                                        getWinner={getWinner}
                                                                        isManualScore={isManualScore}
                                                                        clickedRadioButton={clickedRadioButton}
                                                                        playersObj={playersObj}
                                                                        sourcePair={
                                                                            bracketPairs[stageIndex]?.[
                                                                                pairIndex * 2 + 1
                                                                            ]
                                                                        }
                                                                    />
                                                                </div>
                                                                <div
                                                                    style={{
                                                                        display: 'flex',
                                                                        gap: '0.5rem',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'flex-end'
                                                                    }}
                                                                >
                                                                    {pair.team1 !== 'TBD' &&
                                                                    pair.team2 !== 'TBD' &&
                                                                    canViewReportButtonForPair(pair) &&
                                                                    (pair.gameStatus !== 'Processed' ||
                                                                        authCtx.isAdmin) ? (
                                                                        <button
                                                                            onClick={() =>
                                                                                handleOpenReportGame(
                                                                                    pair,
                                                                                    storageStage(nextStageIndex),
                                                                                    pairIndex
                                                                                )
                                                                            }
                                                                            style={{
                                                                                padding: '0.5rem 1rem',
                                                                                background:
                                                                                    pair.gameStatus === 'Processed'
                                                                                        ? '#808080'
                                                                                        : 'gold',
                                                                                border: 'none',
                                                                                borderRadius: '6px',
                                                                                color:
                                                                                    pair.gameStatus === 'Processed'
                                                                                        ? '#ffffff'
                                                                                        : 'rgb(62, 32, 192)',
                                                                                fontWeight: 'bold',
                                                                                cursor: 'pointer',
                                                                                fontSize: '0.9rem'
                                                                            }}
                                                                        >
                                                                            {pair.gameStatus === 'Processed'
                                                                                ? 'Re-report Game'
                                                                                : 'Report Game'}
                                                                        </button>
                                                                    ) : null}
                                                                </div>
                                                                <div
                                                                    style={{
                                                                        position: 'absolute',
                                                                        bottom: '0.5rem',
                                                                        right: '0.5rem',
                                                                        zIndex: 2
                                                                    }}
                                                                >
                                                                    {renderShowStatsButton(
                                                                        pair.team1,
                                                                        pair.team2,
                                                                        handleShowStats
                                                                    )}
                                                                </div>
                                                                <div
                                                                    style={{
                                                                        position: 'absolute',
                                                                        top: '0.5rem',
                                                                        right: '0.5rem',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        background: 'rgba(0,0,0,0.55)',
                                                                        border: `1px solid ${pair.type === 'bo-5' ? 'rgba(180,80,255,0.7)' : pair.type === 'bo-3' ? 'rgba(255,120,80,0.7)' : 'rgba(255,215,0,0.5)'}`,
                                                                        borderRadius: '4px',
                                                                        padding: '1px 7px',
                                                                        fontSize: '0.65rem',
                                                                        fontWeight: 'bold',
                                                                        color:
                                                                            pair.type === 'bo-5'
                                                                                ? '#cc88ff'
                                                                                : pair.type === 'bo-3'
                                                                                  ? '#ff9966'
                                                                                  : '#FFD700',
                                                                        letterSpacing: '1.5px',
                                                                        zIndex: 2,
                                                                        textTransform: 'uppercase'
                                                                    }}
                                                                >
                                                                    ⚔{' '}
                                                                    {pair.type === 'bo-5'
                                                                        ? 'BO5'
                                                                        : pair.type === 'bo-3'
                                                                          ? 'BO3'
                                                                          : 'BO1'}
                                                                </div>
                                                                {pair.games &&
                                                                    pair.games.some(
                                                                        (g) => g.castle1 && g.castle2 && !g.castleWinner
                                                                    ) && (
                                                                        <span
                                                                            className={classes.liveDot}
                                                                            style={{
                                                                                position: 'absolute',
                                                                                top: '0.5rem',
                                                                                left: '0.5rem',
                                                                                zIndex: 3
                                                                            }}
                                                                        />
                                                                    )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <h3 className={classes.knockoutSubTitle}>Third Place</h3>
                                                {thirdPlaceIndex !== -1 &&
                                                    (bracketPairs[thirdPlaceIndex] || []).map((pair, pairIndex) => {
                                                        const { team1, team2 } = pair;
                                                        const hasTruthyPlayers =
                                                            (team1 && team2 && team1 !== 'TBD') || team2 !== 'TBD';
                                                        const isThirdNextHighlighted =
                                                            highlightedPairRef.current?.stageIndex ===
                                                                storageStage(thirdPlaceIndex) &&
                                                            highlightedPairRef.current?.pairIndex === pairIndex;
                                                        return (
                                                            <div
                                                                key={`thirdplace-next-${pairIndex}`}
                                                                id={`pair-s${storageStage(thirdPlaceIndex)}-p${pairIndex}`}
                                                                className={classes['game-block']}
                                                                style={{
                                                                    position: 'relative',
                                                                    ...(isThirdNextHighlighted && {
                                                                        outline: '3px solid #ffd700',
                                                                        boxShadow: '0 0 18px rgba(255,215,0,0.55)'
                                                                    })
                                                                }}
                                                            >
                                                                {renderMatchScheduleControl(
                                                                    pair,
                                                                    storageStage(thirdPlaceIndex),
                                                                    pairIndex
                                                                )}
                                                                <div
                                                                    style={{
                                                                        display: 'grid',
                                                                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                                                                        alignItems: 'center',
                                                                        gap: '0.75rem',
                                                                        width: '100%'
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            gap: '0.5rem',
                                                                            minWidth: 0
                                                                        }}
                                                                    >
                                                                        <PlayerBracket
                                                                            pair={pair}
                                                                            team={'team1'}
                                                                            pairIndex={pairIndex}
                                                                            hasTruthyPlayers={hasTruthyPlayers}
                                                                            stageIndex={storageStage(thirdPlaceIndex)}
                                                                            setPlayoffPairs={setPlayoffPairs}
                                                                            handleCastleChange={handleCastleChange}
                                                                            handleScoreChange={handleScoreChange}
                                                                            handleBlur={handleBlur}
                                                                            handleRadioChange={handleRadioChange}
                                                                            stage={'Third Place'}
                                                                            teamIndex={1}
                                                                            getWinner={getWinner}
                                                                            clickedRadioButton={clickedRadioButton}
                                                                            playersObj={playersObj}
                                                                            sourcePair={
                                                                                bracketPairs[thirdPlaceIndex - 1]?.[
                                                                                    pairIndex * 2
                                                                                ]
                                                                            }
                                                                            sourceIsLoser={true}
                                                                        />
                                                                        <PlayerBracket
                                                                            pair={pair}
                                                                            team={'team2'}
                                                                            pairIndex={pairIndex}
                                                                            hasTruthyPlayers={hasTruthyPlayers}
                                                                            stageIndex={storageStage(thirdPlaceIndex)}
                                                                            setPlayoffPairs={setPlayoffPairs}
                                                                            handleCastleChange={handleCastleChange}
                                                                            handleScoreChange={handleScoreChange}
                                                                            handleBlur={handleBlur}
                                                                            handleRadioChange={handleRadioChange}
                                                                            stage={'Third Place'}
                                                                            teamIndex={2}
                                                                            getWinner={getWinner}
                                                                            isManualScore={isManualScore}
                                                                            clickedRadioButton={clickedRadioButton}
                                                                            playersObj={playersObj}
                                                                            sourcePair={
                                                                                bracketPairs[thirdPlaceIndex - 1]?.[
                                                                                    pairIndex * 2 + 1
                                                                                ]
                                                                            }
                                                                            sourceIsLoser={true}
                                                                        />
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            display: 'flex',
                                                                            gap: '0.5rem',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'flex-end'
                                                                        }}
                                                                    >
                                                                        {pair.team1 !== 'TBD' &&
                                                                        pair.team2 !== 'TBD' &&
                                                                        canViewReportButtonForPair(pair) &&
                                                                        (pair.gameStatus !== 'Processed' ||
                                                                            authCtx.isAdmin) ? (
                                                                            <button
                                                                                onClick={() =>
                                                                                    handleOpenReportGame(
                                                                                        pair,
                                                                                        storageStage(thirdPlaceIndex),
                                                                                        pairIndex
                                                                                    )
                                                                                }
                                                                                style={{
                                                                                    padding: '0.5rem 1rem',
                                                                                    background:
                                                                                        pair.gameStatus === 'Processed'
                                                                                            ? '#808080'
                                                                                            : 'gold',
                                                                                    border: 'none',
                                                                                    borderRadius: '6px',
                                                                                    color:
                                                                                        pair.gameStatus === 'Processed'
                                                                                            ? '#ffffff'
                                                                                            : 'rgb(62, 32, 192)',
                                                                                    fontWeight: 'bold',
                                                                                    cursor: 'pointer',
                                                                                    fontSize: '0.9rem'
                                                                                }}
                                                                            >
                                                                                {pair.gameStatus === 'Processed'
                                                                                    ? 'Re-report Game'
                                                                                    : 'Report Game'}
                                                                            </button>
                                                                        ) : null}
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            position: 'absolute',
                                                                            bottom: '0.5rem',
                                                                            right: '0.5rem',
                                                                            zIndex: 2
                                                                        }}
                                                                    >
                                                                        {renderShowStatsButton(
                                                                            pair.team1,
                                                                            pair.team2,
                                                                            handleShowStats
                                                                        )}
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: '0.5rem',
                                                                            right: '0.5rem',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            background: 'rgba(0,0,0,0.55)',
                                                                            border: `1px solid ${pair.type === 'bo-5' ? 'rgba(180,80,255,0.7)' : pair.type === 'bo-3' ? 'rgba(255,120,80,0.7)' : 'rgba(255,215,0,0.5)'}`,
                                                                            borderRadius: '4px',
                                                                            padding: '1px 7px',
                                                                            fontSize: '0.65rem',
                                                                            fontWeight: 'bold',
                                                                            color:
                                                                                pair.type === 'bo-5'
                                                                                    ? '#cc88ff'
                                                                                    : pair.type === 'bo-3'
                                                                                      ? '#ff9966'
                                                                                      : '#FFD700',
                                                                            letterSpacing: '1.5px',
                                                                            zIndex: 2,
                                                                            textTransform: 'uppercase'
                                                                        }}
                                                                    >
                                                                        ⚔{' '}
                                                                        {pair.type === 'bo-5'
                                                                            ? 'BO5'
                                                                            : pair.type === 'bo-3'
                                                                              ? 'BO3'
                                                                              : 'BO1'}
                                                                    </div>
                                                                    {pair.games &&
                                                                        pair.games.some(
                                                                            (g) =>
                                                                                g.castle1 &&
                                                                                g.castle2 &&
                                                                                !g.castleWinner
                                                                        ) && (
                                                                            <span
                                                                                className={classes.liveDot}
                                                                                style={{
                                                                                    position: 'absolute',
                                                                                    top: '0.5rem',
                                                                                    left: '0.5rem',
                                                                                    zIndex: 3
                                                                                }}
                                                                            />
                                                                        )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        ) : (
                                            /* === OTHER STAGES === */
                                            <div
                                                style={{
                                                    position: 'relative',
                                                    height: `${leftColHeight}px`
                                                }}
                                            >
                                                {bracketPairs[nextStageIndex]?.map((pair, pairIndex) => {
                                                    const { team1, team2 } = pair;
                                                    const hasTruthyPlayers =
                                                        (team1 && team2 && team1 !== 'TBD') || team2 !== 'TBD';
                                                    return (
                                                        <div
                                                            key={pairIndex}
                                                            className={classes['game-block']}
                                                            style={{
                                                                position: 'absolute',
                                                                top: `${getRightBlockTop(pairIndex)}px`,
                                                                left: 0,
                                                                right: 0,
                                                                height: `${BLOCK_H}px`,
                                                                marginBottom: 0,
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '0.5rem',
                                                                    right: '0.5rem',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    background: 'rgba(0,0,0,0.55)',
                                                                    border: `1px solid ${pair.type === 'bo-5' ? 'rgba(180,80,255,0.7)' : pair.type === 'bo-3' ? 'rgba(255,120,80,0.7)' : 'rgba(255,215,0,0.5)'}`,
                                                                    borderRadius: '4px',
                                                                    padding: '1px 7px',
                                                                    fontSize: '0.65rem',
                                                                    fontWeight: 'bold',
                                                                    color:
                                                                        pair.type === 'bo-5'
                                                                            ? '#cc88ff'
                                                                            : pair.type === 'bo-3'
                                                                              ? '#ff9966'
                                                                              : '#FFD700',
                                                                    letterSpacing: '1.5px',
                                                                    zIndex: 2,
                                                                    textTransform: 'uppercase'
                                                                }}
                                                            >
                                                                ⚔{' '}
                                                                {pair.type === 'bo-5'
                                                                    ? 'BO5'
                                                                    : pair.type === 'bo-3'
                                                                      ? 'BO3'
                                                                      : 'BO1'}
                                                            </div>
                                                            {pair.games &&
                                                                pair.games.some(
                                                                    (g) => g.castle1 && g.castle2 && !g.castleWinner
                                                                ) && (
                                                                    <span
                                                                        className={classes.liveDot}
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: '0.5rem',
                                                                            left: '0.5rem',
                                                                            zIndex: 3
                                                                        }}
                                                                    />
                                                                )}
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    bottom: '0.5rem',
                                                                    right: '0.5rem',
                                                                    zIndex: 2
                                                                }}
                                                            >
                                                                {renderShowStatsButton(
                                                                    pair.team1,
                                                                    pair.team2,
                                                                    handleShowStats
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                                                                    alignItems: 'center',
                                                                    gap: '0.75rem',
                                                                    width: '100%'
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        gap: '0.5rem',
                                                                        minWidth: 0
                                                                    }}
                                                                >
                                                                    <PlayerBracket
                                                                        pair={pair}
                                                                        team={'team1'}
                                                                        pairIndex={pairIndex}
                                                                        hasTruthyPlayers={hasTruthyPlayers}
                                                                        stageIndex={storageStage(nextStageIndex)}
                                                                        setPlayoffPairs={setPlayoffPairs}
                                                                        handleCastleChange={handleCastleChange}
                                                                        handleScoreChange={handleScoreChange}
                                                                        handleBlur={handleBlur}
                                                                        handleRadioChange={handleRadioChange}
                                                                        stage={nextDisplayStage}
                                                                        teamIndex={1}
                                                                        getWinner={getWinner}
                                                                        clickedRadioButton={clickedRadioButton}
                                                                        sourcePair={
                                                                            bracketPairs[stageIndex]?.[pairIndex * 2]
                                                                        }
                                                                    />
                                                                    <PlayerBracket
                                                                        pair={pair}
                                                                        team={'team2'}
                                                                        pairIndex={pairIndex}
                                                                        hasTruthyPlayers={hasTruthyPlayers}
                                                                        stageIndex={storageStage(nextStageIndex)}
                                                                        setPlayoffPairs={setPlayoffPairs}
                                                                        handleCastleChange={handleCastleChange}
                                                                        handleScoreChange={handleScoreChange}
                                                                        handleBlur={handleBlur}
                                                                        handleRadioChange={handleRadioChange}
                                                                        stage={nextDisplayStage}
                                                                        teamIndex={2}
                                                                        getWinner={getWinner}
                                                                        isManualScore={isManualScore}
                                                                        clickedRadioButton={clickedRadioButton}
                                                                        sourcePair={
                                                                            bracketPairs[stageIndex]?.[
                                                                                pairIndex * 2 + 1
                                                                            ]
                                                                        }
                                                                    />
                                                                </div>
                                                                <div
                                                                    style={{
                                                                        display: 'flex',
                                                                        gap: '0.5rem',
                                                                        alignItems: 'center'
                                                                    }}
                                                                >
                                                                    {pair.team1 !== 'TBD' &&
                                                                    pair.team2 !== 'TBD' &&
                                                                    canViewReportButtonForPair(pair) &&
                                                                    (pair.gameStatus !== 'Processed' ||
                                                                        authCtx.isAdmin) ? (
                                                                        <button
                                                                            onClick={() =>
                                                                                handleOpenReportGame(
                                                                                    pair,
                                                                                    storageStage(nextStageIndex),
                                                                                    pairIndex
                                                                                )
                                                                            }
                                                                            style={{
                                                                                padding: '0.5rem 1rem',
                                                                                background:
                                                                                    pair.gameStatus === 'Processed'
                                                                                        ? '#808080'
                                                                                        : 'gold',
                                                                                border: 'none',
                                                                                borderRadius: '6px',
                                                                                color:
                                                                                    pair.gameStatus === 'Processed'
                                                                                        ? '#ffffff'
                                                                                        : 'rgb(62, 32, 192)',
                                                                                fontWeight: 'bold',
                                                                                cursor: 'pointer',
                                                                                fontSize: '0.9rem'
                                                                            }}
                                                                        >
                                                                            {pair.gameStatus === 'Processed'
                                                                                ? 'Re-report Game'
                                                                                : 'Report Game'}
                                                                        </button>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()
            )}

            {/* Stats Popup - Single instance for all games */}
            {showStats && stats && <StatsPopup stats={stats} loading={statsLoading} onClose={handleCloseStats} />}

            {/* Report Game Modal */}
            {canShowReportModal && (
                <ReportGameModal
                    pair={selectedReportPair}
                    pairId={selectedPairId}
                    tournamentId={tournamentId}
                    onClose={handleCloseReportModal}
                    onSubmit={handleSubmitGameReport}
                    playoffPairs={playoffPairs}
                    initialGameId={selectedInitialGameId}
                    strictCastlePick={strictCastlePick}
                />
            )}
        </div>
    );
};

const handleBlur = (stageName, pairIndex, setPlayoffPairs) => {
    const stageMappings = {
        'Quarter-final': 0,
        'Semi-final': 1,
        'Third Place': 2,
        Final: 3
        // Add more stages and their numerical values as needed
    };

    // Map the stage name to a numerical stage value
    const stage = stageMappings[stageName]; // Convert to lowercase for case-insensitive matching

    if (stage === undefined) {
        // Handle the case where an invalid stage name is provided
        console.error(`Invalid stage name: ${stageName}`);
        return;
    }

    setPlayoffPairs((prevPairs) => {
        const updatedPairs = [...prevPairs];
        const pair = updatedPairs[stage][pairIndex];

        console.log('pair', pair);

        if (
            (pair.score1 && pair.score2 && `${pair.score1}-${pair.score2}` === '2-0') ||
            `${pair.score1}-${pair.score2}` === '0-2' ||
            +pair.score1 + +pair.score2 === 3
        ) {
            // if (+pair.score1 + +pair.score2 === 3) {
            pair.totalGames = +pair.score1 + +pair.score2;
            // }
        } else {
            if (pair.score1 && pair.score2) {
                console.log('score', `${pair.score1}-${pair.score2}` === '0-2');
            }
        }

        console.log('updatedPairs', updatedPairs);
        return updatedPairs;
    });
};

function handleCastleChange(stageIndex, pairIndex, teamIndex, castleName, setPlayoffPairs, totalGames, index) {
    setPlayoffPairs((prevPairs) => {
        const updatedPairs = [...prevPairs];
        const pair = updatedPairs[stageIndex][pairIndex];

        if (totalGames.length > 1) {
            pair.games = pair.games ? pair.games : totalGames;

            if (teamIndex === 1) {
                pair.games[index].castle1 = castleName;
                // pair.castle1 = castleName;
            } else if (teamIndex === 2) {
                pair.games[index].castle2 = castleName;
                // pair.castle2 = castleName;
            }

            if (pair.games[index].castle2 && pair.games[index].castle1 && !pair.games[index].castleWinner) {
                pair.games[index].gameStatus = 'In Progress';
            }
        } else {
            if (teamIndex === 1) {
                // pair.castle1 = castleName;
                pair.games[index].castle1 = castleName;
            } else if (teamIndex === 2) {
                pair.games[index].castle2 = castleName;
                // pair.castle2 = castleName;
            }

            if (pair.games[index].castle2 && pair.games[index].castle1 && !pair.games[index].castleWinner) {
                pair.gameStatus = 'In Progress';
            }
        }

        return updatedPairs;
    });
}

function handleRadioChange(gameId, teamIndex, value, setPlayoffPairs, stageIndex, pairIndex, getWinner) {
    setPlayoffPairs((prevPairs) => {
        const updatedPairs = [...prevPairs];
        const pair = updatedPairs[stageIndex][pairIndex];
        const game = pair.games[gameId];
        const radioButton1 = document.getElementById(`radio-${stageIndex}-${pairIndex}-${game.gameId}-${1}`);
        const radioButton2 = document.getElementById(`radio-${stageIndex}-${pairIndex}-${game.gameId}-${2}`);
        const radioButtonValue1 = radioButton1.checked;
        const radioButtonValue2 = radioButton2.checked;

        //TODO: check if game.gameWinner set correclty

        // Update the checked attribute for the clicked radio button only
        const radioButtons = document.querySelectorAll(`input[name="radio-${stageIndex}-${pairIndex}-${gameId}"]`);

        radioButtons.forEach((radioButton) => {
            if (radioButton.id === `radio-${stageIndex}-${pairIndex}-${gameId}-${teamIndex}`) {
                clickedRadioButton = radioButton ? radioButton.id : undefined;
            }
            if (radioButton.id === `radio-${stageIndex}-${pairIndex}-${gameId}-${teamIndex}`) {
                radioButton.checked = true;
            } else {
                radioButton.checked = false;
            }
        });

        if (game.gameStatus !== 'Processed') {
            if (teamIndex === 1 && value === 'on' && game.castle1) {
                game.castleWinner = game.castle1;
                game.gameWinner = pair.team1;
                pair.score1 = pair.score1 + 1;

                if (
                    pair.score2 > 0 &&
                    (radioButtonValue1 || radioButtonValue2) &&
                    (pair.games.length === 1 || !game.gameWinner)
                ) {
                    pair.score2 = pair.score2 - 1;
                }
                game.gameStatus = 'Finished';
            } else {
                if (teamIndex === 2 && value === 'on' && game.castle2) {
                    game.castleWinner = game.castle2;
                    game.gameWinner = pair.team2;
                    pair.score2 = pair.score2 + 1;

                    if (
                        pair.score1 > 0 &&
                        (radioButtonValue1 || radioButtonValue2) &&
                        (pair.games.length === 1 || !game.gameWinner)
                    ) {
                        pair.score1 = pair.score1 - 1;
                    }
                    game.gameStatus = 'Finished';
                }
            }
            // console.log('game.gameWinner', game.gameWinner);
            if (
                (pair.score1 + pair.score2 >= 2 && `${pair.score1}-${pair.score2}` !== '1-1') ||
                pair.games.length === 1
            ) {
                getWinner(pair);
            }
        }

        // console.log('updatedPairs', updatedPairs);
        return updatedPairs;
    });
}

export const renderPlayerList = (players, kickOptions = null) => {
    const safePlayers = players && typeof players === 'object' ? players : {};
    const entries = Object.entries(safePlayers)
        .filter(([, player]) => player !== null && player.name !== undefined && player.name.trim() !== '')
        .sort(([, a], [, b]) => (Number(b.stars) || 0) - (Number(a.stars) || 0) || a.name.localeCompare(b.name));

    entries.forEach(([, player]) => {
        if (!uniquePlayerNames.includes(player.name) && player.name) {
            uniquePlayerNames.push(player.name);
        }
    });

    return (
        <>
            <h4>Players:</h4>
            <ul className={chipClasses.list}>
                {entries.map(([playerKey, player]) => (
                    <TournamentPlayerChip
                        key={playerKey}
                        player={player}
                        canKick={Boolean(kickOptions?.canKick)}
                        onKick={kickOptions?.onKick ? () => kickOptions.onKick(playerKey, player.name) : undefined}
                        kicking={kickOptions?.kickingPlayerKey === playerKey}
                    />
                ))}
            </ul>
        </>
    );
};
