import { FIREBASE_DATABASE_URL } from '../../../config/firebase';
import { authFetch } from '../../../api/authFetch';
import { useContext, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { lookForUserId, fetchLeaderboard, snapshotLeaderboardRanks, getTournamentPrizeLabel } from '../../../api/api';
import { resolveCountryCode } from '../../../utils/country';
import AuthContext from '../../../store/auth-context';
import { useAddTournament } from '../../../store/add-tournament-context';
import { deleteTournament, getTournamentData } from '../../tournaments/tournament_api';
import SpinningWheel from '../../SpinningWheel/SpinningWheel';
import classes from './Tournaments.module.css';
import { TournamentBracket, renderPlayerList } from './tournamentsBracket';
import TournamentPlayerChip from './TournamentPlayerChip';
import StarsComponent from '../../Stars/Stars';
import {
    canDeleteTournament,
    canInviteTournamentPlayers,
    canKickTournamentPlayer,
    isPublicTournament,
    isTournamentCreator,
    isTournamentDeleteBlocked
} from '../../../utils/tournamentVisibility';
import {
    formatAttendanceFeeLabel,
    getAttendanceFeeUsd,
    isRegistrationOpen,
    requiresAttendancePayment
} from '../../../utils/tournamentAttendance';
import {
    hasPaidAttendance,
    startAttendanceCheckout,
    confirmAttendancePayment,
    waitForAttendancePayment
} from '../../../api/tournamentAttendance';
import { startHostSeedCheckout, confirmHostSeedPayment } from '../../../api/tournamentHostFunding';
import { canLeaveTournament, kickPlayerFromTournament, leaveTournament } from '../../../api/tournamentRegistration';
import {
    approveCommentatorRequest,
    rejectCommentatorRequest,
    requestTournamentCommentator,
    setTournamentCommentating,
    withdrawCommentatorRequest
} from '../../../api/tournamentCommentators';
import { getFirebaseUid } from '../../../api/authFetch';
import { extractTwitchLogin, getTwitchWatchUrl } from '../../../utils/twitchUtils';
import {
    canManageCommentatorRequests,
    canRequestTournamentCommentator,
    canToggleTournamentCommentating,
    getApprovedCommentator,
    getApprovedCommentators,
    getCommentatorRequestForUser,
    getPendingCommentatorRequests
} from '../../../utils/tournamentCommentators';
import { getPrizeAmountForPlace, getTournamentPrizeBreakdown } from '../../../utils/prizePoolData';
import {
    calculateSwissTotalRounds,
    createSwissRoundDeadline,
    CS_SWISS_LOSS_LIMIT,
    CS_SWISS_SIZES,
    CS_SWISS_WIN_TARGET,
    generateSwissRound1Pairings,
    isCsSwissSize,
    MIN_CS_SWISS_PLAYERS,
    MIN_SWISS_PLAYERS,
    normalizeGameType
} from './swissUtils';
import { createDoubleElimPlayoffPairs, getDoubleElimStageLabels } from './loserBracketUtils';
import {
    isGroupDrawGridComplete,
    orderPlayersFromWheelPairs,
    prepareChampionsLeagueFromDrawGrid,
    prepareChampionsLeagueGroupStage
} from './championsLeagueUtils';

const ADMIN_ONLY_TOURNAMENT_FILTERS = new Set(['draft']);

const getTournamentPlayersObject = (tournament) => {
    const players = tournament?.players;
    return players && typeof players === 'object' ? players : {};
};

const countRegisteredPlayers = (tournament) =>
    Object.values(getTournamentPlayersObject(tournament)).filter(
        (player) => player?.name && player.name.trim() !== '' && player.name.trim() !== 'TBD'
    ).length;

const getAverageTournamentStars = (tournament) => {
    const players = Object.values(getTournamentPlayersObject(tournament)).filter(
        (player) => player?.name && player.name.trim() !== '' && player.name.trim() !== 'TBD'
    );
    if (players.length === 0) {
        return null;
    }

    const total = players.reduce((sum, player) => sum + (Number(player.stars) || 0), 0);
    return total / players.length;
};

const roundToHalfStar = (stars) => Math.round(Number(stars) * 2) / 2;

const getTournamentViewLabel = (type) => {
    if (type === 'league') {
        return 'View league';
    }
    if (type === 'swiss') {
        return 'View Swiss';
    }
    if (type === 'cs-swiss') {
        return 'View CS Swiss';
    }
    if (type === 'champions-league') {
        return 'View Champions League';
    }
    return 'View bracket';
};

const isScheduleTournamentType = (type) =>
    type === 'league' || type === 'swiss' || type === 'cs-swiss' || type === 'champions-league';

const usesSpinningWheel = (tournament) =>
    Boolean(tournament?.randomBracket && (tournament.type === 'kick-off' || tournament.type === 'champions-league'));

const TournamentList = () => {
    const { tournamentId } = useParams();
    const navigate = useNavigate();
    const { openAddTournament, isAddTournamentDisabled, addTournamentHint } = useAddTournament();
    const [searchParams, setSearchParams] = useSearchParams();
    const [tournaments, setTournaments] = useState([]);
    const [clickedId, setClickedId] = useState([]);
    const [tournamentStatus, setTournamentStatus] = useState('');
    const [tournamentWinnersObject, setTournamentWinners] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    // const [selectedTournament, setSelectedTournament] = useState(null);
    const [showPlayers, setShowPlayers] = useState(false); // State to toggle visibility
    const [statusFilter, setStatusFilter] = useState(() => {
        // Pre-initialise from URL so the fetch-based default respects it
        const params = new URLSearchParams(window.location.search);
        const param = params.get('status');
        const allowed = ['all', 'registration', 'registrationFinished', 'started', 'live', 'finished', 'draft'];
        return param && allowed.includes(param) ? param : null;
    });
    const [showSpinningWheel, setShowSpinningWheel] = useState(false);
    const [spinningWheelMode, setSpinningWheelMode] = useState('kickoff');
    const [tournamentPlayers, setTournamentPlayers] = useState({});
    const [allPlayerNicknames, setAllPlayerNicknames] = useState([]);
    const [nicknameQuery, setNicknameQuery] = useState('');
    const [nicknameSuggestions, setNicknameSuggestions] = useState([]);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const [addingPlayerTournamentId, setAddingPlayerTournamentId] = useState(null);
    const [fillingRandomTournamentId, setFillingRandomTournamentId] = useState(null);
    const [attendanceCheckoutTournamentId, setAttendanceCheckoutTournamentId] = useState(null);
    const [hostSeedCheckoutTournamentId, setHostSeedCheckoutTournamentId] = useState(null);
    const [leavingTournamentId, setLeavingTournamentId] = useState(null);
    const [paidNotRegisteredIds, setPaidNotRegisteredIds] = useState(() => new Set());
    const autoRegisterAttemptedRef = useRef(new Set());
    const [deletingTournamentId, setDeletingTournamentId] = useState(null);
    const [kickingPlayerKey, setKickingPlayerKey] = useState(null);
    const [commentatorActionKey, setCommentatorActionKey] = useState(null);
    const authCtx = useContext(AuthContext);
    let { userNickName, isLogged, isAdmin } = authCtx;

    useEffect(() => {
        if (!isAdmin && statusFilter && ADMIN_ONLY_TOURNAMENT_FILTERS.has(statusFilter)) {
            setStatusFilter('all');
        }
    }, [isAdmin, statusFilter]);

    const toggleShowPlayers = (competitionId) => {
        setShowPlayers((prev) => {
            const updatedState = {
                ...prev,
                [competitionId]: !prev[competitionId]
            };
            return updatedState;
        });
    };

    // let tournamentName = null;
    let maxTournamnetPlayers = 0;

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

    const nicknameRef = useRef();
    // console.log('nicknameRef', nicknameRef);

    const fetchTournaments = async () => {
        try {
            const response = await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3.json`);
            const data = await response.json();
            if (response.ok) {
                const tournamentList = Object.keys(data)
                    .map((key) => {
                        const tournament = data[key];
                        return tournament ? { id: key, ...tournament } : null;
                    })
                    .filter(Boolean);
                setTournaments(tournamentList);
                // Set default filter: 'started' if any in-progress tournament exists, else 'finished'
                setStatusFilter((prev) => {
                    if (prev !== null) {
                        if (!isAdmin && ADMIN_ONLY_TOURNAMENT_FILTERS.has(prev)) {
                            return 'all';
                        }
                        return prev;
                    }
                    return 'all';
                });
                // (no post-fetch setup needed)
            } else {
                console.error('Failed to fetch tournaments:', data);
            }
        } catch (error) {
            console.error('Error fetching tournaments:', error);
        }
    };

    const fetchAllPlayerNicknames = async () => {
        try {
            const response = await authFetch(`${FIREBASE_DATABASE_URL}/users.json`);
            const data = await response.json();
            if (!response.ok || !data) {
                setAllPlayerNicknames([]);
                return;
            }

            const nicknames = Object.values(data)
                .map((user) => user?.enteredNickname)
                .filter((nickname) => typeof nickname === 'string' && nickname.trim() !== '');

            setAllPlayerNicknames([...new Set(nicknames)]);
        } catch (error) {
            console.error('Error fetching player nicknames:', error);
            setAllPlayerNicknames([]);
        }
    };

    const updateNicknameSuggestions = (value, tournamentPlayersObj) => {
        const query = value.trim().toLowerCase();
        if (!query) {
            setNicknameSuggestions([]);
            setActiveSuggestionIndex(-1);
            return;
        }

        const alreadyRegistered = new Set(
            Object.values(tournamentPlayersObj || {})
                .filter((player) => player && player.name)
                .map((player) => player.name.toLowerCase())
        );

        const filtered = allPlayerNicknames
            .filter(
                (nickname) => nickname.toLowerCase().includes(query) && !alreadyRegistered.has(nickname.toLowerCase())
            )
            .slice(0, 8);

        setNicknameSuggestions(filtered);
        setActiveSuggestionIndex(filtered.length > 0 ? 0 : -1);
    };

    const handleNicknameKeyDown = (event, tournament) => {
        if (!nicknameSuggestions.length) {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveSuggestionIndex((prev) => {
                const next = prev < nicknameSuggestions.length - 1 ? prev + 1 : 0;
                return next;
            });
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveSuggestionIndex((prev) => {
                const next = prev > 0 ? prev - 1 : nicknameSuggestions.length - 1;
                return next;
            });
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            const selectedByDefault =
                activeSuggestionIndex >= 0 ? nicknameSuggestions[activeSuggestionIndex] : nicknameSuggestions[0];
            if (selectedByDefault) {
                setNicknameQuery(selectedByDefault);
                setNicknameSuggestions([]);
                setActiveSuggestionIndex(-1);
                addUserTournament(tournament.id, selectedByDefault, tournament.players, tournament.maxPlayers, {
                    isAdminManagedAdd: true
                });
                return;
            }

            const selectedNickname = nicknameQuery.trim();
            if (!selectedNickname) {
                return;
            }

            addUserTournament(tournament.id, selectedNickname, tournament.players, tournament.maxPlayers, {
                isAdminManagedAdd: true
            });
        }
    };

    useEffect(() => {
        fetchTournaments();
        fetchAllPlayerNicknames();
    }, []);

    useEffect(() => {
        const statusParam = searchParams.get('status');
        const allowed = ['all', 'registration', 'registrationFinished', 'started', 'live', 'finished', 'draft'];
        if (statusParam && allowed.includes(statusParam)) {
            setStatusFilter(statusParam);
        }
    }, [searchParams]);

    // Auto-open tournament view if tournamentId is in URL
    useEffect(() => {
        if (tournamentId && tournaments.length > 0) {
            const tournament = tournaments.find((t) => t.id === tournamentId);
            if (tournament) {
                setClickedId(tournamentId);
                setTournamentStatus(tournament.status);
                setTournamentWinners(tournament.winners || '');

                if (tournament.status === 'Registration finished!' && usesSpinningWheel(tournament)) {
                    setTournamentPlayers(tournament.players || {});
                    setSpinningWheelMode(tournament.type === 'champions-league' ? 'champions-league' : 'kickoff');
                    setShowSpinningWheel(true);
                    setShowDetails(false);
                } else {
                    setShowDetails(true);
                    setShowSpinningWheel(false);
                }
            }
        } else if (!tournamentId) {
            setShowDetails(false);
            setShowSpinningWheel(false);
        }
    }, [tournamentId, tournaments]);

    const checkRegisterUser = (currentUser, players) => {
        const registeredPlayers = Object.values(getTournamentPlayersObject({ players })).filter(
            (player) => player !== null
        );
        return registeredPlayers.some((player) => player.name === currentUser);
    };

    const addUserTournament = async (
        tourId,
        nickname,
        currentTournamentPlayers,
        maxPlayers,
        options = { isAdminManagedAdd: false }
    ) => {
        if (addingPlayerTournamentId === tourId) {
            return;
        }

        setAddingPlayerTournamentId(tourId);

        try {
            const normalizedNickname = (nickname || '').trim();
            if (!normalizedNickname) {
                authCtx.setNotificationShown(true, 'Please enter a player nickname.', 'error', 4);
                return;
            }

            // Resolve nickname case-insensitively to avoid null lookups when casing differs.
            const matchedNickname =
                allPlayerNicknames.find((n) => n.toLowerCase() === normalizedNickname.toLowerCase()) ||
                normalizedNickname;

            const user = await lookForUserId(matchedNickname, 'full');
            const userId = await lookForUserId(matchedNickname);

            if (!userId || !user) {
                authCtx.setNotificationShown(true, `Player "${normalizedNickname}" was not found.`, 'error', 5);
                return;
            }

            const userResponse = await authFetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`, {
                method: 'GET'
            });

            const data = await userResponse.json();

            if (!data) {
                authCtx.setNotificationShown(true, `Player "${matchedNickname}" has invalid profile data.`, 'error', 5);
                return;
            }

            let userStars = data.stars ?? 0;

            const lastRating = data.ratings
                ? parseFloat(data.ratings.split(',').pop().trim()).toFixed(2)
                : parseFloat(0).toFixed(2);

            let userRatings = lastRating;

            let placeInLeaderboard = await fetchLeaderboard(data);

            const userData = {
                name: user.name || matchedNickname,
                stars: userStars,
                ratings: userRatings,
                placeInLeaderboard: placeInLeaderboard,
                registeredUid: getFirebaseUid() || null,
                siteUserId: userId,
                countryCode: resolveCountryCode(data)
            };

            let tournamentData = await getTournamentData(tourId);

            if (requiresAttendancePayment(tournamentData, options)) {
                const isSelfRegistration =
                    !!authCtx.userNickName && matchedNickname.toLowerCase() === authCtx.userNickName.toLowerCase();
                if (isSelfRegistration) {
                    const paid = await hasPaidAttendance(tourId);
                    if (!paid) {
                        authCtx.setNotificationShown(
                            true,
                            `Pay the ${formatAttendanceFeeLabel(getAttendanceFeeUsd(tournamentData))} to register.`,
                            'warning',
                            6
                        );
                        return;
                    }
                }
            }

            const registeredCount = Object.values(currentTournamentPlayers || {}).filter(
                (player) => player?.name && player.name.trim() !== '' && player.name.trim() !== 'TBD'
            ).length;

            if (tournamentData?.type === 'champions-league' && registeredCount >= Number(maxPlayers)) {
                authCtx.setNotificationShown(
                    true,
                    `Champions League is full (${maxPlayers}/${maxPlayers} players).`,
                    'warning',
                    5
                );
                return;
            }

            if (tournamentData.preparedBracket) {
                substituteTBDPlayer(user, tourId, userStars, userRatings);
            } else {
                console.log('Tournament does not have a prepared bracket.');
            }

            const response = await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tourId}/players/.json`, {
                method: 'POST',
                body: JSON.stringify(userData),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const isSelfRegistration =
                !!authCtx.userNickName && matchedNickname.toLowerCase() === authCtx.userNickName.toLowerCase();

            if (response.ok && isSelfRegistration && !options.isAdminManagedAdd) {
                authCtx.setNotificationShown(true, 'Registered for the tournament!', 'success', 5);
            }

            if (response.ok && options.isAdminManagedAdd) {
                authCtx.setNotificationShown(true, `${matchedNickname} added to the tournament.`, 'success', 4);
            }

            if (response.ok && +Object.keys(currentTournamentPlayers).length === +maxPlayers - 1) {
                const tournamentStatusResponseModal = confirmWindow(
                    `Are you sure you want to update tournament's status to 'Registration Finished'?`
                );
                if (tournamentStatusResponseModal) {
                    const tournamentStatusResponse = await authFetch(
                        `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tourId}/status.json`,
                        {
                            method: 'PUT',
                            body: JSON.stringify('Registration finished!'),
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    if (tournamentStatusResponse.ok) {
                        authCtx.setNotificationShown(
                            true,
                            'Tournament status updated to Registration Finished!',
                            'success',
                            4
                        );
                    } else {
                        authCtx.setNotificationShown(true, 'Failed to update tournament status.', 'error', 5);
                    }
                }
            }

            // Do not hard-reload the page: it clears notification state before the toast is shown.
            setNicknameQuery('');
            setNicknameSuggestions([]);
            setActiveSuggestionIndex(-1);
            await fetchTournaments();
        } finally {
            setAddingPlayerTournamentId(null);
        }
    };

    const handleLeaveTournament = async (tournament) => {
        if (!isLogged || !userNickName) {
            authCtx.setNotificationShown(true, 'Log in to leave a tournament.', 'warning', 4);
            return;
        }

        if (!canLeaveTournament(tournament)) {
            authCtx.setNotificationShown(true, 'You cannot leave this tournament now.', 'warning', 4);
            return;
        }

        const feeUsd = getAttendanceFeeUsd(tournament);
        const refundNote = feeUsd > 0 ? ` Your $${feeUsd} registration fee will not be refunded.` : '';

        if (
            !window.confirm(
                `Leave "${tournament.name}"?${refundNote} You can register again later if registration is still open.`
            )
        ) {
            return;
        }

        setLeavingTournamentId(tournament.id);
        try {
            await leaveTournament(tournament.id, userNickName);
            authCtx.setNotificationShown(true, 'You left the tournament.', 'success', 5);
            await fetchTournaments();
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Could not leave the tournament.', 'error', 5);
        } finally {
            setLeavingTournamentId(null);
        }
    };

    const resolveUserTwitchLogin = async (nickname) => {
        const userId = await lookForUserId(nickname);
        if (!userId) {
            return null;
        }

        const response = await authFetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`);
        if (!response.ok) {
            return null;
        }

        const userData = await response.json();
        return extractTwitchLogin(userData?.twitch) || extractTwitchLogin(userData?.twitchDisplayName) || null;
    };

    const handleRequestCommentator = async (tournament) => {
        const firebaseUid = getFirebaseUid();
        if (!isLogged || !userNickName || !firebaseUid) {
            authCtx.setNotificationShown(true, 'Log in with Twitch to request commentator access.', 'warning', 4);
            return;
        }

        const actionKey = `${tournament.id}:request`;
        setCommentatorActionKey(actionKey);
        try {
            const twitchLogin = await resolveUserTwitchLogin(userNickName);
            if (!twitchLogin) {
                authCtx.setNotificationShown(
                    true,
                    'Link your Twitch account by signing in with Twitch before applying.',
                    'warning',
                    5
                );
                return;
            }

            await requestTournamentCommentator(tournament.id, {
                firebaseUid,
                nickname: userNickName,
                twitchLogin
            });
            authCtx.setNotificationShown(true, 'Commentator request sent. The host will review it.', 'success', 5);
            await fetchTournaments();
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Could not submit commentator request.', 'error', 5);
        } finally {
            setCommentatorActionKey(null);
        }
    };

    const handleWithdrawCommentatorRequest = async (tournament) => {
        const firebaseUid = getFirebaseUid();
        if (!firebaseUid) {
            return;
        }

        const actionKey = `${tournament.id}:withdraw`;
        setCommentatorActionKey(actionKey);
        try {
            await withdrawCommentatorRequest(tournament.id, firebaseUid);
            authCtx.setNotificationShown(true, 'Commentator request withdrawn.', 'success', 4);
            await fetchTournaments();
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Could not withdraw commentator request.', 'error', 5);
        } finally {
            setCommentatorActionKey(null);
        }
    };

    const handleApproveCommentator = async (tournament, requestId, request) => {
        const actionKey = `${tournament.id}:approve:${requestId}`;
        setCommentatorActionKey(actionKey);
        try {
            await approveCommentatorRequest(tournament.id, requestId, request, getFirebaseUid());
            authCtx.setNotificationShown(true, `${request.name} approved as commentator.`, 'success', 4);
            await fetchTournaments();
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Could not approve commentator.', 'error', 5);
        } finally {
            setCommentatorActionKey(null);
        }
    };

    const handleRejectCommentator = async (tournament, requestId, requestName) => {
        const actionKey = `${tournament.id}:reject:${requestId}`;
        setCommentatorActionKey(actionKey);
        try {
            await rejectCommentatorRequest(tournament.id, requestId);
            authCtx.setNotificationShown(true, `${requestName} request rejected.`, 'success', 4);
            await fetchTournaments();
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Could not reject commentator request.', 'error', 5);
        } finally {
            setCommentatorActionKey(null);
        }
    };

    const handleToggleCommentating = async (tournament, isCommentating) => {
        const firebaseUid = getFirebaseUid();
        const commentator = getApprovedCommentator(tournament, firebaseUid);
        if (!firebaseUid || !commentator) {
            return;
        }

        const actionKey = `${tournament.id}:commentating`;
        setCommentatorActionKey(actionKey);
        try {
            await setTournamentCommentating(tournament.id, firebaseUid, commentator, isCommentating);
            authCtx.setNotificationShown(
                true,
                isCommentating ? 'You are now listed as commentating this cup.' : 'Commentating stopped for this cup.',
                'success',
                4
            );
            await fetchTournaments();
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Could not update commentating status.', 'error', 5);
        } finally {
            setCommentatorActionKey(null);
        }
    };

    const handleKickPlayer = async (tournament, playerKey, playerName) => {
        if (!canKickTournamentPlayer(tournament, { isAdmin, userNickName })) {
            return;
        }

        const feeUsd = getAttendanceFeeUsd(tournament);
        const refundNote = feeUsd > 0 ? ' Their registration fee will not be refunded.' : '';

        if (!window.confirm(`Remove "${playerName}" from "${tournament.name}"?${refundNote}`)) {
            return;
        }

        const kickId = `${tournament.id}:${playerKey}`;
        setKickingPlayerKey(kickId);
        try {
            await kickPlayerFromTournament(tournament.id, playerKey);
            authCtx.setNotificationShown(true, `${playerName} was removed from the tournament.`, 'success', 4);
            await fetchTournaments();
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Could not remove the player.', 'error', 5);
        } finally {
            setKickingPlayerKey(null);
        }
    };

    const handlePayHostSeed = async (tournament) => {
        if (!isLogged || !userNickName) {
            authCtx.setNotificationShown(true, 'Log in to fund the prize pool.', 'warning', 4);
            return;
        }

        if (!isTournamentCreator(tournament, userNickName) && !authCtx.isAdmin) {
            authCtx.setNotificationShown(true, 'Only the tournament host can fund this pool.', 'warning', 4);
            return;
        }

        const goalUsd = Number(tournament.fundingGoalUsd) || 0;
        if (goalUsd <= 0) {
            authCtx.setNotificationShown(true, 'This tournament has no prize pool goal set.', 'warning', 4);
            return;
        }

        setHostSeedCheckoutTournamentId(tournament.id);
        try {
            await startHostSeedCheckout({
                tournamentId: tournament.id,
                tournamentName: tournament.name,
                goalUsd,
                nickname: userNickName,
                redirectMode: 'current-tab'
            });
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Could not open prize pool checkout.', 'error', 5);
        } finally {
            setHostSeedCheckoutTournamentId(null);
        }
    };

    const handleSelfRegister = async (tournament) => {
        if (!isLogged || !userNickName) {
            authCtx.setNotificationShown(true, 'Log in to register for a tournament.', 'warning', 4);
            return;
        }

        if (!isRegistrationOpen(tournament.status)) {
            authCtx.setNotificationShown(true, 'Registration is closed for this tournament.', 'warning', 4);
            return;
        }

        const feeUsd = getAttendanceFeeUsd(tournament);
        if (feeUsd > 0) {
            const paid = await hasPaidAttendance(tournament.id);
            if (!paid) {
                setAttendanceCheckoutTournamentId(tournament.id);
                try {
                    await startAttendanceCheckout({
                        tournamentId: tournament.id,
                        tournamentName: tournament.name,
                        feeUsd,
                        nickname: userNickName
                    });
                    authCtx.setNotificationShown(
                        true,
                        'Complete payment in the Stripe tab, then return here to finish registration.',
                        'warning',
                        7
                    );
                } catch (error) {
                    authCtx.setNotificationShown(true, error.message || 'Could not open payment checkout.', 'error', 5);
                } finally {
                    setAttendanceCheckoutTournamentId(null);
                }
                return;
            }
        }

        await addUserTournament(tournament.id, userNickName, tournament.players || {}, tournament.maxPlayers);
    };

    const getSelfRegisterLabel = (tournament) => {
        if (attendanceCheckoutTournamentId === tournament.id) {
            return 'Opening checkout…';
        }

        const feeUsd = getAttendanceFeeUsd(tournament);
        if (feeUsd > 0) {
            return `Register — $${feeUsd}`;
        }

        return 'Register';
    };

    useEffect(() => {
        if (!isLogged || !userNickName || tournaments.length === 0) {
            setPaidNotRegisteredIds(new Set());
            return undefined;
        }

        let cancelled = false;

        const loadPaidRegistrationState = async () => {
            const ids = new Set();
            for (const tournament of tournaments) {
                if (checkRegisterUser(userNickName, getTournamentPlayersObject(tournament))) {
                    continue;
                }
                if (!isRegistrationOpen(tournament.status)) {
                    continue;
                }
                if (getAttendanceFeeUsd(tournament) <= 0) {
                    continue;
                }
                if (await hasPaidAttendance(tournament.id)) {
                    ids.add(tournament.id);
                }
            }
            if (!cancelled) {
                setPaidNotRegisteredIds(ids);
            }
        };

        loadPaidRegistrationState();

        return () => {
            cancelled = true;
        };
    }, [tournaments, isLogged, userNickName]);

    useEffect(() => {
        if (!isLogged || !userNickName || paidNotRegisteredIds.size === 0) {
            return undefined;
        }

        let cancelled = false;

        const completePaidRegistration = async () => {
            for (const tournament of tournaments) {
                if (!paidNotRegisteredIds.has(tournament.id)) {
                    continue;
                }

                const attemptKey = `${tournament.id}:${userNickName}`;
                if (autoRegisterAttemptedRef.current.has(attemptKey)) {
                    continue;
                }
                autoRegisterAttemptedRef.current.add(attemptKey);

                try {
                    await addUserTournament(
                        tournament.id,
                        userNickName,
                        getTournamentPlayersObject(tournament),
                        tournament.maxPlayers
                    );
                    if (cancelled) {
                        break;
                    }
                    if (checkRegisterUser(userNickName, getTournamentPlayersObject(tournament))) {
                        authCtx.setNotificationShown(true, 'Registered for the tournament!', 'success', 5);
                    } else {
                        authCtx.setNotificationShown(
                            true,
                            'Payment recorded — click Register again to join.',
                            'warning',
                            8
                        );
                    }
                } catch (error) {
                    autoRegisterAttemptedRef.current.delete(attemptKey);
                    if (!cancelled) {
                        authCtx.setNotificationShown(
                            true,
                            error.message || 'Payment recorded — click Register again to join.',
                            'warning',
                            8
                        );
                    }
                }
                break;
            }
        };

        completePaidRegistration();

        return () => {
            cancelled = true;
        };
    }, [paidNotRegisteredIds, tournaments, isLogged, userNickName, authCtx]);

    const canShowSelfRegister = (tournament) => {
        const registeredCount = countRegisteredPlayers(tournament);
        return (
            isLogged &&
            isRegistrationOpen(tournament.status) &&
            registeredCount < tournament.maxPlayers &&
            !checkRegisterUser(userNickName, getTournamentPlayersObject(tournament))
        );
    };

    useEffect(() => {
        const attendanceStatus = searchParams.get('attendance');
        if (attendanceStatus !== 'success' || !tournamentId || !isLogged || !userNickName || tournaments.length === 0) {
            return undefined;
        }

        const tournament = tournaments.find((entry) => entry.id === tournamentId);
        if (!tournament || checkRegisterUser(userNickName, tournament.players || {})) {
            return undefined;
        }

        let cancelled = false;
        const sessionId = searchParams.get('session_id');

        const completePaidRegistration = async () => {
            try {
                if (sessionId) {
                    try {
                        await confirmAttendancePayment(sessionId);
                    } catch (confirmError) {
                        console.warn('Attendance confirm fallback:', confirmError.message);
                    }
                }

                const paid = sessionId
                    ? await hasPaidAttendance(tournamentId)
                    : await waitForAttendancePayment(tournamentId);

                if (!paid || cancelled) {
                    if (!cancelled) {
                        authCtx.setNotificationShown(
                            true,
                            'Payment received but registration is still processing. Click Register again in a moment.',
                            'warning',
                            8
                        );
                    }
                    return;
                }

                await addUserTournament(tournamentId, userNickName, tournament.players || {}, tournament.maxPlayers);

                if (!cancelled) {
                    authCtx.setNotificationShown(true, 'Registered for the tournament!', 'success', 5);
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.delete('attendance');
                    nextParams.delete('session_id');
                    setSearchParams(nextParams, { replace: true });
                }
            } catch (error) {
                if (!cancelled) {
                    authCtx.setNotificationShown(
                        true,
                        error.message || 'Could not complete registration after payment.',
                        'error',
                        6
                    );
                }
            }
        };

        completePaidRegistration();

        return () => {
            cancelled = true;
        };
    }, [searchParams, tournamentId, tournaments, isLogged, userNickName, setSearchParams, authCtx]);

    useEffect(() => {
        const fundingStatus = searchParams.get('funding');
        if (!fundingStatus) {
            return undefined;
        }

        const sessionId = searchParams.get('session_id');

        const handleFundingReturn = async () => {
            if (fundingStatus === 'success') {
                if (sessionId && isLogged) {
                    try {
                        const result = await confirmHostSeedPayment(sessionId);
                        await fetchTournaments();
                        if (result.poolFunded || result.status === 'Registration Started') {
                            authCtx.setNotificationShown(
                                true,
                                'Prize pool funded — registration is now open.',
                                'success',
                                6
                            );
                        } else {
                            authCtx.setNotificationShown(
                                true,
                                'Payment received. Prize pool activation is still processing — refresh in a moment.',
                                'warning',
                                8
                            );
                        }
                    } catch (error) {
                        await fetchTournaments();
                        authCtx.setNotificationShown(
                            true,
                            error.message ||
                                'Payment succeeded but the cup was not activated. Try “Pay prize pool” again or contact an admin.',
                            'error',
                            10
                        );
                    }
                } else {
                    authCtx.setNotificationShown(
                        true,
                        'Prize pool payment completed. Refresh if registration is not open yet.',
                        'warning',
                        8
                    );
                    await fetchTournaments();
                }
            } else if (fundingStatus === 'pending') {
                authCtx.setNotificationShown(
                    true,
                    'Complete the prize pool payment to open registration.',
                    'warning',
                    8
                );
            } else if (fundingStatus === 'cancelled') {
                authCtx.setNotificationShown(true, 'Prize pool payment was cancelled.', 'warning', 5);
            }

            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('funding');
            nextParams.delete('session_id');
            setSearchParams(nextParams, { replace: true });
        };

        handleFundingReturn();

        return undefined;
    }, [searchParams, authCtx, isLogged, setSearchParams]);

    const confirmWindow = (message) => {
        const response = window.confirm(message);
        if (response) {
            console.log('YES');
        } else {
            console.log('NO');
        }
        return response;
    };

    const fillTournamentWithRandomPlayers = async (tourId, currentTournamentPlayers, maxPlayers) => {
        if (fillingRandomTournamentId === tourId) {
            return;
        }

        setFillingRandomTournamentId(tourId);

        try {
            // Get all users from database
            const usersResponse = await authFetch(`${FIREBASE_DATABASE_URL}/users.json`);
            const allUsers = await usersResponse.json();

            if (!allUsers) {
                alert('No users found in database');
                return;
            }

            // Get current tournament players
            const currentPlayerNames = Object.values(currentTournamentPlayers)
                .filter((player) => player !== null)
                .map((player) => player.name);

            console.log('Current tournament players:', currentPlayerNames);
            console.log('All users in database:', allUsers);

            // Filter eligible users: not in tournament and have at least 1 game played
            const eligibleUsers = Object.entries(allUsers)
                .filter(([, user]) => {
                    if (!user || !user.enteredNickname) {
                        return false;
                    }

                    // Check if already in tournament
                    if (currentPlayerNames.includes(user.enteredNickname)) {
                        return false;
                    }

                    // Check if has at least 1 game played
                    console.log('User games user:', user);
                    const totalGames = user.gamesPlayed?.heroes3?.total || 0;
                    return totalGames >= 1;
                })
                .map(([, user]) => ({
                    name: user.enteredNickname,
                    stars: user.stars || 0,
                    ratings: user.ratings || '0',
                    gamesPlayed: user.gamesPlayed
                }));

            if (eligibleUsers.length === 0) {
                alert('No eligible players found (must have at least 1 game played and not already in tournament)');
                return;
            }

            // Calculate how many players we need to add
            const spotsToFill = maxPlayers - Object.keys(currentTournamentPlayers).length;

            if (spotsToFill <= 0) {
                alert('Tournament is already full');
                return;
            }

            const playersToAdd = Math.min(spotsToFill, eligibleUsers.length);

            const confirm = confirmWindow(
                `Found ${eligibleUsers.length} eligible players.\nAdd ${playersToAdd} random players to fill the tournament?`
            );

            if (!confirm) {
                return;
            }

            // Shuffle and select random players
            const shuffled = [...eligibleUsers].sort(() => Math.random() - 0.5);
            const selectedPlayers = shuffled.slice(0, playersToAdd);

            // Add each selected player
            for (const player of selectedPlayers) {
                const lastRating = parseFloat(player.ratings.split(',').pop().trim()).toFixed(2);
                const placeInLeaderboard = await fetchLeaderboard(player);

                const userData = {
                    name: player.name,
                    stars: player.stars,
                    ratings: lastRating,
                    placeInLeaderboard: placeInLeaderboard
                };

                // Add to tournament
                await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tourId}/players/.json`, {
                    method: 'POST',
                    body: JSON.stringify(userData),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                // Check if tournament has prepared bracket and substitute TBD
                const tournamentData = await getTournamentData(tourId);
                if (tournamentData.preparedBracket) {
                    await substituteTBDPlayer({ name: player.name }, tourId, player.stars, lastRating);
                }
            }

            // Check if tournament is now full and update status
            const newPlayerCount = Object.keys(currentTournamentPlayers).length + playersToAdd;
            console.log('newPlayerCount: ' + newPlayerCount);
            console.log('maxPlayers: ' + maxPlayers);
            console.log('maxPlayers type:', typeof maxPlayers);
            console.log('Comparison result:', newPlayerCount === maxPlayers);
            console.log('Comparison result (number):', newPlayerCount === +maxPlayers);

            if (newPlayerCount === +maxPlayers) {
                console.log('Updating status to Registration finished!');
                const statusResponse = await authFetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tourId}/status.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify('Registration finished!'),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );
                console.log('Status update response:', statusResponse.ok, statusResponse.status);
                if (statusResponse.ok) {
                    console.log('Status successfully updated to Registration finished!');
                } else {
                    console.error('Failed to update status:', await statusResponse.text());
                }
                alert(`Successfully added ${playersToAdd} players! Tournament is now full and ready to start.`);
            } else {
                alert(`Successfully added ${playersToAdd} players to the tournament!`);
            }
            window.location.reload();
        } catch (error) {
            console.error('Error filling tournament with random players:', error);
            alert('Error adding players to tournament');
        } finally {
            setFillingRandomTournamentId(null);
        }
    };

    const closeTournamentView = () => {
        setShowDetails(false);
        setShowSpinningWheel(false);
        setSpinningWheelMode('kickoff');
        const status = searchParams.get('status');
        navigate(status ? `/tournaments/homm3?status=${encodeURIComponent(status)}` : '/tournaments/homm3');
    };

    const closeModalHandler = closeTournamentView;

    const handleDeleteTournament = async (tournament) => {
        if (isTournamentDeleteBlocked(tournament)) {
            return;
        }

        const registeredCount = Object.values(tournament.players || {}).filter(
            (player) => player?.name && player.name.trim() !== ''
        ).length;

        let confirmMessage = `Delete "${tournament.name}" permanently? This cannot be undone.`;

        if (registeredCount > 0) {
            confirmMessage += `\n\n${registeredCount} registered player(s) will be removed.`;
        }

        if (!window.confirm(confirmMessage)) {
            return;
        }

        setDeletingTournamentId(tournament.id);

        try {
            const response = await deleteTournament(tournament.id);

            if (!response.ok) {
                throw new Error('Delete failed');
            }

            if (clickedId === tournament.id) {
                closeModalHandler();
                setClickedId([]);
            }

            await fetchTournaments();
            authCtx.setNotificationShown(true, `Tournament "${tournament.name}" deleted.`, 'success', 4);
        } catch (error) {
            console.error('Error deleting tournament:', error);
            authCtx.setNotificationShown(true, 'Failed to delete tournament.', 'error', 5);
        } finally {
            setDeletingTournamentId(null);
        }
    };

    const handleStartLeague = async (leagueTournamentId) => {
        if (!window.confirm('Generate league schedule and start the tournament?')) {
            return;
        }
        try {
            const response = await authFetch(
                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${leagueTournamentId}/.json`
            );
            if (!response.ok) {
                throw new Error('Failed to fetch tournament data');
            }
            const tournamentData = await response.json();

            const rawGameType = tournamentData.tournamentPlayoffGames || 'bo-1';
            const gameType =
                rawGameType === 'BO-5' || rawGameType === 'bo-5' || rawGameType === '5'
                    ? 'bo-5'
                    : rawGameType === 'BO-3' || rawGameType === 'bo-3' || rawGameType === '3'
                      ? 'bo-3'
                      : rawGameType === 'BO-2' || rawGameType === 'bo-2' || rawGameType === '2'
                        ? 'bo-2'
                        : 'bo-1';
            const numGames = gameType === 'bo-5' ? 5 : gameType === 'bo-3' ? 3 : gameType === 'bo-2' ? 2 : 1;

            const playerList = Object.values(tournamentData.players || {}).filter(
                (p) => p && p.name && p.name.trim() !== '' && p.name.trim() !== 'TBD'
            );
            if (playerList.length < 2) {
                alert('Not enough players to start the league (minimum 2).');
                return;
            }

            // Generate all round-robin pairs (N*(N-1)/2)
            // Pre-compute round assignments via circle method
            const buildLeagueRoundMap = (players) => {
                const list = players.length % 2 !== 0 ? [...players, null] : [...players];
                const size = list.length;
                const map = {};
                for (let r = 0; r < size - 1; r++) {
                    const rotation = [list[0]];
                    for (let i = 0; i < size - 1; i++) {
                        rotation.push(list[1 + ((i + r) % (size - 1))]);
                    }
                    for (let i = 0; i < size / 2; i++) {
                        const p1 = rotation[i];
                        const p2 = rotation[size - 1 - i];
                        if (p1 !== null && p2 !== null) {
                            map[`${p1.name}|${p2.name}`] = r + 1;
                            map[`${p2.name}|${p1.name}`] = r + 1;
                        }
                    }
                }
                return map;
            };
            const leagueRoundMap = buildLeagueRoundMap(playerList);
            const leaguePairs = [];
            for (let i = 0; i < playerList.length; i++) {
                for (let j = i + 1; j < playerList.length; j++) {
                    const p1 = playerList[i];
                    const p2 = playerList[j];
                    const getRating = (p) =>
                        p.ratings
                            ? typeof p.ratings === 'string' && p.ratings.includes(',')
                                ? p.ratings.split(',').pop().trim()
                                : String(p.ratings)
                            : '0';
                    const games = Array.from({ length: numGames }, (_, idx) => ({
                        castle1: '',
                        castle2: '',
                        castleWinner: '',
                        gameId: idx,
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
                    leaguePairs.push({
                        gameStatus: 'Not Started',
                        games,
                        ratings1: getRating(p1),
                        ratings2: getRating(p2),
                        round: leagueRoundMap[`${p1.name}|${p2.name}`] || 1,
                        score1: 0,
                        score2: 0,
                        stage: 'League',
                        stars1: p1.stars || 0,
                        stars2: p2.stars || 0,
                        team1: p1.name,
                        team2: p2.name,
                        type: gameType,
                        winner: null,
                        color1: 'red',
                        color2: 'blue'
                    });
                }
            }

            // Save as single-stage bracket (playoffPairs[0]) + update status
            const bracketRes = await authFetch(
                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${leagueTournamentId}/bracket/playoffPairs.json`,
                {
                    method: 'PUT',
                    body: JSON.stringify([leaguePairs]),
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            if (!bracketRes.ok) {
                throw new Error('Failed to save league pairs');
            }

            await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${leagueTournamentId}/status.json`, {
                method: 'PUT',
                body: JSON.stringify('Started!'),
                headers: { 'Content-Type': 'application/json' }
            });

            alert(`League started! Generated ${leaguePairs.length} matches.`);
            window.location.reload();
        } catch (error) {
            console.error('Error starting league:', error);
            alert('Error starting league: ' + error.message);
        }
    };

    const handleStartSwiss = async (swissTournamentId) => {
        const response = await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${swissTournamentId}/.json`);
        if (!response.ok) {
            alert('Failed to fetch tournament data');
            return;
        }

        const tournamentData = await response.json();
        const isCsSwiss = tournamentData.type === 'cs-swiss';
        const minPlayers = isCsSwiss ? MIN_CS_SWISS_PLAYERS : MIN_SWISS_PLAYERS;
        const confirmText = isCsSwiss
            ? 'Generate CS Swiss round 1 and start the tournament? Players qualify at 3 wins and are eliminated at 3 losses.'
            : 'Generate Swiss round 1 and start the tournament?';

        if (!window.confirm(confirmText)) {
            return;
        }

        try {
            const gameType = normalizeGameType(tournamentData.tournamentPlayoffGames || 'bo-1');
            const playerList = Object.values(tournamentData.players || {}).filter(
                (player) => player && player.name && player.name.trim() !== '' && player.name.trim() !== 'TBD'
            );

            if (playerList.length < minPlayers) {
                alert(`Not enough players to start ${isCsSwiss ? 'CS Swiss' : 'Swiss'} (minimum ${minPlayers}).`);
                return;
            }
            if (isCsSwiss && !isCsSwissSize(playerList.length)) {
                alert(`CS Swiss requires exactly ${CS_SWISS_SIZES.join(' or ')} registered players.`);
                return;
            }

            const swissPairs = generateSwissRound1Pairings(playerList, gameType);
            const totalRounds = isCsSwiss ? 5 : calculateSwissTotalRounds(playerList.length);

            const bracketRes = await authFetch(
                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${swissTournamentId}/bracket/playoffPairs.json`,
                {
                    method: 'PUT',
                    body: JSON.stringify([swissPairs]),
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            if (!bracketRes.ok) {
                throw new Error('Failed to save Swiss pairings');
            }

            await authFetch(
                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${swissTournamentId}/swissCurrentRound.json`,
                {
                    method: 'PUT',
                    body: JSON.stringify(1),
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${swissTournamentId}/swissTotalRounds.json`, {
                method: 'PUT',
                body: JSON.stringify(totalRounds),
                headers: { 'Content-Type': 'application/json' }
            });

            await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${swissTournamentId}/swissRoundDeadlines/1.json`, {
                method: 'PUT',
                body: JSON.stringify(createSwissRoundDeadline()),
                headers: { 'Content-Type': 'application/json' }
            });

            if (isCsSwiss) {
                await Promise.all([
                    authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${swissTournamentId}/swissMode.json`, {
                        method: 'PUT',
                        body: JSON.stringify('cs-to-playoffs'),
                        headers: { 'Content-Type': 'application/json' }
                    }),
                    authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${swissTournamentId}/swissPhase.json`, {
                        method: 'PUT',
                        body: JSON.stringify('swiss'),
                        headers: { 'Content-Type': 'application/json' }
                    }),
                    authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${swissTournamentId}/swissWinTarget.json`, {
                        method: 'PUT',
                        body: JSON.stringify(CS_SWISS_WIN_TARGET),
                        headers: { 'Content-Type': 'application/json' }
                    }),
                    authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${swissTournamentId}/swissLossLimit.json`, {
                        method: 'PUT',
                        body: JSON.stringify(CS_SWISS_LOSS_LIMIT),
                        headers: { 'Content-Type': 'application/json' }
                    })
                ]);
            }

            await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${swissTournamentId}/status.json`, {
                method: 'PUT',
                body: JSON.stringify('Started!'),
                headers: { 'Content-Type': 'application/json' }
            });

            alert(
                isCsSwiss
                    ? `CS Swiss started! Round 1 — ${swissPairs.length} matches.`
                    : `Swiss started! Round 1 of ${totalRounds} — ${swissPairs.length} matches.`
            );
            window.location.reload();
        } catch (error) {
            console.error('Error starting Swiss tournament:', error);
            alert('Error starting Swiss: ' + error.message);
        }
    };

    const persistChampionsLeagueGroupStage = async (championsTournamentId, groups, groupPairs, groupCount) => {
        const bracketRes = await authFetch(
            `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${championsTournamentId}/bracket/playoffPairs.json`,
            {
                method: 'PUT',
                body: JSON.stringify([groupPairs]),
                headers: { 'Content-Type': 'application/json' }
            }
        );
        if (!bracketRes.ok) {
            throw new Error('Failed to save group stage matches');
        }

        await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${championsTournamentId}/groups.json`, {
            method: 'PUT',
            body: JSON.stringify(groups),
            headers: { 'Content-Type': 'application/json' }
        });

        await authFetch(
            `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${championsTournamentId}/championsLeaguePhase.json`,
            {
                method: 'PUT',
                body: JSON.stringify('group'),
                headers: { 'Content-Type': 'application/json' }
            }
        );

        await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${championsTournamentId}/status.json`, {
            method: 'PUT',
            body: JSON.stringify('Started!'),
            headers: { 'Content-Type': 'application/json' }
        });

        alert(
            `Champions League started! ${groupCount} groups of 4 — ${groupPairs.length} group matches. Top 2 per group advance.`
        );
        setShowSpinningWheel(false);
        setSpinningWheelMode('kickoff');
        window.location.reload();
    };

    const handleStartChampionsLeague = async (championsTournamentId, options = {}) => {
        if (!options.skipConfirm && !window.confirm('Draw groups and start the Champions League group stage?')) {
            return;
        }

        try {
            const response = await authFetch(
                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${championsTournamentId}/.json`
            );
            if (!response.ok) {
                throw new Error('Failed to fetch tournament data');
            }

            const tournamentData = await response.json();
            const playerList = Object.values(tournamentData.players || {}).filter(
                (player) => player && player.name && player.name.trim() !== '' && player.name.trim() !== 'TBD'
            );

            const prepared = prepareChampionsLeagueGroupStage(playerList, tournamentData, options);
            if (!prepared.validation.valid) {
                alert(prepared.validation.message);
                return;
            }

            await persistChampionsLeagueGroupStage(
                championsTournamentId,
                prepared.groups,
                prepared.groupPairs,
                prepared.groupCount
            );
        } catch (error) {
            console.error('Error starting Champions League:', error);
            alert('Error starting Champions League: ' + error.message);
        }
    };

    const handleStartChampionsLeagueFromWheel = async (drawResult) => {
        try {
            const response = await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${clickedId}/.json`);
            if (!response.ok) {
                throw new Error('Failed to fetch tournament data');
            }

            const tournamentData = await response.json();
            const playerList = Object.values(tournamentData.players || {}).filter(
                (player) => player && player.name && player.name.trim() !== '' && player.name.trim() !== 'TBD'
            );
            const prepared = isGroupDrawGridComplete(drawResult)
                ? prepareChampionsLeagueFromDrawGrid(drawResult, tournamentData, playerList)
                : prepareChampionsLeagueGroupStage(orderPlayersFromWheelPairs(drawResult, playerList), tournamentData, {
                      shuffle: false
                  });

            if (!prepared.validation.valid) {
                alert(prepared.validation.message);
                return;
            }

            await persistChampionsLeagueGroupStage(
                clickedId,
                prepared.groups,
                prepared.groupPairs,
                prepared.groupCount
            );
        } catch (error) {
            console.error('Error starting Champions League from wheel:', error);
            alert('Error starting Champions League: ' + error.message);
        }
    };

    const handleStartTournament = async (preBracketPairs) => {
        // This will be called when spinning wheel completes
        if (spinningWheelMode === 'champions-league') {
            await handleStartChampionsLeagueFromWheel(preBracketPairs);
            return;
        }

        const isBracketComplete = preBracketPairs.every((pair) => pair[0] !== 'TBD' && pair[1] !== 'TBD');

        if (!isBracketComplete) {
            console.error('Bracket is not complete. Please fill all slots.');
            alert('Bracket is not complete. Please fill all slots.');
            return;
        }

        try {
            // Get tournament data
            const tournamentResponseGET = await authFetch(
                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${clickedId}/.json`,
                {
                    method: 'GET'
                }
            );

            if (!tournamentResponseGET.ok) {
                throw new Error('Failed to fetch tournament data');
            }

            const tournamentData = await tournamentResponseGET.json();
            const maxPlayers = tournamentData.maxPlayers;
            const useLoserBracket = tournamentData.loserBracket === true;
            const tournamentPlayoffGamesRaw = tournamentData.tournamentPlayoffGames || 'bo-1';
            const gameType = normalizeMatchType(tournamentPlayoffGamesRaw);
            const gameTypeFinal = normalizeMatchType(
                tournamentData.tournamentPlayoffGamesFinal || tournamentPlayoffGamesRaw
            );
            const gameTypeThirdPlace = normalizeMatchType(
                tournamentData.tournamentPlayoffGamesThirdPlace || tournamentPlayoffGamesRaw
            );
            const players = tournamentData.players;

            const getNumGames = (type) => (type === 'bo-5' ? 5 : type === 'bo-3' ? 3 : 1);
            const getGameTypeForStage = (stageName) => {
                if (stageName === 'Final') {
                    return gameTypeFinal;
                }
                if (stageName === 'Third Place') {
                    return gameTypeThirdPlace;
                }
                return gameType;
            };

            if (useLoserBracket) {
                const orderedPlayers = preBracketPairs.flat().map((playerName) => {
                    const player = Object.values(players).find((entry) => entry.name === playerName);
                    return (
                        player || {
                            name: playerName,
                            ratings: '0',
                            stars: 0
                        }
                    );
                });

                const fullBracketStructure = createDoubleElimPlayoffPairs(
                    tournamentData.tournamentPlayoffGames || '1',
                    tournamentData.tournamentPlayoffGamesFinal || tournamentData.tournamentPlayoffGames || '1',
                    orderedPlayers,
                    maxPlayers
                );

                const bracketResponse = await authFetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${clickedId}/bracket/playoffPairs.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify(fullBracketStructure),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (!bracketResponse.ok) {
                    throw new Error('Failed to update tournament bracket');
                }

                await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${clickedId}/stageLabels.json`, {
                    method: 'PUT',
                    body: JSON.stringify(getDoubleElimStageLabels(maxPlayers)),
                    headers: { 'Content-Type': 'application/json' }
                });

                const statusResponse = await authFetch(
                    `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${clickedId}/status.json`,
                    {
                        method: 'PUT',
                        body: JSON.stringify('Started!'),
                        headers: { 'Content-Type': 'application/json' }
                    }
                );

                if (!statusResponse.ok) {
                    throw new Error('Failed to update tournament status');
                }

                setShowSpinningWheel(false);
                window.location.reload();
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

            // Determine number of games for first stage
            const numGames = getNumGames(gameType);

            // Format bracket pairs with player data
            const formattedBracket = preBracketPairs.map((pair) => {
                const player1 = Object.values(players).find((p) => p.name === pair[0]);
                const player2 = Object.values(players).find((p) => p.name === pair[1]);

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

                // Create games array
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
                    type: getGameTypeForStage(currentStageLabels[0] || 'Quarter-final'),
                    winner: null,
                    color1: 'red',
                    color2: 'blue'
                };
            });

            // Create the full bracket structure with all stages
            const fullBracketStructure = [formattedBracket]; // Stage 0

            // Add empty stages for Semi-final, Third Place, and Final
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
                    pairsInStage = 1;
                }

                for (let j = 0; j < pairsInStage; j++) {
                    const stageGameType = getGameTypeForStage(stageName);
                    const stageNumGames = getNumGames(stageGameType);
                    const emptyGames = Array.from({ length: stageNumGames }, (_, index) => ({
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
                        type: stageGameType,
                        winner: null,
                        color1: 'red',
                        color2: 'blue'
                    });
                }

                fullBracketStructure.push(stageGames);
            }

            console.log('Full bracket structure to be posted:', fullBracketStructure);

            // Post the bracket structure to the database
            const bracketResponse = await authFetch(
                `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${clickedId}/bracket/playoffPairs.json`,
                {
                    method: 'PUT',
                    body: JSON.stringify(fullBracketStructure),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!bracketResponse.ok) {
                throw new Error('Failed to update tournament bracket');
            }

            console.log('Tournament Bracket Updated successfully!');

            // Update tournament status to "Started!"
            await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${clickedId}/status.json`, {
                method: 'PUT',
                body: JSON.stringify('Started!'),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.log('Tournament status updated to Started!');

            // Snapshot leaderboard rankings at the start of the tournament
            try {
                const snapshotResult = await snapshotLeaderboardRanks();
                if (snapshotResult.success) {
                    console.log(
                        `Leaderboard snapshot taken at tournament start: ${snapshotResult.successCount} players, ${snapshotResult.errorCount} errors`
                    );
                } else {
                    console.error('Failed to snapshot leaderboard at tournament start:', snapshotResult.error);
                }
            } catch (error) {
                console.error('Error during leaderboard snapshot at tournament start:', error);
            }

            // Close spinning wheel and reload to show bracket
            setShowSpinningWheel(false);
            window.location.reload();
        } catch (error) {
            console.error('Error updating tournament status:', error);
            alert('Error starting tournament');
        }
    };

    const substituteTBDPlayer = async (user, tournamentInternalId, playerStars, playerRatings) => {
        // Find the index of the first occurrence of 'TBD' team in the array
        const firstStagePairsResponse = await authFetch(
            `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentInternalId}/bracket/playoffPairs/0.json`
        );

        const data = await firstStagePairsResponse.json();

        if (data) {
            const indexes = data.reduce((acc, pair, idx) => {
                if (pair.team1 === 'TBD') {
                    acc.push({ index: idx, team: 'team1' });
                }
                if (pair.team2 === 'TBD') {
                    acc.push({ index: idx, team: 'team2' });
                }
                return acc;
            }, []);

            if (indexes.length > 0) {
                // Loop through all found indexes and substitute 'TBD' with the user
                const randomIndex = Math.floor(Math.random() * indexes.length);
                const { index, team } = indexes[randomIndex];

                // Substitute 'TBD' with the user at the randomly selected index
                if (team === 'team1') {
                    data[index].team1 = user.name;
                    data[index].stars1 = playerStars;
                    data[index].ratings1 = playerRatings;
                } else {
                    data[index].team2 = user.name;
                    data[index].stars2 = playerStars;
                    data[index].ratings2 = playerRatings;
                }

                try {
                    const response = await authFetch(
                        `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentInternalId}/bracket/playoffPairs/0.json`,
                        {
                            method: 'PUT',
                            body: JSON.stringify(data),
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    if (response.ok) {
                        console.log('Pairs posted to Firebase successfully');

                        // retrieveWinnersFromDatabase();
                    } else {
                        console.log('Failed to post pairs to Firebase');
                    }
                } catch (e) {
                    console.error(e.message);
                }
            } else {
                // If 'TBD' team is not found, handle the case (e.g., display a message)
                console.log('No TBD team found in firstStagePairs.');
            }
        } else {
            console.log(`No data found for tournament ID: ${tournamentInternalId}`);
        }
    };

    // const showDetailsHandler = (tournament) => {
    //     setSelectedTournament(tournament);
    //     setShowDetails(true);
    // };

    const showDetailsHandler = async (
        currentTournamentStatus,
        currentTournamentWinnersObject,
        currentTournamentId,
        tournament = null
    ) => {
        // console.log('currentTournamentWinner', currentTournamentWinnersObject);

        setClickedId(currentTournamentId);
        setTournamentStatus(currentTournamentStatus);
        setTournamentWinners(currentTournamentWinnersObject);

        // Check if this is a "Registration finished!" status and tournament has randomBracket enabled
        if (currentTournamentStatus === 'Registration finished!' && tournament && usesSpinningWheel(tournament)) {
            setClickedId(currentTournamentId);
            setTournamentPlayers(tournament.players || {});
            setSpinningWheelMode(tournament.type === 'champions-league' ? 'champions-league' : 'kickoff');
            setShowSpinningWheel(true);
            navigate(`/tournaments/homm3/${currentTournamentId}`);
        } else {
            // Manual open — drop stale report deep-link params so View league/bracket
            // does not immediately pop the report dialog again
            const next = new URLSearchParams(searchParams);
            if (next.has('report') || next.has('game')) {
                next.delete('report');
                next.delete('game');
                setSearchParams(next, { replace: true });
            }
            navigate(`/tournaments/homm3/${currentTournamentId}`);
        }
    };

    // Check if tournament has live games (castles selected but no winner)
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

    const isVisibleTournamentForUser = (tournament) => {
        if (!isAdmin && !isPublicTournament(tournament)) {
            return false;
        }
        if (!isAdmin && tournament.status === 'Pending funding') {
            const ownPendingFunding =
                tournament.status === 'Pending funding' && isTournamentCreator(tournament, userNickName);
            if (!ownPendingFunding) {
                return false;
            }
        }
        return true;
    };

    const matchesStatusFilter = (tournament, filter) => {
        if (filter === null) {
            return false;
        }
        if (filter === 'all') {
            return true;
        }
        if (filter === 'registration') {
            if (tournament.status === 'Registration' || tournament.status === 'Registration Started') {
                return true;
            }
            return (
                tournament.status === 'Pending funding' && (isTournamentCreator(tournament, userNickName) || isAdmin)
            );
        }
        if (filter === 'registrationFinished') {
            return tournament.status === 'Registration finished!';
        }
        if (filter === 'started') {
            return tournament.status === 'Started!';
        }
        if (filter === 'finished') {
            return tournament.status.includes('Finished');
        }
        if (filter === 'live') {
            return hasLiveGames(tournament);
        }
        if (filter === 'draft') {
            return isAdmin && !isPublicTournament(tournament);
        }
        return true;
    };

    const filteredTournaments = tournaments.filter((tournament) => {
        if (statusFilter === null || !isVisibleTournamentForUser(tournament)) {
            return false;
        }
        return matchesStatusFilter(tournament, statusFilter);
    });

    const hasTournamentsForFilter = (filter) =>
        tournaments.some((tournament) => isVisibleTournamentForUser(tournament) && matchesStatusFilter(tournament, filter));

    const emptyStateCopy = {
        registration: {
            title: 'No tournaments are open for registration right now.',
            text: 'Some tournaments may have finished registration or already moved into play.'
        },
        started: {
            title: 'No tournaments are in progress right now.',
            text: 'You can check tournaments that are open for registration, ready to start, or already finished.'
        }
    };

    const emptyStateActions = [
        { filter: 'registration', label: 'Check registration open' },
        { filter: 'registrationFinished', label: 'Check registration finished' },
        { filter: 'finished', label: 'Check finished tournaments' }
    ].filter((action) => action.filter !== statusFilter && hasTournamentsForFilter(action.filter));

    const activeTournament =
        tournamentId && tournaments.length > 0
            ? tournaments.find((tournament) => tournament.id === tournamentId) || null
            : null;
    const isFullPageView = Boolean(activeTournament);
    const activeEmptyState = filteredTournaments.length === 0 ? emptyStateCopy[statusFilter] : null;

    const tournamentList =
        tournaments.length > 0 ? (
            <ul className={classes.tournamentList}>
                {activeEmptyState && (
                    <li className={classes.noTournaments}>
                        <p className={classes.emptyStateTitle}>{activeEmptyState.title}</p>
                        <p className={classes.emptyStateText}>{activeEmptyState.text}</p>
                        {emptyStateActions.length > 0 && (
                            <div className={classes.emptyStateActions}>
                                {emptyStateActions.map((action) => (
                                    <button
                                        key={action.filter}
                                        type="button"
                                        className={`${classes.btn} ${classes.btnPrimary}`}
                                        onClick={() => setStatusFilter(action.filter)}
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </li>
                )}
                {filteredTournaments
                    .sort((a, b) => {
                        const statusOrder = {
                            'Registration Started': 1,
                            Registration: 1,
                            'Started!': 2,
                            'Tournament Finished': 3
                        };
                        const statusDiff = (statusOrder[a.status] || 999) - (statusOrder[b.status] || 999);
                        if (statusDiff !== 0) {
                            return statusDiff;
                        }
                        return new Date(b.date) - new Date(a.date);
                    })
                    .map((tournament) => {
                        maxTournamnetPlayers = tournament.maxPlayers;

                        const getStatusClass = (status) => {
                            if (status === 'Draft' || status === 'Pending funding') {
                                return 'draft';
                            }
                            if (status === 'Registration' || status.includes('Registration')) {
                                return 'registration';
                            }
                            if (status === 'Started!') {
                                return 'started';
                            }
                            if (status.includes('Finished')) {
                                return 'finished';
                            }
                            return '';
                        };

                        const getPlaceLabel = (place) => {
                            if (place === '1st' || place === '1') {
                                return '1st';
                            }
                            if (place === '2nd' || place === '2') {
                                return '2nd';
                            }
                            if (place === '3rd' || place === '3') {
                                return '3rd';
                            }
                            return place;
                        };

                        const prizeBreakdown = getTournamentPrizeBreakdown(tournament);
                        const averageStars = getAverageTournamentStars(tournament);
                        const roundedAverageStars = averageStars !== null ? roundToHalfStar(averageStars) : null;
                        const firebaseUid = getFirebaseUid();
                        const commentatorRequest = getCommentatorRequestForUser(tournament, firebaseUid);
                        const approvedCommentator = getApprovedCommentator(tournament, firebaseUid);
                        const pendingCommentatorRequests = getPendingCommentatorRequests(tournament);
                        const approvedCommentators = getApprovedCommentators(tournament);
                        const canManageCommentators = canManageCommentatorRequests(tournament, {
                            isAdmin,
                            userNickName,
                            firebaseUid
                        });
                        const canRequestCommentator =
                            isLogged &&
                            canRequestTournamentCommentator(tournament) &&
                            !approvedCommentator &&
                            !commentatorRequest;
                        const canToggleCommentating = canToggleTournamentCommentating(tournament, firebaseUid);

                        return (
                            <li key={tournament.id} className={classes.bracket}>
                                <h3 className={classes.tournamentTitle}>
                                    <span className={classes.tournamentTitleMain}>
                                        {`${tournament.name} (${tournament.date})`}
                                        {isAdmin && !isPublicTournament(tournament) ? (
                                            <span className={classes.privateTag}>Private</span>
                                        ) : null}
                                        {tournament.loserBracket ? (
                                            <span className={classes.privateTag}>Double elim</span>
                                        ) : null}
                                        {tournament.type === 'champions-league' ? (
                                            <span className={classes.privateTag}>Champions League</span>
                                        ) : null}
                                        {tournament.type === 'cs-swiss' ? (
                                            <span className={classes.privateTag}>CS Swiss</span>
                                        ) : null}
                                    </span>
                                    {roundedAverageStars !== null && (
                                        <span
                                            className={classes.tournamentAverageStars}
                                            title={`Average player stars: ${averageStars.toFixed(1)}`}
                                        >
                                            <StarsComponent stars={roundedAverageStars} />
                                        </span>
                                    )}
                                </h3>
                                <div className={`${classes.statusBadge} ${classes[getStatusClass(tournament.status)]}`}>
                                    {tournament.status}
                                </div>
                                <div className={classes.infoGrid}>
                                    <div className={classes.infoItem}>
                                        <p>
                                            <strong>{countRegisteredPlayers(tournament)}</strong> /{' '}
                                            {maxTournamnetPlayers}
                                        </p>
                                        <p className={classes.infoLabel}>Players registered</p>
                                    </div>
                                    <div className={classes.infoItem}>
                                        <p>
                                            <strong>{maxTournamnetPlayers}</strong>
                                        </p>
                                        <p className={classes.infoLabel}>Max players</p>
                                    </div>
                                    {getTournamentPrizeLabel(tournament) && (
                                        <div className={classes.infoItem}>
                                            <p>
                                                <strong>{getTournamentPrizeLabel(tournament)}</strong>
                                            </p>
                                            <p className={classes.infoLabel}>Prize pool</p>
                                        </div>
                                    )}
                                    {getAttendanceFeeUsd(tournament) > 0 && isRegistrationOpen(tournament.status) && (
                                        <div className={classes.infoItem}>
                                            <p>
                                                <strong>${getAttendanceFeeUsd(tournament)}</strong>
                                            </p>
                                            <p className={classes.infoLabel}>Self-registration fee</p>
                                        </div>
                                    )}
                                    {tournament.winner && tournament.status.includes('Finished') && (
                                        <div className={`${classes.infoItem} ${classes.infoItemFull}`}>
                                            <div className={classes.winnersPreview}>
                                                {Object.entries(tournament.winners)
                                                    .slice(0, 3)
                                                    .map(([place, winner]) => (
                                                        <div key={place} className={classes.winnerPreviewItem}>
                                                            <span className={classes.placeBadge}>
                                                                {getPlaceLabel(place)}
                                                            </span>
                                                            <span className={classes.winnerName}>{winner}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className={classes.playersSection}>
                                    <div className={classes.playersHeader}>
                                        <button
                                            className={`${classes.btn} ${classes.btnToggle}`}
                                            onClick={() => toggleShowPlayers(tournament.id)}
                                        >
                                            {showPlayers[tournament.id] ? 'Hide players' : 'Show players'}
                                        </button>
                                    </div>
                                    {showPlayers[tournament.id] && (
                                        <ul className={classes.playersList}>
                                            {Object.entries(getTournamentPlayersObject(tournament))
                                                .filter(
                                                    ([, player]) =>
                                                        player !== null &&
                                                        player.name !== undefined &&
                                                        player.name.trim() !== ''
                                                )
                                                .sort(
                                                    ([, a], [, b]) =>
                                                        (Number(b.stars) || 0) - (Number(a.stars) || 0) ||
                                                        a.name.localeCompare(b.name)
                                                )
                                                .map(([playerKey, player]) => (
                                                    <TournamentPlayerChip
                                                        key={playerKey}
                                                        player={player}
                                                        canKick={canKickTournamentPlayer(tournament, {
                                                            isAdmin,
                                                            userNickName
                                                        })}
                                                        onKick={() =>
                                                            handleKickPlayer(tournament, playerKey, player.name)
                                                        }
                                                        kicking={kickingPlayerKey === `${tournament.id}:${playerKey}`}
                                                    />
                                                ))}
                                        </ul>
                                    )}
                                </div>

                                {(canRequestCommentator ||
                                    commentatorRequest ||
                                    approvedCommentator ||
                                    approvedCommentators.length > 0 ||
                                    (canManageCommentators && pendingCommentatorRequests.length > 0)) && (
                                    <div className={classes.commentatorSection}>
                                        <div className={classes.commentatorHeader}>
                                            <p className={classes.infoLabel}>Commentators</p>
                                            {approvedCommentators.some((commentator) => commentator.isCommentating) ? (
                                                <span className={classes.commentatorLiveBadge}>On air</span>
                                            ) : null}
                                        </div>

                                        {approvedCommentators.length > 0 ? (
                                            <ul className={classes.commentatorList}>
                                                {approvedCommentators.map((commentator) => {
                                                    const watchUrl = getTwitchWatchUrl(commentator.twitchLogin);
                                                    return (
                                                        <li
                                                            key={commentator.commentatorUid}
                                                            className={classes.commentatorItem}
                                                        >
                                                            <span className={classes.commentatorName}>
                                                                {commentator.name}
                                                            </span>
                                                            {commentator.isCommentating ? (
                                                                <span className={classes.commentatorLiveBadge}>
                                                                    Commentating
                                                                </span>
                                                            ) : null}
                                                            {watchUrl ? (
                                                                <a
                                                                    href={watchUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className={classes.commentatorWatchLink}
                                                                >
                                                                    Twitch
                                                                </a>
                                                            ) : null}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : (
                                            <p className={classes.commentatorHint}>
                                                Streamers can apply to commentate this cup once approved by the host.
                                            </p>
                                        )}

                                        {canRequestCommentator ? (
                                            <button
                                                type="button"
                                                className={classes.btn}
                                                disabled={commentatorActionKey === `${tournament.id}:request`}
                                                onClick={() => handleRequestCommentator(tournament)}
                                            >
                                                {commentatorActionKey === `${tournament.id}:request`
                                                    ? 'Submitting…'
                                                    : 'Request to commentate'}
                                            </button>
                                        ) : null}

                                        {commentatorRequest ? (
                                            <div className={classes.registrationActions}>
                                                <div className={classes.registeredBadge}>
                                                    Commentator request pending
                                                </div>
                                                <button
                                                    type="button"
                                                    className={`${classes.btn} ${classes.btnDanger}`}
                                                    disabled={commentatorActionKey === `${tournament.id}:withdraw`}
                                                    onClick={() => handleWithdrawCommentatorRequest(tournament)}
                                                >
                                                    {commentatorActionKey === `${tournament.id}:withdraw`
                                                        ? 'Withdrawing…'
                                                        : 'Withdraw request'}
                                                </button>
                                            </div>
                                        ) : null}

                                        {approvedCommentator ? (
                                            <div className={classes.registrationActions}>
                                                <div className={classes.registeredBadge}>Approved commentator</div>
                                                {canToggleCommentating ? (
                                                    <button
                                                        type="button"
                                                        className={`${classes.btn} ${
                                                            approvedCommentator.isCommentating
                                                                ? classes.btnDanger
                                                                : classes.btnSuccess
                                                        }`}
                                                        disabled={
                                                            commentatorActionKey === `${tournament.id}:commentating`
                                                        }
                                                        onClick={() =>
                                                            handleToggleCommentating(
                                                                tournament,
                                                                !approvedCommentator.isCommentating
                                                            )
                                                        }
                                                    >
                                                        {commentatorActionKey === `${tournament.id}:commentating`
                                                            ? 'Saving…'
                                                            : approvedCommentator.isCommentating
                                                              ? 'Stop commentating'
                                                              : 'Start commentating'}
                                                    </button>
                                                ) : null}
                                            </div>
                                        ) : null}

                                        {canManageCommentators && pendingCommentatorRequests.length > 0 ? (
                                            <div className={classes.commentatorRequestsPanel}>
                                                <p className={classes.commentatorRequestsTitle}>Pending requests</p>
                                                <ul className={classes.commentatorRequestsList}>
                                                    {pendingCommentatorRequests.map((request) => (
                                                        <li
                                                            key={request.requestId}
                                                            className={classes.commentatorRequestItem}
                                                        >
                                                            <div className={classes.commentatorRequestMeta}>
                                                                <span>{request.name}</span>
                                                                {request.twitchLogin ? (
                                                                    <a
                                                                        href={getTwitchWatchUrl(request.twitchLogin)}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className={classes.commentatorWatchLink}
                                                                    >
                                                                        @{request.twitchLogin}
                                                                    </a>
                                                                ) : null}
                                                            </div>
                                                            <div className={classes.commentatorRequestActions}>
                                                                <button
                                                                    type="button"
                                                                    className={`${classes.btn} ${classes.btnSuccess}`}
                                                                    disabled={
                                                                        commentatorActionKey ===
                                                                        `${tournament.id}:approve:${request.requestId}`
                                                                    }
                                                                    onClick={() =>
                                                                        handleApproveCommentator(
                                                                            tournament,
                                                                            request.requestId,
                                                                            request
                                                                        )
                                                                    }
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className={`${classes.btn} ${classes.btnDanger}`}
                                                                    disabled={
                                                                        commentatorActionKey ===
                                                                        `${tournament.id}:reject:${request.requestId}`
                                                                    }
                                                                    onClick={() =>
                                                                        handleRejectCommentator(
                                                                            tournament,
                                                                            request.requestId,
                                                                            request.name
                                                                        )
                                                                    }
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : null}
                                    </div>
                                )}

                                <div className={classes.actionButtons}>
                                    {tournament.status === 'Pending funding' &&
                                    (isTournamentCreator(tournament, userNickName) || authCtx.isAdmin) ? (
                                        <button
                                            className={`${classes.btn} ${classes.btnSuccess}`}
                                            disabled={hostSeedCheckoutTournamentId === tournament.id}
                                            onClick={() => handlePayHostSeed(tournament)}
                                        >
                                            {hostSeedCheckoutTournamentId === tournament.id
                                                ? 'Opening checkout…'
                                                : `Pay prize pool — $${Number(tournament.fundingGoalUsd) || 0}`}
                                        </button>
                                    ) : null}
                                    <button
                                        className={`${classes.btn} ${classes.btnPrimary}`}
                                        onClick={() =>
                                            showDetailsHandler(
                                                tournament.status,
                                                tournament.winners,
                                                tournament.id,
                                                tournament
                                            )
                                        }
                                    >
                                        {getTournamentViewLabel(tournament.type)}
                                    </button>

                                    {canDeleteTournament(tournament, { isAdmin, userNickName }) && (
                                        <button
                                            type="button"
                                            className={`${classes.btn} ${classes.btnDanger}`}
                                            disabled={
                                                deletingTournamentId === tournament.id ||
                                                isTournamentDeleteBlocked(tournament)
                                            }
                                            title={
                                                isTournamentDeleteBlocked(tournament)
                                                    ? 'Cannot delete after the tournament has started'
                                                    : undefined
                                            }
                                            onClick={() => handleDeleteTournament(tournament)}
                                        >
                                            {deletingTournamentId === tournament.id ? 'Deleting…' : 'Delete'}
                                        </button>
                                    )}

                                    {authCtx.isAdmin &&
                                        tournament.type === 'league' &&
                                        tournament.status === 'Registration finished!' && (
                                            <button
                                                className={`${classes.btn} ${classes.btnSuccess}`}
                                                onClick={() => handleStartLeague(tournament.id)}
                                            >
                                                Start league
                                            </button>
                                        )}

                                    {authCtx.isAdmin &&
                                        (tournament.type === 'swiss' || tournament.type === 'cs-swiss') &&
                                        tournament.status === 'Registration finished!' && (
                                            <button
                                                className={`${classes.btn} ${classes.btnSuccess}`}
                                                onClick={() => handleStartSwiss(tournament.id)}
                                            >
                                                {tournament.type === 'cs-swiss' ? 'Start CS Swiss' : 'Start Swiss'}
                                            </button>
                                        )}

                                    {authCtx.isAdmin &&
                                        tournament.type === 'champions-league' &&
                                        tournament.status === 'Registration finished!' && (
                                            <button
                                                className={`${classes.btn} ${classes.btnSuccess}`}
                                                onClick={() => {
                                                    setClickedId(tournament.id);
                                                    setTournamentPlayers(tournament.players || {});
                                                    if (tournament.randomBracket) {
                                                        setSpinningWheelMode('champions-league');
                                                        setShowSpinningWheel(true);
                                                        return;
                                                    }
                                                    handleStartChampionsLeague(tournament.id);
                                                }}
                                            >
                                                {tournament.randomBracket ? 'Draw groups (wheel)' : 'Start group stage'}
                                            </button>
                                        )}

                                    {tournament.status !== 'Pending funding' &&
                                        (checkRegisterUser(userNickName, getTournamentPlayersObject(tournament)) ? (
                                            <div className={classes.registrationActions}>
                                                <div className={classes.registeredBadge}>You are registered</div>
                                                {canLeaveTournament(tournament) && (
                                                    <button
                                                        type="button"
                                                        className={`${classes.btn} ${classes.btnDanger}`}
                                                        disabled={leavingTournamentId === tournament.id}
                                                        onClick={() => handleLeaveTournament(tournament)}
                                                    >
                                                        {leavingTournamentId === tournament.id
                                                            ? 'Leaving…'
                                                            : 'Leave tournament'}
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            countRegisteredPlayers(tournament) < tournament.maxPlayers &&
                                            canShowSelfRegister(tournament) && (
                                                <button
                                                    className={classes.btn}
                                                    disabled={attendanceCheckoutTournamentId === tournament.id}
                                                    onClick={() => handleSelfRegister(tournament)}
                                                >
                                                    {getSelfRegisterLabel(tournament)}
                                                </button>
                                            )
                                        ))}
                                </div>

                                {showDetails &&
                                    clickedId === tournament.id &&
                                    !isFullPageView &&
                                    renderPlayerList(getTournamentPlayersObject(tournament), {
                                        canKick: canKickTournamentPlayer(tournament, { isAdmin, userNickName }),
                                        onKick: (playerKey, playerName) =>
                                            handleKickPlayer(tournament, playerKey, playerName),
                                        kickingPlayerKey: kickingPlayerKey?.startsWith(`${tournament.id}:`)
                                            ? kickingPlayerKey.slice(`${tournament.id}:`.length)
                                            : null
                                    })}
                                {canInviteTournamentPlayers(tournament, {
                                    isAdmin,
                                    userNickName,
                                    registeredCount: countRegisteredPlayers(tournament),
                                    maxPlayers: tournament.maxPlayers
                                }) && (
                                    <div className={classes.inputGroup}>
                                        <label htmlFor={`nickname-${tournament.id}`}>
                                            {isTournamentCreator(tournament, userNickName) && !isAdmin
                                                ? 'Invite player by nickname'
                                                : "Player's Nickname"}
                                        </label>
                                        {!isAdmin && isTournamentCreator(tournament, userNickName) && (
                                            <p className={classes.hostInviteHint}>
                                                Invited players join for free. Remaining seats can self-register
                                                {getAttendanceFeeUsd(tournament) > 0
                                                    ? ` for $${getAttendanceFeeUsd(tournament)}.`
                                                    : '.'}
                                            </p>
                                        )}
                                        <input
                                            type="text"
                                            id={`nickname-${tournament.id}`}
                                            ref={nicknameRef}
                                            value={nicknameQuery}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setNicknameQuery(value);
                                                updateNicknameSuggestions(
                                                    value,
                                                    getTournamentPlayersObject(tournament)
                                                );
                                            }}
                                            onFocus={() =>
                                                updateNicknameSuggestions(
                                                    nicknameQuery,
                                                    getTournamentPlayersObject(tournament)
                                                )
                                            }
                                            onKeyDown={(e) => handleNicknameKeyDown(e, tournament)}
                                            onBlur={() => {
                                                setTimeout(() => {
                                                    setNicknameSuggestions([]);
                                                    setActiveSuggestionIndex(-1);
                                                }, 120);
                                            }}
                                            autoComplete="off"
                                            required
                                        />
                                        {nicknameSuggestions.length > 0 && (
                                            <div className={classes.suggestionsList}>
                                                {nicknameSuggestions.map((nickname, index) => (
                                                    <button
                                                        key={nickname}
                                                        type="button"
                                                        className={
                                                            index === activeSuggestionIndex
                                                                ? `${classes.suggestionItem} ${classes.suggestionItemActive}`
                                                                : classes.suggestionItem
                                                        }
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setNicknameQuery(nickname);
                                                            setNicknameSuggestions([]);
                                                            setActiveSuggestionIndex(-1);
                                                        }}
                                                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                                                    >
                                                        {nickname}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <div className={classes.adminActions}>
                                            <button
                                                className={classes.btn}
                                                disabled={addingPlayerTournamentId === tournament.id}
                                                onClick={() => {
                                                    const selectedNickname =
                                                        activeSuggestionIndex >= 0
                                                            ? nicknameSuggestions[activeSuggestionIndex]
                                                            : nicknameQuery.trim();
                                                    if (!selectedNickname) {
                                                        return;
                                                    }
                                                    addUserTournament(
                                                        tournament.id,
                                                        selectedNickname,
                                                        getTournamentPlayersObject(tournament),
                                                        tournament.maxPlayers,
                                                        { isAdminManagedAdd: true }
                                                    );
                                                }}
                                            >
                                                {addingPlayerTournamentId === tournament.id ? (
                                                    <span className={classes.loadingInline}>
                                                        <span className={classes.spinner}></span>
                                                        Adding...
                                                    </span>
                                                ) : isTournamentCreator(tournament, userNickName) && !isAdmin ? (
                                                    'Invite player'
                                                ) : (
                                                    'Add player'
                                                )}
                                            </button>
                                            {isAdmin && (
                                                <button
                                                    className={`${classes.btn} ${classes.btnDanger}`}
                                                    disabled={fillingRandomTournamentId === tournament.id}
                                                    onClick={() =>
                                                        fillTournamentWithRandomPlayers(
                                                            tournament.id,
                                                            getTournamentPlayersObject(tournament),
                                                            tournament.maxPlayers
                                                        )
                                                    }
                                                >
                                                    {fillingRandomTournamentId === tournament.id ? (
                                                        <span className={classes.loadingInline}>
                                                            <span className={classes.spinner}></span>
                                                            Filling...
                                                        </span>
                                                    ) : (
                                                        'Fill with random players'
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {tournament.status === 'Registration finished!' && (
                                    <div className={classes.fullBanner}>
                                        <p className={classes.fullBannerTitle}>Tournament is full</p>
                                        {authCtx.isAdmin && !isScheduleTournamentType(tournament.type) && (
                                            <button
                                                className={`${classes.btn} ${classes.btnSuccess}`}
                                                onClick={() =>
                                                    showDetailsHandler(
                                                        tournament.status,
                                                        tournament.winners,
                                                        tournament.id,
                                                        tournament
                                                    )
                                                }
                                            >
                                                Start tournament
                                            </button>
                                        )}
                                    </div>
                                )}

                                {!tournament.status.includes('Finished') && prizeBreakdown ? (
                                    <div className={classes.prizePool}>
                                        <h4>Prize pool</h4>
                                        {Object.entries(prizeBreakdown).map(([place, prize]) => (
                                            <div key={place} className={classes.prizeItem}>
                                                <span className={classes.placeBadge}>{getPlaceLabel(place)}</span>
                                                <span className={classes.prizePlace}>{place}:</span>
                                                <span className={classes.prizeAmount}>
                                                    {`$${Number(prize).toLocaleString()}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    tournament.winners && (
                                        <div className={classes.winnersSection}>
                                            <h4>Tournament winners</h4>
                                            {Object.entries(tournament.winners).map(([place, winner]) => {
                                                const prize = getPrizeAmountForPlace(prizeBreakdown, place);
                                                return (
                                                    <div key={place} className={classes.winnerItem}>
                                                        <span
                                                            className={`${classes.placeBadge} ${classes.placeBadgeLarge}`}
                                                        >
                                                            {getPlaceLabel(place)}
                                                        </span>
                                                        <span className={classes.placeLabel}>{place}</span>
                                                        <span className={classes.winnerNameLarge}>
                                                            {winner}
                                                            {prize && (
                                                                <span className={classes.prizeInBrackets}>
                                                                    {' '}
                                                                    {`($${prize})`}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                )}
                            </li>
                        );
                    })}
            </ul>
        ) : (
            <div className={classes.noTournaments}>No current tournaments available</div>
        );

    if (isFullPageView) {
        return (
            <div className={classes.tournamentFullPage}>
                <div className={classes.tournamentFullPageBar}>
                    <button type="button" className={classes.tournamentBackBtn} onClick={closeTournamentView}>
                        ← Back to tournaments
                    </button>
                    <div className={classes.tournamentFullPageMeta}>
                        <h2 className={classes.tournamentFullPageTitle}>{activeTournament.name}</h2>
                        <p className={classes.tournamentFullPageStatus}>{activeTournament.status}</p>
                    </div>
                </div>
                <div className={classes.tournamentFullPageBody}>
                    {showSpinningWheel ? (
                        <SpinningWheel
                            players={tournamentPlayers}
                            onStartTournament={handleStartTournament}
                            mode={spinningWheelMode}
                        />
                    ) : (
                        <TournamentBracket
                            key={clickedId}
                            fullScreen
                            maxPlayers={activeTournament.maxPlayers}
                            tournamentId={clickedId}
                            tournamentStatus={tournamentStatus}
                            tournamentWinners={tournamentWinnersObject}
                            strictCastlePick={Boolean(activeTournament.strictCastlePick)}
                        />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`${classes.tournamentContainer} data-page`}>
            <div className={classes.pageHeader}>
                <div className={classes.pageTitleBlock}>
                    <h2 className={classes.tournamentHeader}>Current tournaments</h2>
                    <p className={classes.pageSubtitle}>Browse cups, register, and open brackets.</p>
                </div>
                <div className={classes.headerActions}>
                    {isLogged && (
                        <button
                            type="button"
                            className={`${classes.addTournamentBtn} ${isAddTournamentDisabled ? classes.addTournamentBtnMuted : ''}`}
                            onClick={openAddTournament}
                            title={addTournamentHint}
                        >
                            Add tournament
                        </button>
                    )}
                    <select
                        className={classes.statusFilter}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All tournaments</option>
                        <option value="registration">Registration open</option>
                        <option value="registrationFinished">Registration finished</option>
                        <option value="started">In progress</option>
                        <option value="live">Live games</option>
                        <option value="finished">Finished</option>
                        {isAdmin && <option value="draft">Private drafts</option>}
                    </select>
                </div>
            </div>
            {tournamentList}
        </div>
    );
};

export default TournamentList;
