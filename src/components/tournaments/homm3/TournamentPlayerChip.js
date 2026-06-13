import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAvatar, loadUserById, lookForUserId } from '../../../api/api';
import { deriveHotaPlayerSummary, fetchHotaPlayerByLobbyNickname } from '../../../api/hotaMeta';
import CountryFlag from '../../Country/CountryFlag';
import StarsComponent from '../../Stars/Stars';
import { resolveCountryCode } from '../../../utils/country';
import classes from './TournamentPlayerChip.module.css';

const TournamentPlayerChip = ({ player, canKick = false, onKick, kicking = false }) => {
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [countryCode, setCountryCode] = useState(player?.countryCode || null);
    const [siteUserId, setSiteUserId] = useState(player?.siteUserId || null);
    const [eloDisplay, setEloDisplay] = useState(null);

    useEffect(() => {
        let cancelled = false;

        const konoplayRating =
            player?.ratings != null && player.ratings !== '' ? String(player.ratings) : null;

        const setKonoplayFallback = () => {
            if (konoplayRating) {
                setEloDisplay({ value: konoplayRating, label: 'ELO' });
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
    }, [player?.name, player?.ratings]);

    useEffect(() => {
        let cancelled = false;

        const enrichPlayer = async () => {
            let userId = player?.siteUserId || null;
            let code = player?.countryCode || null;

            if (!userId && player?.name) {
                userId = await lookForUserId(player.name);
            }

            if (!userId || cancelled) {
                return;
            }

            setSiteUserId(userId);

            if (!code) {
                const userData = await loadUserById(userId);
                code = resolveCountryCode(userData);
                if (!cancelled && code) {
                    setCountryCode(code);
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
    }, [player?.siteUserId, player?.countryCode, player?.name]);

    if (!player?.name) {
        return null;
    }

    const stars = Number(player.stars) || 0;

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
                    <span className={classes.name}>{player.name}</span>
                </div>
                <div className={classes.strengthRow}>
                    {stars > 0 ? (
                        <StarsComponent stars={stars} />
                    ) : (
                        <span className={classes.noStars}>Unrated</span>
                    )}
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
