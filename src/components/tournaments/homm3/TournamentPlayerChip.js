import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    computeSiteStarsFromRank,
    fetchLeaderboard,
    getAvatar,
    loadUserById,
    lookForUserId
} from '../../../api/api';
import { deriveHotaPlayerSummary, fetchHotaPlayerByLobbyNickname } from '../../../api/hotaMeta';
import CountryFlag from '../../Country/CountryFlag';
import AuthProviderIcon from '../../Auth/AuthProviderIcon';
import StarsComponent from '../../Stars/Stars';
import { resolveCountryCode } from '../../../utils/country';
import { resolveAuthProvider } from '../../../utils/authProvider';
import classes from './TournamentPlayerChip.module.css';

/** Ratings/stars are often stored as "a, b, c" history — use the latest value. */
const parseLatestNumeric = (value) => {
    if (value == null || value === '') {
        return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    const raw = String(value).split(',').pop().trim();
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
};

const TournamentPlayerChip = ({ player, canKick = false, onKick, kicking = false }) => {
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [countryCode, setCountryCode] = useState(player?.countryCode || null);
    const [authProvider, setAuthProvider] = useState(null);
    const [siteUserId, setSiteUserId] = useState(player?.siteUserId || null);
    const [eloDisplay, setEloDisplay] = useState(null);
    const [resolvedStars, setResolvedStars] = useState(() => parseLatestNumeric(player?.stars) || 0);
    const [dbEloFallback, setDbEloFallback] = useState(null);

    useEffect(() => {
        setResolvedStars(parseLatestNumeric(player?.stars) || 0);
    }, [player?.stars]);

    useEffect(() => {
        let cancelled = false;

        const rosterElo = parseLatestNumeric(player?.ratings);

        const setKonoplayFallback = (overrideElo = null) => {
            const value = overrideElo ?? dbEloFallback ?? rosterElo;
            if (value != null) {
                setEloDisplay({ value: Number(value).toFixed(2), label: 'ELO' });
            } else {
                setEloDisplay(null);
            }
        };

        const loadRating = async () => {
            setEloDisplay(null);

            if (!player?.name) {
                return;
            }

            try {
                const result = await fetchHotaPlayerByLobbyNickname(player.name);
                if (cancelled) {
                    return;
                }

                if (result.status === 'ok') {
                    const summary = deriveHotaPlayerSummary(result.profile);
                    if (summary?.rating != null && Number.isFinite(Number(summary.rating))) {
                        setEloDisplay({
                            value: Number(summary.rating).toFixed(0),
                            label: 'HotA ELO'
                        });
                        return;
                    }
                }

                setKonoplayFallback();
            } catch {
                if (!cancelled) {
                    setKonoplayFallback();
                }
            }
        };

        loadRating();

        return () => {
            cancelled = true;
        };
    }, [player?.name, player?.ratings, dbEloFallback]);

    useEffect(() => {
        let cancelled = false;

        const enrichPlayer = async () => {
            let userId = player?.siteUserId || null;
            let code = player?.countryCode || null;

            // Exact lobby nickname → users.enteredNickname
            if (!userId && player?.name) {
                userId = await lookForUserId(player.name);
            }

            if (!userId || cancelled) {
                return;
            }

            setSiteUserId(userId);

            const userData = await loadUserById(userId);
            if (cancelled || !userData) {
                return;
            }

            if (!code) {
                code = resolveCountryCode(userData);
                if (code) {
                    setCountryCode(code);
                }
            }

            setAuthProvider(resolveAuthProvider(userData));

            // Bandage: roster stars often stale/0 — pull live stars (or rank-based) from DB user
            const rosterStars = parseLatestNumeric(player?.stars) || 0;
            let stars = parseLatestNumeric(userData.stars) || 0;

            if (stars <= 0) {
                try {
                    const rank = await fetchLeaderboard(userData);
                    if (!cancelled && rank != null) {
                        stars = computeSiteStarsFromRank(rank) || 0;
                    }
                } catch {
                    // Rank lookup is best-effort.
                }
            }

            if (!cancelled) {
                if (rosterStars <= 0 && stars > 0) {
                    setResolvedStars(stars);
                } else if (rosterStars > 0) {
                    setResolvedStars(rosterStars);
                }

                const latestDbElo = parseLatestNumeric(userData.ratings);
                if (latestDbElo != null) {
                    setDbEloFallback(latestDbElo);
                }
            }

            try {
                const avatar = await getAvatar(userId);
                if (!cancelled && avatar) {
                    setAvatarUrl(avatar);
                }
            } catch {
                // Avatar is optional.
            }
        };

        enrichPlayer();

        return () => {
            cancelled = true;
        };
    }, [player?.siteUserId, player?.countryCode, player?.name, player?.stars]);

    if (!player?.name) {
        return null;
    }

    const stars = resolvedStars > 0 ? resolvedStars : 0;

    const body = (
        <>
            {avatarUrl ? (
                <img src={avatarUrl} alt="" className={classes.avatar} />
            ) : (
                <div className={classes.avatarFallback} aria-hidden="true">
                    {player.name.charAt(0).toUpperCase()}
                </div>
            )}
            <div className={classes.meta}>
                <div className={classes.nameRow}>
                    <CountryFlag code={countryCode} size={14} />
                    <AuthProviderIcon provider={authProvider} size={12} />
                    <span className={classes.name}>{player.name}</span>
                </div>
                <div className={classes.strengthRow}>
                    {stars > 0 ? <StarsComponent stars={stars} /> : <span className={classes.noStars}>Unrated</span>}
                    {eloDisplay != null && (
                        <span className={classes.rating}>
                            {eloDisplay.value} {eloDisplay.label}
                        </span>
                    )}
                </div>
            </div>
        </>
    );

    const showKick = canKick && typeof onKick === 'function';

    const kickButton = showKick ? (
        <button
            type="button"
            className={classes.kickBtn}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onKick();
            }}
            disabled={kicking}
            aria-label={`Remove ${player.name} from tournament`}
            title="Remove player"
        >
            ×
        </button>
    ) : null;

    const profile = siteUserId ? (
        <Link to={`/players/${siteUserId}`} className={classes.profileLink}>
            {body}
        </Link>
    ) : (
        <div className={classes.profileLink}>{body}</div>
    );

    return (
        <li className={classes.chip}>
            <div className={classes.row}>
                {profile}
                {kickButton}
            </div>
        </li>
    );
};

export default TournamentPlayerChip;
