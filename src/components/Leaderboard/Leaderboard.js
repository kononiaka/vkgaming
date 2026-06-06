import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import { useContext, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    SITE_STARS_MAX,
    SITE_STARS_MIN,
    SITE_STARS_TOP50_MIN,
    applySiteStarsFromRank,
    calculateStarsFromRating,
    getAvatar,
    getKonoplayLatestRating
} from '../../api/api';
import {
    deriveHotaPlayerSummary,
    fetchHotaLeaderboard,
    fetchHotaPlayerByLobbyNickname,
    getHotaPlayerUrl
} from '../../api/hotaMeta';
import AuthContext from '../../store/auth-context';
import StarsComponent from '../Stars/Stars';
import CountryFlag from '../Country/CountryFlag';
import { resolveCountryCode } from '../../utils/country';
import classes from './Leaderboard.module.css';

const HOTA_FETCH_LIMIT = 500;
const TOP_TABLE_COUNT = 50;

const buildKonoplayIndex = (usersData) => {
    const byNickname = {};

    Object.entries(usersData || {}).forEach(([id, user]) => {
        if (!user?.enteredNickname) {
            return;
        }

        byNickname[user.enteredNickname.toLowerCase()] = {
            id,
            enteredNickname: user.enteredNickname,
            countryCode: resolveCountryCode(user),
            stars: user.stars,
            ratings: user.ratings,
            games: user.gamesPlayed?.heroes3?.total ?? 0,
            previousRank: user.previousRank || null,
            previousRankTimestamp: user.previousRankTimestamp || null
        };
    });

    return byNickname;
};

const buildKonoplayLeaderboard = (usersData) =>
    Object.entries(usersData || {})
        .map(([id, user]) => {
            const ratings = getKonoplayLatestRating(user);
            const games = user.gamesPlayed?.heroes3?.total ?? 0;

            return {
                id,
                enteredNickname: user.enteredNickname,
                countryCode: resolveCountryCode(user),
                ratings,
                games,
                stars: user.stars,
                previousRank: user.previousRank || null,
                previousRankTimestamp: user.previousRankTimestamp || null
            };
        })
        .filter((player) => player.enteredNickname && player.ratings > 0)
        .sort((a, b) => b.ratings - a.ratings);

const applyKonoplayStars = (players) => {
    if (!players.length) {
        return [];
    }

    const highestRating = players[0].ratings;
    const lowestRating = Math.min(
        ...players.filter((player) => player.ratings > 0).map((player) => player.ratings)
    );

    return players.map((player) => ({
        ...player,
        stars: player.stars || calculateStarsFromRating(player.ratings, highestRating, lowestRating)
    }));
};

const enrichHotaLeaderboard = (hotaEntries, konoplayByNickname) =>
    hotaEntries.map((entry, index) => {
        const siteUser = konoplayByNickname[entry.username?.toLowerCase()] || null;

        return {
            rank: index + 1,
            rankLabel: String(index + 1),
            playerId: entry.player_id,
            username: entry.username,
            rating: entry.current_rating,
            peakRating: entry.peak_rating,
            games: entry.games,
            wins: entry.wins,
            winrate: entry.winrate,
            mainFaction: entry.main_faction_name,
            siteUserId: siteUser?.id || null,
            countryCode: siteUser?.countryCode || null,
            isRegistered: Boolean(siteUser)
        };
    });

const buildOffLeaderboardRegisteredPlayers = async (konoplayByNickname, hotaUsernames) => {
    const missingSiteUsers = Object.values(konoplayByNickname).filter(
        (siteUser) => !hotaUsernames.has(siteUser.enteredNickname.toLowerCase())
    );

    const resolved = await Promise.all(
        missingSiteUsers.map(async (siteUser) => {
            try {
                const result = await fetchHotaPlayerByLobbyNickname(siteUser.enteredNickname);
                if (result.status !== 'ok') {
                    return null;
                }

                const summary = deriveHotaPlayerSummary(result.profile);

                return {
                    rank: null,
                    rankLabel: `${HOTA_FETCH_LIMIT}+`,
                    playerId: result.playerId,
                    username: result.username,
                    rating: summary?.rating ?? null,
                    peakRating: summary?.peakRating ?? null,
                    games: summary?.totalGames ?? 0,
                    wins: summary?.wins ?? null,
                    winrate: summary?.winRate ?? null,
                    mainFaction: null,
                    siteUserId: siteUser.id,
                    countryCode: siteUser.countryCode || null,
                    isRegistered: true
                };
            } catch (error) {
                console.error(`Failed to resolve HotA profile for ${siteUser.enteredNickname}:`, error);
                return null;
            }
        })
    );

    return resolved.filter(Boolean);
};

