import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import { authFetch } from '../../api/authFetch';
import React, { useContext, useRef, useState } from 'react';
import Modal from '../Modal/Modal';
import classes from './ModalAddTournament.module.css';
import {
    isKickOffSize,
    KICK_OFF_SIZES,
    shuffleArray,
    setStageLabels
} from '../../components/tournaments/tournament_api';
import {
    createDoubleElimPlayoffPairs,
    DOUBLE_ELIM_SIZES,
    getDoubleElimStageLabels,
    isDoubleElimSize
} from '../../components/tournaments/homm3/loserBracketUtils';
import AuthContext from '../../store/auth-context';
import { getFirebaseUid } from '../../api/authFetch';
import {
    DEFAULT_FUNDING_GOAL_USD,
    formatFundingUsd,
    getHostSeedPoolPreview,
    HOST_SEED_POOL_SHARE,
    MIN_HOST_SEED_USD
} from '../../utils/prizePoolData';
import { fundTournamentFromHostBalance, startHostSeedCheckout } from '../../api/tournamentHostFunding';
import { addCreatorToTournament } from '../../api/tournamentRegistration';
import {
    CS_SWISS_SIZES,
    isCsSwissSize,
    MIN_CS_SWISS_PLAYERS,
    MIN_SWISS_PLAYERS
} from '../../components/tournaments/homm3/swissUtils';
import {
    CHAMPIONS_LEAGUE_GROUP_SIZE,
    CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP,
    CHAMPIONS_LEAGUE_SIZES,
    CHAMPIONS_LEAGUE_TWO_GROUP_SIZES,
    CHAMPIONS_LEAGUE_TWO_GROUP_TYPE,
    isChampionsLeagueSize,
    isChampionsLeagueTwoGroupSize
} from '../../components/tournaments/homm3/championsLeagueUtils';
import { fromDatetimeLocalValue } from '../../components/tournaments/homm3/matchScheduleUtils';
import TournamentFormatPreview from './TournamentFormatPreview';

const MIN_TOURNAMENT_PLAYERS = 2;

const getDefaultTournamentDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = now.getMinutes();
    const roundedMinutes = minutes < 30 ? '00' : '30';
    return `${year}-${month}-${day}T${hours}:${roundedMinutes}`;
};

