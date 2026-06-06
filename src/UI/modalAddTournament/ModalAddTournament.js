import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import { authFetch } from '../../api/authFetch';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { determineTournamentPrizes, lookForUserId } from '../../api/api';
import { addCoins, deductCoins, getCoinBalance } from '../../api/coinTransactions';
import Modal from '../Modal/Modal';
import classes from './ModalAddTournament.module.css';
import { shuffleArray, setStageLabels } from '../../components/tournaments/tournament_api';
import {
    createDoubleElimPlayoffPairs,
    DOUBLE_ELIM_SIZES,
    getDoubleElimStageLabels,
    isDoubleElimSize
} from '../../components/tournaments/homm3/loserBracketUtils';
import AuthContext from '../../store/auth-context';
import { getFirebaseUid } from '../../api/authFetch';
import { MIN_SWISS_PLAYERS } from '../../components/tournaments/homm3/swissUtils';
import {
    CHAMPIONS_LEAGUE_GROUP_SIZE,
    CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP,
    CHAMPIONS_LEAGUE_SIZES,
    isChampionsLeagueSize
} from '../../components/tournaments/homm3/championsLeagueUtils';

const MIN_PRIZE_POOL_COINS = 5;
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

const splitCoinPrizes = (total) =>
    Object.fromEntries(
        Object.entries(determineTournamentPrizes(total)).map(([place, amount]) => [place, Math.round(Number(amount))])
    );