const buildRegisteredBottomPlayers = (hotaPlayers, offLeaderboardPlayers) => {
    const fromLeaderboard = hotaPlayers.filter(
        (player) => player.isRegistered && player.rank > TOP_TABLE_COUNT
    );

    const combined = [...fromLeaderboard, ...offLeaderboardPlayers];

    return combined.sort((a, b) => {
        if (a.rank != null && b.rank != null) {
            return a.rank - b.rank;
        }
        if (a.rank != null) {
            return -1;
        }
        if (b.rank != null) {
            return 1;
        }
        return (b.rating || 0) - (a.rating || 0);
    });
};

const Leaderboard = () => {
    const authCtx = useContext(AuthContext);
    const [hotaPlayers, setHotaPlayers] = useState([]);
    const [registeredBottomPlayers, setRegisteredBottomPlayers] = useState([]);
    const [konoplayPlayers, setKonoplayPlayers] = useState([]);
    const [avatars, setAvatars] = useState({});
    const [lastRankSnapshot, setLastRankSnapshot] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [usingHota, setUsingHota] = useState(true);

    useEffect(() => {
        const loadLeaderboard = async () => {
            setLoading(true);
            setLoadError('');

            try {
                const usersResponse = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
                const usersData = usersResponse.ok ? await usersResponse.json() : {};
                const konoplayByNickname = buildKonoplayIndex(usersData);
                setKonoplayPlayers(buildKonoplayLeaderboard(usersData));

                try {
                    const metaResponse = await fetch(
                        `${FIREBASE_DATABASE_URL}/meta/lastRankSnapshot.json`
                    );
                    if (metaResponse.ok) {
                        const metaData = await metaResponse.json();
                        setLastRankSnapshot(metaData);
                    }
                } catch (error) {
                    console.error('Error fetching last rank snapshot:', error);
                }

                try {
                    const hotaEntries = await fetchHotaLeaderboard({ limit: HOTA_FETCH_LIMIT });
                    const enrichedHotaPlayers = enrichHotaLeaderboard(hotaEntries, konoplayByNickname);
                    const hotaWithSiteStars = applySiteStarsFromRank(enrichedHotaPlayers);
                    const hotaUsernames = new Set(
                        hotaEntries.map((entry) => entry.username?.toLowerCase()).filter(Boolean)
                    );
                    const offLeaderboardPlayers = (
                        await buildOffLeaderboardRegisteredPlayers(konoplayByNickname, hotaUsernames)
                    ).map((player) => ({
                        ...player,
                        siteStars: SITE_STARS_MIN
                    }));

                    setHotaPlayers(hotaWithSiteStars);
                    setRegisteredBottomPlayers(
                        buildRegisteredBottomPlayers(hotaWithSiteStars, offLeaderboardPlayers)
                    );
                    setUsingHota(true);

                    const avatarTargets = [...hotaWithSiteStars, ...offLeaderboardPlayers]
                        .filter((player) => player.siteUserId)
                        .reduce((unique, player) => {
                            if (!unique.some((entry) => entry.siteUserId === player.siteUserId)) {
                                unique.push(player);
                            }
                            return unique;
                        }, [])
                        .slice(0, 40);

                    const avatarResults = await Promise.all(
                        avatarTargets.map(async (player) => {
                            try {
                                const avatar = await getAvatar(player.siteUserId);
                                return { id: player.siteUserId, avatar };
                            } catch (error) {
                                console.error(`Error fetching avatar for ${player.username}:`, error);
                                return { id: player.siteUserId, avatar: null };
                            }
                        })
                    );

                    const avatarMap = {};
                    avatarResults.forEach(({ id, avatar }) => {
                        avatarMap[id] = avatar;
                    });
                    setAvatars(avatarMap);
                } catch (error) {
                    console.error('HotA leaderboard failed, using Konoplay fallback:', error);
                    setUsingHota(false);
                    setHotaPlayers([]);
                    setRegisteredBottomPlayers([]);

                    const fallbackPlayers = buildKonoplayLeaderboard(usersData);
                    const playersWithStars = applyKonoplayStars(fallbackPlayers);
                    setKonoplayPlayers(playersWithStars);

                    const avatarResults = await Promise.all(
                        playersWithStars.slice(0, 10).map(async (player) => {
                            try {
                                const avatar = await getAvatar(player.id);
                                return { id: player.id, avatar };
                            } catch (error) {
                                return { id: player.id, avatar: null };
                            }
                        })
                    );

                    const avatarMap = {};
                    avatarResults.forEach(({ id, avatar }) => {
                        avatarMap[id] = avatar;
                    });
                    setAvatars(avatarMap);
                }
            } catch (error) {
                console.error(error);
                setLoadError('Unable to load leaderboard data right now.');
            } finally {
                setLoading(false);
            }
        };

        loadLeaderboard();
    }, []);

    const displayPlayers = useMemo(() => {
        if (usingHota) {
            return hotaPlayers;
        }

        const playersWithStars = applyKonoplayStars(konoplayPlayers);

        return playersWithStars.map((player, index) => ({
            rank: index + 1,
            playerId: null,
            username: player.enteredNickname,
            rating: player.ratings,
            peakRating: null,
            games: player.games,
            wins: null,
            winrate: null,
            mainFaction: null,
            siteUserId: player.id,
            countryCode: player.countryCode,
            siteStars: player.stars,
            previousRank: player.previousRank
        }));
    }, [usingHota, hotaPlayers, konoplayPlayers]);

    const syncSiteStarsToProfiles = async () => {
        const registeredPlayers = [...hotaPlayers, ...registeredBottomPlayers].reduce((unique, player) => {
            if (!player.siteUserId || player.siteStars == null) {
                return unique;
            }

            if (!unique.some((entry) => entry.siteUserId === player.siteUserId)) {
                unique.push(player);
            }

            return unique;
        }, []);

        if (!registeredPlayers.length) {
            alert('No registered players with site stars to sync.');
            return;
        }

        const sourceLabel = usingHota ? 'HotA rating scale' : 'Konoplay cup rating scale';
        const confirmSync = confirm(
            `Sync site stars to ${registeredPlayers.length} registered profiles?\n\nScale: ${SITE_STARS_MIN}–${SITE_STARS_MAX} stars (${sourceLabel}).`
        );

        if (!confirmSync) {
            return;
        }

        try {
            let successCount = 0;
            let errorCount = 0;

            for (const player of registeredPlayers) {
                try {
                    const userResponse = await fetch(`${FIREBASE_DATABASE_URL}/users/${player.siteUserId}.json`, {
                        method: 'PATCH',
                        body: JSON.stringify({ stars: player.siteStars }),
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (userResponse.ok) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Error syncing stars for ${player.username}:`, error);
                    errorCount++;
                }
            }

            alert(`Site stars sync complete!\n\nSuccessful: ${successCount}\nErrors: ${errorCount}`);
        } catch (error) {
            console.error('Error during site stars sync:', error);
            alert('Error syncing site stars: ' + error.message);
        }
    };

    const snapshotCurrentRanks = async () => {
        const confirmSnapshot = confirm(
            'Snapshot current Konoplay site rankings?\n\nThis saves each registered player rank for cup comparisons. HotA ranked order is unchanged.'
        );

        if (!confirmSnapshot) {
            return;
        }

        const timestamp = new Date().toISOString();

        try {
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < konoplayPlayers.length; i++) {
                const player = konoplayPlayers[i];
                const currentRank = i + 1;

                try {
                    const userResponse = await fetch(`${FIREBASE_DATABASE_URL}/users/${player.id}.json`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            previousRank: currentRank,
                            previousRankTimestamp: timestamp
                        }),
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (userResponse.ok) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Error saving rank snapshot for ${player.enteredNickname}:`, error);
                    errorCount++;
                }
            }

            await fetch(`${FIREBASE_DATABASE_URL}/meta/lastRankSnapshot.json`, {
                method: 'PUT',
                body: JSON.stringify(timestamp),
                headers: { 'Content-Type': 'application/json' }
            });

            setLastRankSnapshot(timestamp);
            setKonoplayPlayers(
                konoplayPlayers.map((player, index) => ({
                    ...player,
                    previousRank: index + 1,
                    previousRankTimestamp: timestamp
                }))
            );

            alert(`Konoplay rank snapshot complete!\n\nSuccessful: ${successCount}\nErrors: ${errorCount}`);
        } catch (error) {
            console.error('Error during rank snapshot:', error);
            alert('Error snapshotting ranks: ' + error.message);
        }
    };

    const getRankClass = (rank) => {
        if (rank === 1) {
            return classes.gold;
        }
        if (rank === 2) {
            return classes.silver;
        }
        if (rank === 3) {
            return classes.bronze;
        }
        return '';
    };

    const formatRankLabel = (player) => player.rankLabel || (player.rank != null ? String(player.rank) : '—');

    const isCurrentUserRow = (player) =>
        authCtx.userNickName &&
        player.username?.toLowerCase() === authCtx.userNickName.toLowerCase();

    const renderDataRow = (player, { highlightCurrent = true } = {}) => {
        const rowClass = [
            player.rank != null && player.rank <= 3 ? getRankClass(player.rank) : '',
            highlightCurrent && isCurrentUserRow(player) ? classes.currentPlayerRow : ''
        ]
            .filter(Boolean)
            .join(' ');

        return (
            <tr key={`${player.username}-${player.rankLabel || player.rank || 'off'}`} className={rowClass || undefined}>
                <td className={classes.rankCol}>{formatRankLabel(player)}</td>
                <td>{renderPlayerLink(player)}</td>
                <td>{player.rating ?? '—'}</td>
                <td>{player.games ?? '—'}</td>
                {usingHota && <td>{player.winrate != null ? `${player.winrate}%` : '—'}</td>}
                {usingHota && <td>{player.peakRating ?? '—'}</td>}
                {!usingHota && <td>{getRankChangeIndicator(player.rank, player.previousRank)}</td>}
                <td>
                    <StarsComponent stars={player.siteStars ?? SITE_STARS_MIN} />
                </td>
            </tr>
        );
    };

    const getRankChangeIndicator = (currentRank, previousRank) => {
        if (!previousRank) {
            return <span className={classes.rankChangeNeutral}>—</span>;
        }

        const rankChange = previousRank - currentRank;

        if (rankChange > 0) {
            return <span className={`${classes.rankChange} ${classes.rankUp}`}>↑ {rankChange}</span>;
        }
        if (rankChange < 0) {
            return <span className={`${classes.rankChange} ${classes.rankDown}`}>↓ {Math.abs(rankChange)}</span>;
        }
        return <span className={`${classes.rankChange} ${classes.rankSame}`}>→</span>;
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) {
            return 'Never';
        }

        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderPlayerLink = (player) => {
        if (player.siteUserId) {
            return (
                <NavLink to={`/players/${player.siteUserId}`} className={classes.playerLink}>
                    <CountryFlag code={player.countryCode} />
                    {avatars[player.siteUserId] && (
                        <img
                            src={avatars[player.siteUserId]}
                            alt={player.username}
                            className={`${classes.playerAvatar} ${player.rank <= 3 ? classes.playerAvatarTop : ''}`}
                        />
                    )}
                    {player.username}
                </NavLink>
            );
        }

        if (player.playerId) {
            return (
                <a
                    href={getHotaPlayerUrl(player.playerId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classes.playerLink}
                >
                    {player.username}
                </a>
            );
        }

        return player.username;
    };

    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const matchedPlayerIndex = normalizedSearchTerm
        ? displayPlayers.findIndex((player) => (player.username || '').toLowerCase().includes(normalizedSearchTerm))
        : -1;
    const hasSearchTerm = normalizedSearchTerm.length > 0;
    const matchedPlayer = matchedPlayerIndex >= 0 ? displayPlayers[matchedPlayerIndex] : null;
    const contextStartIndex = matchedPlayerIndex >= 0 ? Math.max(0, matchedPlayerIndex - 4) : 0;
    const contextEndIndex =
        matchedPlayerIndex >= 0 ? Math.min(displayPlayers.length - 1, matchedPlayerIndex + 5) : -1;
    const searchContextPlayers =
        matchedPlayerIndex >= 0 ? displayPlayers.slice(contextStartIndex, contextEndIndex + 1) : [];

    const topRows = usingHota
        ? displayPlayers.filter((player) => player.rank <= TOP_TABLE_COUNT)
        : displayPlayers.slice(0, 10);

    return (
        <div className={`${classes.leaderboard} data-page`}>
            <h2 className={classes.pageTitle}>Leaderboard</h2>
            <p className={classes.pageSubtitle}>
                {usingHota
                    ? `Top ${TOP_TABLE_COUNT} HotA ranked players, plus registered Konoplay members below with their real global rank.`
                    : 'Konoplay cup ratings — HotA Meta unavailable, showing site fallback.'}
            </p>
            {usingHota && <div className={classes.sourceBadge}>Ranked by HotA Meta</div>}

            <div className={classes.starsLegend}>
                <StarsComponent stars={SITE_STARS_MAX} />
                <div className={classes.starsLegendText}>
                    <strong>Site stars</strong> — Konoplay skill tier (
                    {SITE_STARS_MIN}–{SITE_STARS_MAX} scale). Top 50 earns {SITE_STARS_TOP50_MIN}–
                    {SITE_STARS_MAX} stars by rank
                    {usingHota ? ' on HotA Meta' : ', based on cup ratings'}.
                </div>
            </div>

            <div className={classes.toolbar}>
                {authCtx.isAdmin && (
                    <div className={classes.toolbarActions}>
                        <button type="button" className={classes.btnSecondary} onClick={syncSiteStarsToProfiles}>
                            Sync site stars to profiles
                        </button>
                        <button type="button" className={classes.btnSecondary} onClick={snapshotCurrentRanks}>
                            Snapshot Konoplay ranks
                        </button>
                    </div>
                )}
                <div className={classes.metaText}>
                    Last Konoplay rank snapshot: <strong>{formatTimestamp(lastRankSnapshot)}</strong>
                </div>
            </div>

            <div className={classes.searchWrapper}>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search player by nickname..."
                    className={classes.searchInput}
                />
                {hasSearchTerm && !matchedPlayer && (
                    <div className={classes.searchHint}>No player found for "{searchTerm.trim()}"</div>
                )}
            </div>

            {loading && <p className={classes.loading}>Loading leaderboard...</p>}
            {loadError && <p className={classes.loadError}>{loadError}</p>}

            {hasSearchTerm && matchedPlayer && (
                <div className={classes.searchResultCard}>
                    <div className={classes.searchResultTitle}>
                        Found: {matchedPlayer.username} (Rank #{formatRankLabel(matchedPlayer)})
                    </div>
                    <div className={classes.searchResultSubtitle}>4 above and 5 below by rating</div>

                    <table className={classes.searchTable}>
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Player</th>
                                <th>Rating</th>
                                <th>Games</th>
                                {usingHota && <th>Win rate</th>}
                                {!usingHota && <th>Change</th>}
                                <th>Site stars</th>
                            </tr>
                        </thead>
                        <tbody>
                            {searchContextPlayers.map((player, index) => {
                                const globalIndex = contextStartIndex + index;
                                const isCurrentPlayer = globalIndex === matchedPlayerIndex;

                                return (
                                    <tr key={`${player.username}-${globalIndex}`} className={isCurrentPlayer ? classes.currentPlayerRow : ''}>
                                        <td>{formatRankLabel(player)}</td>
                                        <td>{renderPlayerLink(player)}</td>
                                        <td>{player.rating}</td>
                                        <td>{player.games}</td>
                                        {usingHota && <td>{player.winrate != null ? `${player.winrate}%` : '—'}</td>}
                                        {!usingHota && (
                                            <td>{getRankChangeIndicator(globalIndex + 1, player.previousRank)}</td>
                                        )}
                                        <td>
                                            <StarsComponent stars={player.siteStars ?? SITE_STARS_MIN} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {!loading && !loadError && (
                <>
                    <div className={classes.sectionHeader}>
                        <h3 className={classes.sectionTitle}>Top {usingHota ? TOP_TABLE_COUNT : 10}</h3>
                        {usingHota && (
                            <p className={classes.sectionNote}>
                                Rankings #{1}–#{TOP_TABLE_COUNT} from HotA Meta (of {HOTA_FETCH_LIMIT} fetched).
                            </p>
                        )}
                    </div>

                    <table className={classes.dataTable}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Player</th>
                                <th>Rating</th>
                                <th>Games</th>
                                {usingHota && <th>Win rate</th>}
                                {usingHota && <th>Peak</th>}
                                {!usingHota && <th>Change</th>}
                                <th>
                                    Site stars
                                    <span className={classes.columnHint}>
                                        {' '}
                                        (max {SITE_STARS_MAX})
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>{topRows.map((player) => renderDataRow(player))}</tbody>
                    </table>

                    {usingHota && registeredBottomPlayers.length > 0 && (
                        <section className={classes.bottomSection}>
                            <div className={classes.sectionHeader}>
                                <h3 className={classes.sectionTitle}>Registered Konoplay players</h3>
                                <p className={classes.sectionNote}>
                                    Site members outside the top {TOP_TABLE_COUNT}. Rank is their real HotA
                                    position — climb the ladder and check back after ranked games.
                                </p>
                            </div>

                            <table className={classes.dataTable}>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Player</th>
                                        <th>Rating</th>
                                        <th>Games</th>
                                        <th>Win rate</th>
                                        <th>Peak</th>
                                        <th>
                                            Site stars
                                            <span className={classes.columnHint}>
                                                {' '}
                                                (max {SITE_STARS_MAX})
                                            </span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {registeredBottomPlayers.map((player) => renderDataRow(player))}
                                </tbody>
                            </table>
                        </section>
                    )}
                </>
            )}
        </div>
    );
};

export default Leaderboard;