const Bracket = (props) => {
    const [isSaving, setIsSaving] = useState(false);
    const [date, setDate] = useState(getDefaultTournamentDate);
    const [tournamentName, setTournamentName] = useState('');
    const [maxPlayers, setMaxPlayers] = useState(String(KICK_OFF_SIZES[0]));
    const [tournamentType, setTournamentType] = useState('kick-off');
    const [isPublicTournament, setIsPublicTournament] = useState(true);
    const [loserBracket, setLoserBracket] = useState(false);
    const [strictCastlePick, setStrictCastlePick] = useState(false);
    const [fundingGoalUsd, setFundingGoalUsd] = useState(String(DEFAULT_FUNDING_GOAL_USD));
    const [attendanceFeeUsd, setAttendanceFeeUsd] = useState('0');
    const authCtx = useContext(AuthContext);
    const isLeague = tournamentType === 'league';
    const isSwiss = tournamentType === 'swiss';
    const isCsSwiss = tournamentType === 'cs-swiss';
    const isChampionsLeague = tournamentType === 'champions-league';
    const isChampionsLeagueTwoGroup = tournamentType === CHAMPIONS_LEAGUE_TWO_GROUP_TYPE;
    const isAnyChampionsLeague = isChampionsLeague || isChampionsLeagueTwoGroup;
    const isKickOff = tournamentType === 'kick-off';
    const isScheduleFormat = isLeague || isSwiss || isCsSwiss || isAnyChampionsLeague;
    const showFinalAndThirdPlace = isKickOff || isAnyChampionsLeague;
    const showKnockoutMatchType = isAnyChampionsLeague;
    const showBracketOptions = isKickOff || isAnyChampionsLeague;
    const parsedFundingGoal = Number(fundingGoalUsd);
    const fundingGoalInvalid =
        fundingGoalUsd !== '' && (!Number.isFinite(parsedFundingGoal) || parsedFundingGoal < MIN_HOST_SEED_USD);
    const hasValidFundingGoal =
        fundingGoalUsd !== '' && Number.isFinite(parsedFundingGoal) && parsedFundingGoal >= MIN_HOST_SEED_USD;
    const minPlayersRequired = isCsSwiss
        ? MIN_CS_SWISS_PLAYERS
        : isSwiss
          ? MIN_SWISS_PLAYERS
          : isAnyChampionsLeague
            ? CHAMPIONS_LEAGUE_SIZES[0]
            : MIN_TOURNAMENT_PLAYERS;
    const parsedMaxPlayers = Number(maxPlayers);
    const maxPlayersBelowMin =
        maxPlayers !== '' && Number.isFinite(parsedMaxPlayers) && parsedMaxPlayers < minPlayersRequired;
    const championsLeagueSizeInvalid =
        isAnyChampionsLeague &&
        maxPlayers !== '' &&
        Number.isFinite(parsedMaxPlayers) &&
        !(isChampionsLeagueTwoGroup
            ? isChampionsLeagueTwoGroupSize(parsedMaxPlayers)
            : isChampionsLeagueSize(parsedMaxPlayers));
    const csSwissSizeInvalid =
        isCsSwiss && maxPlayers !== '' && Number.isFinite(parsedMaxPlayers) && !isCsSwissSize(parsedMaxPlayers);
    const kickOffSizeInvalid =
        isKickOff && maxPlayers !== '' && Number.isFinite(parsedMaxPlayers) && !isKickOffSize(parsedMaxPlayers);
    const isMaxPlayersValid =
        maxPlayers !== '' &&
        Number.isFinite(parsedMaxPlayers) &&
        parsedMaxPlayers >= minPlayersRequired &&
        (!isKickOff || isKickOffSize(parsedMaxPlayers)) &&
        (!isCsSwiss || isCsSwissSize(parsedMaxPlayers)) &&
        (!isAnyChampionsLeague ||
            (isChampionsLeagueTwoGroup
                ? isChampionsLeagueTwoGroupSize(parsedMaxPlayers)
                : isChampionsLeagueSize(parsedMaxPlayers)));
    const loserBracketSizeInvalid =
        loserBracket && maxPlayers !== '' && Number.isFinite(parsedMaxPlayers) && !isDoubleElimSize(parsedMaxPlayers);
    const canCreateTournament =
        hasValidFundingGoal &&
        isMaxPlayersValid &&
        tournamentName.trim() !== '' &&
        !loserBracketSizeInvalid &&
        !csSwissSizeInvalid &&
        !kickOffSizeInvalid &&
        !championsLeagueSizeInvalid;

    const tournamentTypeOptions = [
        { value: 'kick-off', label: 'Kick-off' },
        { value: 'league', label: 'League (Round-Robin)' },
        { value: 'swiss', label: 'Swiss System' },
        { value: 'cs-swiss', label: 'CS Swiss to Playoffs' },
        { value: 'champions-league', label: 'Champions League (Groups + Knockout)' },
        { value: CHAMPIONS_LEAGUE_TWO_GROUP_TYPE, label: 'Champions League (Two Group Stages)' }
    ];
    const championsLeaguePlayerOptions = (
        isChampionsLeagueTwoGroup ? CHAMPIONS_LEAGUE_TWO_GROUP_SIZES : CHAMPIONS_LEAGUE_SIZES
    ).map((size) => ({
        value: String(size),
        label: isChampionsLeagueTwoGroup
            ? `${size} players (${size / CHAMPIONS_LEAGUE_GROUP_SIZE}→${size / CHAMPIONS_LEAGUE_GROUP_SIZE / 2} groups, top ${CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP} each stage)`
            : `${size} players (${size / CHAMPIONS_LEAGUE_GROUP_SIZE} groups × ${CHAMPIONS_LEAGUE_GROUP_SIZE}, top ${CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP} advance)`
    }));
    const championsLeagueMaxPlayers =
        maxPlayers !== '' &&
        (isChampionsLeagueTwoGroup
            ? isChampionsLeagueTwoGroupSize(parsedMaxPlayers)
            : isChampionsLeagueSize(parsedMaxPlayers))
            ? String(parsedMaxPlayers)
            : String(isChampionsLeagueTwoGroup ? CHAMPIONS_LEAGUE_TWO_GROUP_SIZES[0] : CHAMPIONS_LEAGUE_SIZES[0]);
    const kickOffMaxPlayers =
        maxPlayers !== '' && isKickOffSize(parsedMaxPlayers) ? String(parsedMaxPlayers) : String(KICK_OFF_SIZES[0]);
    const kickOffPlayerOptions = KICK_OFF_SIZES.map((size) => ({
        value: String(size),
        label: `${size} players`
    }));
    const previewMaxPlayers = isAnyChampionsLeague
        ? Number(championsLeagueMaxPlayers)
        : isKickOff
          ? Number(kickOffMaxPlayers)
          : Number.isFinite(parsedMaxPlayers) && parsedMaxPlayers >= minPlayersRequired
            ? parsedMaxPlayers
            : null;

    const handleTournamentTypeChange = (event) => {
        const nextType = event.target.value;
        setTournamentType(nextType);

        if (nextType === 'champions-league' && !isChampionsLeagueSize(parsedMaxPlayers)) {
            setMaxPlayers(String(CHAMPIONS_LEAGUE_SIZES[0]));
        }

        if (nextType === CHAMPIONS_LEAGUE_TWO_GROUP_TYPE && !isChampionsLeagueTwoGroupSize(parsedMaxPlayers)) {
            setMaxPlayers(String(CHAMPIONS_LEAGUE_TWO_GROUP_SIZES[0]));
        }

        if (nextType === 'kick-off' && !isKickOffSize(parsedMaxPlayers)) {
            setMaxPlayers(String(KICK_OFF_SIZES[0]));
        }
    };
    const playoffGameCountOptions = [
        { value: '1', label: 'BO-1 (1 game)' },
        { value: '3', label: 'BO-3 (3 games)' },
        { value: '5', label: 'BO-5 (5 games)' }
    ];
    const leagueGameCountOptions = [
        { value: '1', label: 'BO-1 (1 game per match)' },
        { value: '2', label: 'BO-2 (2 games, draw possible)' },
        { value: '3', label: 'BO-3 (3 games per match)' }
    ];
    const knockoutGameCountOptions = [
        { value: '1', label: 'BO-1 (1 game per match)' },
        { value: '3', label: 'BO-3 (3 games per match)' }
    ];

    const tournamentPlayoffGames = useRef(null);
    const tournamentPlayoffGamesKnockout = useRef(null);
    const tournamentPlayoffGamesFinal = useRef(null);
    const tournamentPlayoffGamesThirdPlace = useRef(null);
    const randomBracketRef = useRef(null);

    const handleFundingGoalChange = (event) => {
        setFundingGoalUsd(event.target.value);
    };

    const handleAttendanceFeeChange = (event) => {
        setAttendanceFeeUsd(event.target.value);
    };

    const parsedAttendanceFee = Number(attendanceFeeUsd);
    const attendanceFeeInvalid =
        attendanceFeeUsd !== '' && (!Number.isFinite(parsedAttendanceFee) || parsedAttendanceFee < 0);

    const findPendingFundingTournamentForHost = async () => {
        const firebaseUid = getFirebaseUid();
        const response = await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3.json`);
        if (!response.ok) {
            return null;
        }

        const tournaments = await response.json();
        const pendingEntry = Object.entries(tournaments || {}).find(([, tournament]) => {
            if (tournament?.status !== 'Pending funding') {
                return false;
            }
            if (firebaseUid && tournament.createdByUid === firebaseUid) {
                return true;
            }
            return authCtx.userNickName && tournament.createdBy === authCtx.userNickName;
        });

        if (!pendingEntry) {
            return null;
        }

        const [id, tournament] = pendingEntry;
        return { id, ...tournament };
    };

    const handleSave = async () => {
        const name = tournamentName.trim();
        const maxPlayersCount = Number(maxPlayers);
        const goalUsd = parsedFundingGoal;
        const attendanceUsd =
            attendanceFeeUsd === '' || !Number.isFinite(parsedAttendanceFee) || parsedAttendanceFee < 0
                ? 0
                : parsedAttendanceFee;

        if (!name) {
            authCtx.setNotificationShown(true, 'Enter a tournament name.', 'warning', 4);
            return;
        }

        if (loserBracket && !isDoubleElimSize(maxPlayersCount)) {
            authCtx.setNotificationShown(
                true,
                `Loser bracket requires ${DOUBLE_ELIM_SIZES.join(', ')} max players.`,
                'warning',
                6
            );
            return;
        }

        if (isAnyChampionsLeague) {
            const sizeValid = isChampionsLeagueTwoGroup
                ? isChampionsLeagueTwoGroupSize(maxPlayersCount)
                : isChampionsLeagueSize(maxPlayersCount);
            const allowedSizes = isChampionsLeagueTwoGroup ? CHAMPIONS_LEAGUE_TWO_GROUP_SIZES : CHAMPIONS_LEAGUE_SIZES;

            if (!sizeValid) {
                authCtx.setNotificationShown(
                    true,
                    `Champions League requires exactly ${allowedSizes.join(', ')} players (${CHAMPIONS_LEAGUE_GROUP_SIZE} per group).`,
                    'warning',
                    6
                );
                return;
            }
        }

        if (isCsSwiss && !isCsSwissSize(maxPlayersCount)) {
            authCtx.setNotificationShown(
                true,
                `CS Swiss supports exactly ${CS_SWISS_SIZES.join(' or ')} players.`,
                'warning',
                6
            );
            return;
        }

        if (isKickOff && !isKickOffSize(maxPlayersCount)) {
            authCtx.setNotificationShown(
                true,
                `Kick-off requires exactly ${KICK_OFF_SIZES.join(', ')} max players.`,
                'warning',
                6
            );
            return;
        }

        if (!Number.isFinite(maxPlayersCount) || maxPlayersCount < minPlayersRequired) {
            authCtx.setNotificationShown(
                true,
                isCsSwiss
                    ? `CS Swiss tournaments need at least ${MIN_CS_SWISS_PLAYERS} players.`
                    : isSwiss
                      ? `Swiss tournaments need at least ${MIN_SWISS_PLAYERS} players.`
                      : isChampionsLeague
                        ? `Champions League requires ${CHAMPIONS_LEAGUE_SIZES.join(', ')} players.`
                        : 'Max players must be at least 2.',
                'warning',
                5
            );
            return;
        }

        if (!Number.isFinite(goalUsd) || goalUsd < MIN_HOST_SEED_USD) {
            authCtx.setNotificationShown(
                true,
                `Enter a prize pool goal of at least $${MIN_HOST_SEED_USD}.`,
                'warning',
                5
            );
            return;
        }

        if (attendanceFeeInvalid) {
            authCtx.setNotificationShown(
                true,
                'Enter a valid attendance fee (USD). Use 0 for free entry.',
                'warning',
                5
            );
            return;
        }

        const pendingTournament = await findPendingFundingTournamentForHost();
        if (pendingTournament) {
            authCtx.setNotificationShown(
                true,
                `Finish funding or delete "${pendingTournament.name}" before creating another tournament.`,
                'warning',
                8
            );
            return;
        }

        const objTournament = {
            name,
            type: tournamentType,
            maxPlayers: maxPlayersCount,
            prizeType: 'community',
            totalPrizeUsd: 0,
            fundingGoalUsd: goalUsd,
            attendanceFeeUsd: attendanceUsd,
            communityFundingUsd: 0,
            poolFunded: false,
            pricePull: {
                '1st Place': 0,
                '2nd Place': 0,
                '3rd Place': 0
            },
            date: fromDatetimeLocalValue(date),
            tournamentPlayoffGames: tournamentPlayoffGames.current.value,
            tournamentPlayoffGamesKnockout: isAnyChampionsLeague ? tournamentPlayoffGamesKnockout.current.value : null,
            tournamentPlayoffGamesFinal: showFinalAndThirdPlace
                ? tournamentPlayoffGamesFinal.current.value
                : tournamentPlayoffGames.current.value,
            tournamentPlayoffGamesThirdPlace:
                showFinalAndThirdPlace && !(isKickOff && loserBracket)
                    ? tournamentPlayoffGamesThirdPlace.current.value
                    : tournamentPlayoffGames.current.value,
            randomBracket: isLeague || isSwiss ? false : showBracketOptions && randomBracketRef.current.checked,
            loserBracket: isKickOff && loserBracket,
            strictCastlePick,
            swissMode: isCsSwiss ? 'cs-to-playoffs' : isSwiss ? 'fixed-rounds' : null,
            swissWinTarget: isCsSwiss ? 3 : null,
            swissLossLimit: isCsSwiss ? 3 : null,
            swissPhase: isCsSwiss ? 'swiss' : null,
            championsLeaguePhase: isChampionsLeagueTwoGroup ? 'group1' : isChampionsLeague ? 'group' : null,
            groupSize: isAnyChampionsLeague ? CHAMPIONS_LEAGUE_GROUP_SIZE : null,
            qualifiersPerGroup: isAnyChampionsLeague ? CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP : null,
            isPublic: isPublicTournament,
            createdBy: authCtx.userNickName || null,
            createdByUid: getFirebaseUid(),
            status: isPublicTournament ? 'Pending funding' : 'Draft',
            players: {},
            winners: {
                '1st place': 'TBD',
                '2nd place': 'TBD',
                '3rd place': 'TBD'
            }
        };

        if (isKickOff && randomBracketRef.current.checked) {
            objTournament.bracket = {};
            if (loserBracket) {
                const playOffPairs = createDoubleElimPlayoffPairs(
                    objTournament.tournamentPlayoffGames,
                    objTournament.tournamentPlayoffGamesFinal,
                    null,
                    objTournament.maxPlayers
                );
                objTournament.bracket.playoffPairs = playOffPairs;
                objTournament.stageLabels = getDoubleElimStageLabels(objTournament.maxPlayers);
            } else {
                const playOffPairs = shuffleArray(
                    null,
                    objTournament.tournamentPlayoffGames,
                    objTournament.tournamentPlayoffGamesFinal,
                    objTournament.tournamentPlayoffGamesThirdPlace,
                    null,
                    objTournament.maxPlayers
                );
                objTournament.bracket.playoffPairs = playOffPairs;
                objTournament.stageLabels = setStageLabels(objTournament.maxPlayers);
            }
        }

        setIsSaving(true);

        try {
            const response = await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3.json`, {
                method: 'POST',
                body: JSON.stringify(objTournament),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Tournament save failed');
            }

            const created = await response.json();
            const tournamentId = created.name;

            if (!isPublicTournament && tournamentId && authCtx.userNickName) {
                try {
                    await addCreatorToTournament(tournamentId, authCtx.userNickName);
                } catch (registerError) {
                    console.error('Could not auto-register tournament creator:', registerError);
                }
            }

            if (isPublicTournament && tournamentId) {
                const firebaseUid = getFirebaseUid();
                const balanceResult = await fundTournamentFromHostBalance(firebaseUid, tournamentId, goalUsd, {
                    isPublic: true
                });

                if (balanceResult.ok) {
                    try {
                        await addCreatorToTournament(tournamentId, authCtx.userNickName);
                    } catch (registerError) {
                        console.error('Could not auto-register tournament creator:', registerError);
                    }
                    authCtx.setNotificationShown(
                        true,
                        `Tournament "${name}" created — $${balanceResult.poolUsd} added to the prize pool from your balance.`,
                        'success',
                        6
                    );
                    props.onClose();
                    window.location.href = `/tournaments/homm3/${tournamentId}?status=registration`;
                    return;
                }

                const checkoutResult = await startHostSeedCheckout({
                    tournamentId,
                    tournamentName: name,
                    goalUsd,
                    nickname: authCtx.userNickName,
                    redirectMode: 'current-tab'
                });

                if (checkoutResult?.redirected) {
                    return;
                }

                authCtx.setNotificationShown(
                    true,
                    `Tournament "${name}" saved. Complete the $${goalUsd} prize pool payment to open registration.`,
                    'warning',
                    8
                );
                props.onClose();
                window.location.href = `/tournaments/homm3/${tournamentId}?funding=pending`;
                return;
            }

            authCtx.setNotificationShown(true, `Tournament "${name}" created.`, 'success', 5);

            props.onClose();
            window.location.href = '/tournaments/homm3';
        } catch (error) {
            console.error('Error creating tournament:', error);
            authCtx.setNotificationShown(true, 'Failed to create tournament.', 'error', 6);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal onClick={props.onClose} addTournament={props.addTournament}>
            <div className={classes.shell} onClick={(event) => event.stopPropagation()}>
                <header className={classes.header}>
                    <h2 className={classes.title}>Add tournament</h2>
                    <p className={classes.subtitle}>
                        Public cups require a host prize pool seed at creation (95% to the pool). You are registered
                        automatically as the host. Donations and registration fees can top it up later.
                    </p>
                </header>

                <div className={classes.body}>
                    <section className={classes.section}>
                        <h3 className={classes.sectionTitle}>Basics</h3>
                        <div className={classes.grid}>
                            <div className={`${classes.field} ${classes.fieldWide}`}>
                                <label className={classes.label} htmlFor="tournamentName">
                                    Tournament name
                                </label>
                                <input
                                    id="tournamentName"
                                    className={classes.input}
                                    value={tournamentName}
                                    onChange={(event) => setTournamentName(event.target.value)}
                                    placeholder="e.g. June Kick-off Cup"
                                />
                            </div>
                            <div className={classes.field}>
                                <label className={classes.label} htmlFor="tournamentType">
                                    Type
                                </label>
                                <select
                                    id="tournamentType"
                                    className={classes.select}
                                    value={tournamentType}
                                    onChange={handleTournamentTypeChange}
                                >
                                    {tournamentTypeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                {isSwiss && (
                                    <p className={classes.fieldHint}>
                                        Minimum {MIN_SWISS_PLAYERS} players. Pairings follow standings each round
                                        (typically log₂ of player count rounds).
                                    </p>
                                )}
                                {isCsSwiss && (
                                    <p className={classes.fieldHint}>
                                        Supports {CS_SWISS_SIZES.join(' or ')} players. Players qualify at 3 wins or are
                                        eliminated at 3 losses, then qualifiers enter playoffs.
                                    </p>
                                )}
                                {isAnyChampionsLeague && (
                                    <p className={classes.fieldHint}>
                                        {isChampionsLeagueTwoGroup
                                            ? `Two group stages (UCL 2000–01 style): groups of ${CHAMPIONS_LEAGUE_GROUP_SIZE}, top ${CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP} advance twice before knockouts. Requires ${CHAMPIONS_LEAGUE_TWO_GROUP_SIZES.join(' or ')} players.`
                                            : `Groups of ${CHAMPIONS_LEAGUE_GROUP_SIZE}, top ${CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP} advance. Requires exactly ${CHAMPIONS_LEAGUE_SIZES.join(', ')} players.`}
                                    </p>
                                )}
                            </div>
                            <div className={classes.field}>
                                <label className={classes.label} htmlFor="tournamentDate">
                                    Planned start (optional)
                                </label>
                                <input
                                    type="datetime-local"
                                    id="tournamentDate"
                                    className={classes.input}
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    step={1800}
                                />
                            </div>
                            <div className={classes.playersPreviewRow}>
                                <div className={classes.field}>
                                    <label className={classes.label} htmlFor="tournamentPlayers">
                                        Max players
                                    </label>
                                    {isAnyChampionsLeague ? (
                                        <select
                                            id="tournamentPlayers"
                                            className={classes.select}
                                            value={championsLeagueMaxPlayers}
                                            onChange={(event) => setMaxPlayers(event.target.value)}
                                        >
                                            {championsLeaguePlayerOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : isKickOff ? (
                                        <select
                                            id="tournamentPlayers"
                                            className={classes.select}
                                            value={kickOffMaxPlayers}
                                            onChange={(event) => setMaxPlayers(event.target.value)}
                                        >
                                            {kickOffPlayerOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            id="tournamentPlayers"
                                            className={`${classes.input} ${maxPlayersBelowMin ? classes.inputError : ''}`}
                                            type="number"
                                            min={minPlayersRequired}
                                            value={maxPlayers}
                                            onChange={(event) => setMaxPlayers(event.target.value)}
                                        />
                                    )}
                                    {isSwiss && (
                                        <p className={classes.fieldHint}>
                                            Swiss requires at least {MIN_SWISS_PLAYERS} registered players to start.
                                        </p>
                                    )}
                                    {isCsSwiss && (
                                        <p className={classes.fieldHint}>
                                            CS Swiss requires exactly {CS_SWISS_SIZES.join(' or ')} registered players.
                                        </p>
                                    )}
                                    {isKickOff && (
                                        <p className={classes.fieldHint}>
                                            Kick-off supports exactly {KICK_OFF_SIZES.join(', ')} players for a balanced
                                            bracket.
                                        </p>
                                    )}
                                    {isAnyChampionsLeague && (
                                        <p className={classes.fieldHint}>
                                            Must register exactly {championsLeagueMaxPlayers} players — no more, no
                                            less.
                                        </p>
                                    )}
                                    {!isAnyChampionsLeague && maxPlayersBelowMin && (
                                        <p className={classes.fieldError}>
                                            {isCsSwiss
                                                ? `CS Swiss tournaments need at least ${MIN_CS_SWISS_PLAYERS} max players.`
                                                : isSwiss
                                                  ? `Swiss tournaments need at least ${MIN_SWISS_PLAYERS} max players.`
                                                  : 'Max players must be at least 2.'}
                                        </p>
                                    )}
                                    {csSwissSizeInvalid && (
                                        <p className={classes.fieldError}>
                                            CS Swiss supports exactly {CS_SWISS_SIZES.join(' or ')} players.
                                        </p>
                                    )}
                                </div>
                                <div className={classes.field}>
                                    <span className={classes.label}>Bracket preview</span>
                                    <TournamentFormatPreview
                                        type={tournamentType}
                                        maxPlayers={previewMaxPlayers}
                                        loserBracket={isKickOff && loserBracket}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className={classes.section}>
                        <h3 className={classes.sectionTitle}>Prizes &amp; format</h3>
                        <div className={classes.grid}>
                            <div className={classes.field}>
                                <label className={classes.label} htmlFor="tournamentFundingGoalUsd">
                                    Prize pool goal (USD)
                                </label>
                                <input
                                    id="tournamentFundingGoalUsd"
                                    className={`${classes.input} ${fundingGoalInvalid ? classes.inputError : ''}`}
                                    type="number"
                                    min={MIN_HOST_SEED_USD}
                                    step="1"
                                    value={fundingGoalUsd}
                                    onChange={handleFundingGoalChange}
                                    placeholder={`e.g. ${DEFAULT_FUNDING_GOAL_USD}`}
                                />
                                <p className={classes.fieldHint}>
                                    You pay this at creation. {Math.round(HOST_SEED_POOL_SHARE * 100)}% (
                                    {formatFundingUsd(getHostSeedPoolPreview(parsedFundingGoal || 0))}) goes to the
                                    pool. Winners paid 60% / 30% / 10% when the cup ends.
                                </p>
                            </div>
                            <div className={classes.field}>
                                <label className={classes.label} htmlFor="tournamentAttendanceFeeUsd">
                                    Self-registration fee (USD)
                                </label>
                                <input
                                    id="tournamentAttendanceFeeUsd"
                                    className={`${classes.input} ${attendanceFeeInvalid ? classes.inputError : ''}`}
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={attendanceFeeUsd}
                                    onChange={handleAttendanceFeeChange}
                                    placeholder="0 = free"
                                />
                                <p className={classes.fieldHint}>
                                    Paid by players who register themselves. 100% goes to this cup&apos;s prize pool.
                                    Admins can still add players for free.
                                </p>
                            </div>
                            <div className={classes.field}>
                                <label className={classes.label} htmlFor="tournamentPlayoffGames">
                                    {isAnyChampionsLeague
                                        ? 'Group stage match type'
                                        : isScheduleFormat
                                          ? 'Match type'
                                          : 'Playoff games'}
                                </label>
                                <select
                                    id="tournamentPlayoffGames"
                                    className={classes.select}
                                    defaultValue="1"
                                    ref={tournamentPlayoffGames}
                                >
                                    {(isLeague || isAnyChampionsLeague
                                        ? leagueGameCountOptions
                                        : playoffGameCountOptions
                                    ).map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                {isAnyChampionsLeague && (
                                    <p className={classes.fieldHint}>
                                        Group stage only. Knockout rounds use the settings below.
                                    </p>
                                )}
                            </div>
                            <div className={`${classes.field} ${showKnockoutMatchType ? '' : classes.hidden}`}>
                                <label className={classes.label} htmlFor="tournamentPlayoffGamesKnockout">
                                    Knockout match type
                                </label>
                                <select
                                    id="tournamentPlayoffGamesKnockout"
                                    className={classes.select}
                                    defaultValue="1"
                                    ref={tournamentPlayoffGamesKnockout}
                                >
                                    {knockoutGameCountOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className={`${classes.field} ${showFinalAndThirdPlace ? '' : classes.hidden}`}>
                                <label className={classes.label} htmlFor="tournamentPlayoffGamesFinal">
                                    {isAnyChampionsLeague ? 'Final match type' : 'Final games'}
                                </label>
                                <select
                                    id="tournamentPlayoffGamesFinal"
                                    className={classes.select}
                                    defaultValue="1"
                                    ref={tournamentPlayoffGamesFinal}
                                >
                                    {(isChampionsLeague ? knockoutGameCountOptions : playoffGameCountOptions).map(
                                        (option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>
                            <div
                                className={`${classes.field} ${
                                    showFinalAndThirdPlace && !(isKickOff && loserBracket) ? '' : classes.hidden
                                }`}
                            >
                                <label className={classes.label} htmlFor="tournamentPlayoffGamesThirdPlace">
                                    {isAnyChampionsLeague ? 'Third place match type' : 'Third place games'}
                                </label>
                                <select
                                    id="tournamentPlayoffGamesThirdPlace"
                                    className={classes.select}
                                    defaultValue="1"
                                    ref={tournamentPlayoffGamesThirdPlace}
                                >
                                    {(isChampionsLeague ? knockoutGameCountOptions : playoffGameCountOptions).map(
                                        (option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>
                            <div
                                className={`${classes.field} ${isKickOff ? classes.bracketFieldKickoff : ''} ${
                                    showBracketOptions ? '' : classes.hidden
                                }`}
                            >
                                <span className={classes.label}>{isAnyChampionsLeague ? 'Group draw' : 'Bracket'}</span>
                                <label className={classes.checkLabel} htmlFor="randomBracket">
                                    <input type="checkbox" id="randomBracket" ref={randomBracketRef} defaultChecked />
                                    {isAnyChampionsLeague
                                        ? 'Spinning wheel (group draw)'
                                        : 'Spinning wheel (random bracket)'}
                                </label>
                                {isAnyChampionsLeague && (
                                    <p className={classes.fieldHint}>
                                        Optional. When enabled, the admin draws groups with the wheel before the group
                                        stage. When off, groups are shuffled automatically.
                                    </p>
                                )}
                                {isKickOff && (
                                    <label className={classes.checkLabel} htmlFor="loserBracket">
                                        <input
                                            type="checkbox"
                                            id="loserBracket"
                                            checked={loserBracket}
                                            onChange={(event) => setLoserBracket(event.target.checked)}
                                        />
                                        Loser bracket (double elimination)
                                    </label>
                                )}
                                {isKickOff && (
                                    <p
                                        className={`${classes.fieldHint} ${classes.bracketHintSlot} ${
                                            loserBracket ? '' : classes.bracketHintHidden
                                        }`}
                                    >
                                        Double elimination for {DOUBLE_ELIM_SIZES.join(', ')} players. Losers get a
                                        second chance via the lower bracket; grand final decides the champion.
                                    </p>
                                )}
                                {loserBracketSizeInvalid && (
                                    <p className={classes.fieldError}>
                                        Loser bracket requires max players: {DOUBLE_ELIM_SIZES.join(', ')}.
                                    </p>
                                )}
                            </div>
                            <div className={classes.field}>
                                <span className={classes.label}>Castle picks</span>
                                <label className={classes.checkLabel} htmlFor="strictCastlePick">
                                    <input
                                        type="checkbox"
                                        id="strictCastlePick"
                                        checked={strictCastlePick}
                                        onChange={(event) => setStrictCastlePick(event.target.checked)}
                                    />
                                    Strict castle pick
                                </label>
                                <p className={classes.fieldHint}>
                                    When enabled, admins can open the Available Castles panel in the bracket and players
                                    see castle availability colors while reporting games (11/12 rule).
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className={classes.section}>
                        <h3 className={classes.sectionTitle}>Visibility</h3>
                        <div className={classes.visibilityPanel}>
                            <label className={classes.checkLabel} htmlFor="tournamentPublic">
                                <input
                                    type="checkbox"
                                    id="tournamentPublic"
                                    checked={isPublicTournament}
                                    onChange={(event) => setIsPublicTournament(event.target.checked)}
                                />
                                Public tournament
                            </label>
                            <p className={classes.visibilityHint}>
                                {isPublicTournament
                                    ? 'Visible on the site and announced in Telegram @vkgamingplay.'
                                    : 'Private draft — only admins see it; no Telegram announcement.'}
                            </p>
                        </div>
                    </section>

                    <div className={classes.actions}>
                        <button
                            type="button"
                            className={classes.primaryBtn}
                            onClick={handleSave}
                            disabled={isSaving || !canCreateTournament}
                        >
                            {isSaving ? 'Creating…' : 'Create tournament'}
                        </button>
                        <button
                            type="button"
                            className={classes.secondaryBtn}
                            onClick={props.onClose}
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default Bracket;