const Bracket = (props) => {
    const [isSaving, setIsSaving] = useState(false);
    const [date, setDate] = useState(getDefaultTournamentDate);
    const [tournamentName, setTournamentName] = useState('');
    const [maxPlayers, setMaxPlayers] = useState('');
    const [tournamentType, setTournamentType] = useState('kick-off');
    const [isPublicTournament, setIsPublicTournament] = useState(true);
    const [loserBracket, setLoserBracket] = useState(false);
    const [coinBalance, setCoinBalance] = useState(
        () => (props.initialCoinBalance != null ? props.initialCoinBalance : null)
    );
    const [prizePoolCoins, setPrizePoolCoins] = useState('');
    const authCtx = useContext(AuthContext);
    const isLeague = tournamentType === 'league';
    const isSwiss = tournamentType === 'swiss';
    const isChampionsLeague = tournamentType === 'champions-league';
    const isKickOff = tournamentType === 'kick-off';
    const isScheduleFormat = isLeague || isSwiss || isChampionsLeague;
    const maxPrizePoolCoins =
        !authCtx.isAdmin && coinBalance != null ? Math.max(0, Number(coinBalance) || 0) : null;
    const parsedPrizePool = Number(prizePoolCoins);
    const prizePoolExceedsBalance =
        maxPrizePoolCoins != null &&
        prizePoolCoins !== '' &&
        Number.isFinite(parsedPrizePool) &&
        parsedPrizePool > maxPrizePoolCoins;
    const prizePoolBelowMin =
        prizePoolCoins !== '' &&
        (!Number.isFinite(parsedPrizePool) || parsedPrizePool < MIN_PRIZE_POOL_COINS);
    const hasValidPrizeAmount =
        prizePoolCoins !== '' &&
        Number.isFinite(parsedPrizePool) &&
        parsedPrizePool >= MIN_PRIZE_POOL_COINS;
    const isPrizePoolValid = authCtx.isAdmin
        ? hasValidPrizeAmount
        : hasValidPrizeAmount &&
          maxPrizePoolCoins != null &&
          parsedPrizePool <= maxPrizePoolCoins;
    const minPlayersRequired = isSwiss
        ? MIN_SWISS_PLAYERS
        : isChampionsLeague
          ? CHAMPIONS_LEAGUE_SIZES[0]
          : MIN_TOURNAMENT_PLAYERS;
    const parsedMaxPlayers = Number(maxPlayers);
    const maxPlayersBelowMin =
        maxPlayers !== '' &&
        Number.isFinite(parsedMaxPlayers) &&
        parsedMaxPlayers < minPlayersRequired;
    const championsLeagueSizeInvalid =
        isChampionsLeague &&
        maxPlayers !== '' &&
        Number.isFinite(parsedMaxPlayers) &&
        !isChampionsLeagueSize(parsedMaxPlayers);
    const isMaxPlayersValid =
        maxPlayers !== '' &&
        Number.isFinite(parsedMaxPlayers) &&
        parsedMaxPlayers >= minPlayersRequired &&
        (!isChampionsLeague || isChampionsLeagueSize(parsedMaxPlayers));
    const loserBracketSizeInvalid =
        loserBracket &&
        maxPlayers !== '' &&
        Number.isFinite(parsedMaxPlayers) &&
        !isDoubleElimSize(parsedMaxPlayers);
    const canCreateTournament =
        isPrizePoolValid &&
        isMaxPlayersValid &&
        tournamentName.trim() !== '' &&
        !loserBracketSizeInvalid &&
        !championsLeagueSizeInvalid;

    const tournamentTypeOptions = [
        { value: 'kick-off', label: 'Kick-off' },
        { value: 'league', label: 'League (Round-Robin)' },
        { value: 'swiss', label: 'Swiss System' },
        { value: 'champions-league', label: 'Champions League (Groups + Knockout)' }
    ];
    const championsLeaguePlayerOptions = CHAMPIONS_LEAGUE_SIZES.map((size) => ({
        value: String(size),
        label: `${size} players (${size / CHAMPIONS_LEAGUE_GROUP_SIZE} groups × ${CHAMPIONS_LEAGUE_GROUP_SIZE}, top ${CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP} advance)`
    }));
    const championsLeagueMaxPlayers =
        maxPlayers !== '' && isChampionsLeagueSize(parsedMaxPlayers)
            ? String(parsedMaxPlayers)
            : String(CHAMPIONS_LEAGUE_SIZES[0]);

    const handleTournamentTypeChange = (event) => {
        const nextType = event.target.value;
        setTournamentType(nextType);

        if (nextType === 'champions-league' && !isChampionsLeagueSize(parsedMaxPlayers)) {
            setMaxPlayers(String(CHAMPIONS_LEAGUE_SIZES[0]));
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

    useEffect(() => {
        if (props.initialCoinBalance != null || authCtx.isAdmin || !authCtx.userNickName) {
            return;
        }

        let cancelled = false;

        const loadBalance = async () => {
            try {
                const userId = await lookForUserId(authCtx.userNickName);
                const balance = await getCoinBalance(userId);
                if (!cancelled) {
                    setCoinBalance(balance);
                }
            } catch (error) {
                console.error('Failed to load coin balance:', error);
                if (!cancelled) {
                    setCoinBalance(0);
                }
            }
        };

        loadBalance();

        return () => {
            cancelled = true;
        };
    }, [authCtx.isAdmin, authCtx.userNickName, props.initialCoinBalance]);

    const tournamentPlayoffGames = useRef(null);
    const tournamentPlayoffGamesFinal = useRef(null);
    const tournamentPlayoffGamesThirdPlace = useRef(null);
    const randomBracketRef = useRef(null);

    const handlePrizePoolChange = (event) => {
        const rawValue = event.target.value;

        if (rawValue === '') {
            setPrizePoolCoins('');
            return;
        }

        setPrizePoolCoins(rawValue);
    };

    const handleSave = async () => {
        const name = tournamentName.trim();
        const maxPlayersCount = Number(maxPlayers);
        const coinPrizePool = parsedPrizePool;

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

        if (isChampionsLeague && !isChampionsLeagueSize(maxPlayersCount)) {
            authCtx.setNotificationShown(
                true,
                `Champions League requires exactly ${CHAMPIONS_LEAGUE_SIZES.join(', ')} players (${CHAMPIONS_LEAGUE_GROUP_SIZE} per group).`,
                'warning',
                6
            );
            return;
        }

        if (!Number.isFinite(maxPlayersCount) || maxPlayersCount < minPlayersRequired) {
            authCtx.setNotificationShown(
                true,
                isSwiss
                    ? `Swiss tournaments need at least ${MIN_SWISS_PLAYERS} players.`
                    : isChampionsLeague
                      ? `Champions League requires ${CHAMPIONS_LEAGUE_SIZES.join(', ')} players.`
                      : 'Max players must be at least 2.',
                'warning',
                5
            );
            return;
        }

        if (!Number.isFinite(coinPrizePool) || coinPrizePool < MIN_PRIZE_POOL_COINS) {
            authCtx.setNotificationShown(
                true,
                `Prize pool must be at least ${MIN_PRIZE_POOL_COINS} coins.`,
                'warning',
                5
            );
            return;
        }

        if (!authCtx.isAdmin && maxPrizePoolCoins != null && coinPrizePool > maxPrizePoolCoins) {
            authCtx.setNotificationShown(
                true,
                `Prize pool cannot exceed your balance (${maxPrizePoolCoins} coins).`,
                'error',
                5
            );
            return;
        }

        const coinPrizePull = splitCoinPrizes(coinPrizePool);
        let userId = null;
        let prizePoolDeducted = false;

        if (!authCtx.isAdmin) {
            try {
                userId = await lookForUserId(authCtx.userNickName);
                const balance = await getCoinBalance(userId);

                if (balance < coinPrizePool) {
                    authCtx.setNotificationShown(
                        true,
                        `Not enough coins. You have ${balance}, but the prize pool is ${coinPrizePool}.`,
                        'error',
                        6
                    );
                    return;
                }

                const deductResult = await deductCoins(
                    userId,
                    coinPrizePool,
                    'tournament_prize_pool',
                    `Prize pool for tournament: ${name}`,
                    { tournamentName: name, prizePoolCoins: coinPrizePool }
                );

                if (!deductResult.success) {
                    authCtx.setNotificationShown(
                        true,
                        deductResult.error || 'Could not deduct coins from your balance.',
                        'error',
                        5
                    );
                    return;
                }

                prizePoolDeducted = true;
                setCoinBalance(deductResult.newBalance);
            } catch (error) {
                console.error('Prize pool deduction failed:', error);
                authCtx.setNotificationShown(true, 'Could not verify your coin balance.', 'error', 5);
                return;
            }
        }

        const objTournament = {
            name,
            type: tournamentType,
            maxPlayers: maxPlayersCount,
            pricePull: coinPrizePull,
            coinPrizePull,
            prizeType: 'coins',
            totalPrizeUsd: 0,
            totalPrizeCoins: coinPrizePool,
            date,
            tournamentPlayoffGames: tournamentPlayoffGames.current.value,
            tournamentPlayoffGamesFinal: tournamentPlayoffGamesFinal.current.value,
            tournamentPlayoffGamesThirdPlace: tournamentPlayoffGamesThirdPlace.current.value,
            randomBracket: isScheduleFormat ? false : randomBracketRef.current.checked,
            loserBracket: isKickOff && loserBracket,
            championsLeaguePhase: isChampionsLeague ? 'group' : null,
            groupSize: isChampionsLeague ? CHAMPIONS_LEAGUE_GROUP_SIZE : null,
            qualifiersPerGroup: isChampionsLeague ? CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP : null,
            isPublic: isPublicTournament,
            createdBy: authCtx.userNickName || null,
            createdByUid: getFirebaseUid(),
            status: isPublicTournament ? 'Registration Started' : 'Draft',
            players: 0,
            winners: {
                '1st place': 'TBD',
                '2nd place': 'TBD',
                '3rd place': 'TBD'
            }
        };

        if (!isScheduleFormat && randomBracketRef.current.checked) {
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

            authCtx.setNotificationShown(
                true,
                authCtx.isAdmin
                    ? `Tournament "${name}" created.`
                    : `Tournament created. ${coinPrizePool} coins deducted from your balance.`,
                'success',
                5
            );

            props.onClose();
            window.location.href = '/tournaments/homm3';
        } catch (error) {
            console.error('Error creating tournament:', error);

            if (prizePoolDeducted && userId) {
                await addCoins(
                    userId,
                    coinPrizePool,
                    'tournament_prize_pool_refund',
                    `Refund — tournament creation failed: ${name}`,
                    { tournamentName: name, prizePoolCoins: coinPrizePool }
                );
            }

            authCtx.setNotificationShown(true, 'Failed to create tournament. Coins were refunded.', 'error', 6);
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
                        Prize pool is paid in coins from your balance. Public cups are announced in Telegram.
                    </p>
                </header>

                <div className={classes.body}>
                        {!authCtx.isAdmin && coinBalance != null && (
                            <p className={classes.balanceBanner}>
                                Your balance: <strong>{coinBalance} coins</strong>
                            </p>
                        )}

                        {prizePoolExceedsBalance && (
                            <p className={classes.exceededBanner} role="alert">
                                Prize pool exceeds your balance. Maximum allowed:{' '}
                                <strong>{maxPrizePoolCoins} coins</strong> (you entered {parsedPrizePool}).
                            </p>
                        )}

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
                                    {isChampionsLeague && (
                                        <p className={classes.fieldHint}>
                                            Groups of {CHAMPIONS_LEAGUE_GROUP_SIZE}, top {CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP}{' '}
                                            advance. Requires exactly {CHAMPIONS_LEAGUE_SIZES.join(', ')} players.
                                        </p>
                                    )}
                                </div>
                                <div className={classes.field}>
                                    <label className={classes.label} htmlFor="tournamentDate">
                                        Start date
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
                                <div className={classes.field}>
                                    <label className={classes.label} htmlFor="tournamentPlayers">
                                        Max players
                                    </label>
                                    {isChampionsLeague ? (
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
                                    ) : (
                                        <input
                                            id="tournamentPlayers"
                                            className={`${classes.input} ${
                                                maxPlayersBelowMin ? classes.inputError : ''
                                            }`}
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
                                    {isChampionsLeague && (
                                        <p className={classes.fieldHint}>
                                            Must register exactly {championsLeagueMaxPlayers} players — no more, no
                                            less.
                                        </p>
                                    )}
                                    {!isChampionsLeague && maxPlayersBelowMin && (
                                        <p className={classes.fieldError}>
                                            {isSwiss
                                                ? `Swiss tournaments need at least ${MIN_SWISS_PLAYERS} max players.`
                                                : 'Max players must be at least 2.'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className={classes.section}>
                            <h3 className={classes.sectionTitle}>Prizes &amp; format</h3>
                            <div className={classes.grid}>
                                <div className={classes.field}>
                                    <label className={classes.label} htmlFor="tournamentPricePoolCoins">
                                        Prize pool (coins)
                                    </label>
                                    <input
                                        id="tournamentPricePoolCoins"
                                        className={`${classes.input} ${
                                            prizePoolExceedsBalance || prizePoolBelowMin ? classes.inputError : ''
                                        }`}
                                        type="number"
                                        min={MIN_PRIZE_POOL_COINS}
                                        step="1"
                                        value={prizePoolCoins}
                                        onChange={handlePrizePoolChange}
                                        placeholder={`Min ${MIN_PRIZE_POOL_COINS}${
                                            maxPrizePoolCoins != null ? `, max ${maxPrizePoolCoins}` : ''
                                        }`}
                                    />
                                    <p className={classes.fieldHint}>
                                        {authCtx.isAdmin
                                            ? 'Admins are not charged — pool is for display and payouts only.'
                                            : maxPrizePoolCoins != null
                                              ? `Deducted from your balance (max ${maxPrizePoolCoins} coins). Split 60% / 30% / 10%.`
                                              : 'Deducted from your balance when you create the cup (60% / 30% / 10%).'}
                                    </p>
                                </div>
                                <div className={classes.field}>
                                    <label className={classes.label} htmlFor="tournamentPlayoffGames">
                                        {isScheduleFormat ? 'Match type' : 'Playoff games'}
                                    </label>
                                    <select
                                        id="tournamentPlayoffGames"
                                        className={classes.select}
                                        defaultValue="1"
                                        ref={tournamentPlayoffGames}
                                    >
                                        {(isLeague ? leagueGameCountOptions : playoffGameCountOptions).map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className={`${classes.field} ${isScheduleFormat ? classes.hidden : ''}`}>
                                    <label className={classes.label} htmlFor="tournamentPlayoffGamesFinal">
                                        Final games
                                    </label>
                                    <select
                                        id="tournamentPlayoffGamesFinal"
                                        className={classes.select}
                                        defaultValue="1"
                                        ref={tournamentPlayoffGamesFinal}
                                    >
                                        {playoffGameCountOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div
                                    className={`${classes.field} ${
                                        isScheduleFormat || loserBracket ? classes.hidden : ''
                                    }`}
                                >
                                    <label className={classes.label} htmlFor="tournamentPlayoffGamesThirdPlace">
                                        Third place games
                                    </label>
                                    <select
                                        id="tournamentPlayoffGamesThirdPlace"
                                        className={classes.select}
                                        defaultValue="1"
                                        ref={tournamentPlayoffGamesThirdPlace}
                                    >
                                        {playoffGameCountOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className={`${classes.field} ${isScheduleFormat ? classes.hidden : ''}`}>
                                    <span className={classes.label}>Bracket</span>
                                    <label className={classes.checkLabel} htmlFor="randomBracket">
                                        <input
                                            type="checkbox"
                                            id="randomBracket"
                                            ref={randomBracketRef}
                                            defaultChecked
                                        />
                                        Spinning wheel (random bracket)
                                    </label>
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
                                    {loserBracket && (
                                        <p className={classes.fieldHint}>
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
                            <button type="button" className={classes.secondaryBtn} onClick={props.onClose} disabled={isSaving}>
                                Cancel
                            </button>
                        </div>
                </div>
            </div>
        </Modal>
    );
};

export default Bracket;
