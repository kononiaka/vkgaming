import { useCallback, useEffect, useState } from 'react';
import {
    createTelegramLinkToken,
    loadTelegramFollowedPlayers,
    loadTelegramLinkState,
    loadTelegramNotificationPrefs,
    saveTelegramFollowedPlayers,
    saveTelegramNotificationPrefs,
    unlinkTelegramBot
} from '../../api/telegramBot';
import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import {
    TELEGRAM_BOT_USERNAME,
    TELEGRAM_NOTIFICATION_PREF_OPTIONS,
    collectFollowablePlayers,
    mergeTelegramNotificationPrefs
} from '../../utils/telegramNotificationPrefs';
import classes from './TelegramNotificationsSection.module.css';

const TelegramNotificationsSection = ({ userId, authCtx }) => {
    const [loading, setLoading] = useState(true);
    const [linkState, setLinkState] = useState({ linked: false, telegramUsername: null });
    const [prefs, setPrefs] = useState(mergeTelegramNotificationPrefs(null));
    const [followedPlayers, setFollowedPlayers] = useState({});
    const [followGroups, setFollowGroups] = useState([]);
    const [linkLoading, setLinkLoading] = useState(false);
    const [savingPrefs, setSavingPrefs] = useState(false);

    const refreshLinkState = useCallback(async () => {
        if (!userId) {
            return;
        }
        const state = await loadTelegramLinkState(userId);
        setLinkState(state);
    }, [userId]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const [state, storedPrefs, storedFollows, tournamentsResponse] = await Promise.all([
                    loadTelegramLinkState(userId),
                    loadTelegramNotificationPrefs(userId),
                    loadTelegramFollowedPlayers(userId),
                    fetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3.json`)
                ]);

                const tournaments = tournamentsResponse.ok ? await tournamentsResponse.json() : {};

                if (!cancelled) {
                    setLinkState(state);
                    setPrefs(storedPrefs);
                    setFollowedPlayers(storedFollows);
                    setFollowGroups(collectFollowablePlayers(tournaments));
                }
            } catch (error) {
                console.error('Failed to load Telegram notification settings:', error);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [userId]);

    const persistPrefs = async (nextPrefs) => {
        setSavingPrefs(true);
        try {
            const saved = await saveTelegramNotificationPrefs(userId, nextPrefs);
            setPrefs(saved);
            authCtx.setNotificationShown(true, 'Telegram notification settings saved.', 'success', 3);
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Could not save settings.', 'error', 5);
        } finally {
            setSavingPrefs(false);
        }
    };

    const handlePrefToggle = (key) => {
        const nextPrefs = { ...prefs, [key]: !prefs[key] };
        setPrefs(nextPrefs);
        persistPrefs(nextPrefs);
    };

    const handleMasterToggle = () => {
        const nextPrefs = { ...prefs, enabled: !prefs.enabled };
        setPrefs(nextPrefs);
        persistPrefs(nextPrefs);
    };

    const handleFollowToggle = async (playerName) => {
        const nextFollows = { ...followedPlayers };
        if (nextFollows[playerName]) {
            delete nextFollows[playerName];
        } else {
            nextFollows[playerName] = true;
        }

        setFollowedPlayers(nextFollows);
        try {
            await saveTelegramFollowedPlayers(userId, nextFollows);
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Could not save followed players.', 'error', 5);
            setFollowedPlayers(followedPlayers);
        }
    };

    const handleConnect = async () => {
        setLinkLoading(true);
        try {
            const { botUrl } = await createTelegramLinkToken(userId);
            window.open(botUrl, '_blank', 'noopener,noreferrer');
            authCtx.setNotificationShown(
                true,
                'Telegram opened — tap Start in @konoplay_bot to finish linking.',
                'success',
                6
            );
            setTimeout(refreshLinkState, 4000);
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Could not start Telegram linking.', 'error', 5);
        } finally {
            setLinkLoading(false);
        }
    };

    const handleDisconnect = async () => {
        setLinkLoading(true);
        try {
            await unlinkTelegramBot(userId);
            await refreshLinkState();
            authCtx.setNotificationShown(true, 'Telegram bot disconnected.', 'success', 4);
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Could not disconnect bot.', 'error', 5);
        } finally {
            setLinkLoading(false);
        }
    };

    if (loading) {
        return (
            <div className={classes.panel}>
                <p className={classes.loading}>Loading Telegram settings…</p>
            </div>
        );
    }

    return (
        <div className={classes.panel}>
            <div className={classes.header}>
                <div>
                    <h4 className={classes.title}>Telegram bot notifications</h4>
                    <p className={classes.note}>
                        Link @{TELEGRAM_BOT_USERNAME} for personal DMs about your matches and players you follow.
                        The public channel @vkgamingplay still posts general digests.
                    </p>
                </div>
                <span className={`${classes.statusBadge} ${linkState.linked ? classes.statusLinked : ''}`}>
                    {linkState.linked ? 'Bot linked' : 'Bot not linked'}
                </span>
            </div>

            <div className={classes.linkRow}>
                {linkState.linked ? (
                    <>
                        <p className={classes.linkedLine}>
                            Connected
                            {linkState.telegramUsername ? ` as @${linkState.telegramUsername}` : ''}.
                        </p>
                        <button
                            type="button"
                            className={classes.secondaryBtn}
                            onClick={handleDisconnect}
                            disabled={linkLoading}
                        >
                            Disconnect
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        className={classes.primaryBtn}
                        onClick={handleConnect}
                        disabled={linkLoading}
                    >
                        {linkLoading ? 'Opening Telegram…' : `Connect @${TELEGRAM_BOT_USERNAME}`}
                    </button>
                )}
                {linkState.linked ? (
                    <button type="button" className={classes.refreshBtn} onClick={refreshLinkState}>
                        Refresh status
                    </button>
                ) : null}
            </div>

            <div className={classes.grid}>
                <section className={classes.section}>
                    <div className={classes.sectionHeader}>
                        <h5 className={classes.sectionTitle}>Personal notifications</h5>
                        <label className={classes.masterToggle}>
                            <input
                                type="checkbox"
                                checked={Boolean(prefs.enabled)}
                                onChange={handleMasterToggle}
                                disabled={savingPrefs || !linkState.linked}
                            />
                            <span>Enabled</span>
                        </label>
                    </div>
                    <div className={classes.prefList}>
                        {TELEGRAM_NOTIFICATION_PREF_OPTIONS.map((option) => (
                            <label key={option.key} className={classes.prefItem}>
                                <input
                                    type="checkbox"
                                    checked={Boolean(prefs[option.key])}
                                    onChange={() => handlePrefToggle(option.key)}
                                    disabled={savingPrefs || !prefs.enabled || !linkState.linked}
                                />
                                <span>{option.label}</span>
                            </label>
                        ))}
                    </div>
                    {!linkState.linked ? (
                        <p className={classes.hint}>Connect the bot first to enable personal notifications.</p>
                    ) : null}
                </section>

                <section className={classes.section}>
                    <h5 className={classes.sectionTitle}>Players you follow</h5>
                    <p className={classes.sectionNote}>
                        Get updates when followed players are scheduled, go live, or finish a match.
                    </p>
                    {followGroups.length === 0 ? (
                        <p className={classes.empty}>No active public tournaments with players right now.</p>
                    ) : (
                        <div className={classes.followGroups}>
                            {followGroups.map((group) => (
                                <div key={group.tournamentId} className={classes.followGroup}>
                                    <p className={classes.followGroupTitle}>{group.tournamentName}</p>
                                    <div className={classes.followList}>
                                        {group.players.map((playerName) => (
                                            <label key={playerName} className={classes.followItem}>
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(followedPlayers[playerName])}
                                                    onChange={() => handleFollowToggle(playerName)}
                                                    disabled={!linkState.linked}
                                                />
                                                <span>{playerName}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default TelegramNotificationsSection;
