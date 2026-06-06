import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
    SITE_STARS_MAX,
    SITE_STARS_MIN,
    computeSiteStarsFromRank,
    getAvatar,
    getKonoplayLatestRating
} from '../../api/api';
import { fetchHotaLeaderboard, findHotaLeaderboardRank } from '../../api/hotaMeta';
import StarsComponent from '../Stars/Stars';
import CountryFlag from '../Country/CountryFlag';
import { resolveCountryCode } from '../../utils/country';
import classes from '../Leaderboard/Leaderboard.module.css';

const HOTA_RANK_LOOKUP_LIMIT = 500;

const buildRegisteredPlayers = (usersData, hotaLeaderboard) =>
    Object.entries(usersData || {})
        .map(([id, user]) => {
            if (!user?.enteredNickname) {
                return null;
            }

            const nickname = user.enteredNickname;
            const hotaRank = hotaLeaderboard
                ? findHotaLeaderboardRank(nickname, hotaLeaderboard)
                : null;

            return {
                id,
                nickname,
                countryCode: resolveCountryCode(user),
                cupRating: getKonoplayLatestRating(user),
                cupGames: user.gamesPlayed?.heroes3?.total ?? 0,
                hotaRank,
                hotaRankLabel: hotaRank ? String(hotaRank) : '—',
                siteStars:
                    user.stars ||
                    computeSiteStarsFromRank(hotaRank) ||
                    SITE_STARS_MIN
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (a.hotaRank != null && b.hotaRank != null) {
                const rankDiff = a.hotaRank - b.hotaRank;
                if (rankDiff !== 0) {
                    return rankDiff;
                }
            } else if (a.hotaRank != null) {
                return -1;
            } else if (b.hotaRank != null) {
                return 1;
            }

            const ratingDiff = (b.cupRating || 0) - (a.cupRating || 0);
            if (ratingDiff !== 0) {
                return ratingDiff;
            }

            return a.nickname.localeCompare(b.nickname, undefined, { sensitivity: 'base' });
        });

const PlayersList = () => {
    const [players, setPlayers] = useState([]);
    const [avatars, setAvatars] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [hotaAvailable, setHotaAvailable] = useState(false);

    useEffect(() => {
        const loadPlayers = async () => {
            setLoading(true);
            setLoadError('');

            try {
                const usersResponse = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
                const usersData = usersResponse.ok ? await usersResponse.json() : {};

                let hotaLeaderboard = null;
                try {
                    hotaLeaderboard = await fetchHotaLeaderboard({ limit: HOTA_RANK_LOOKUP_LIMIT });
                    setHotaAvailable(hotaLeaderboard.length > 0);
                } catch (error) {
                    console.error('HotA rank lookup unavailable for player directory:', error);
                    setHotaAvailable(false);
                }

                const registeredPlayers = buildRegisteredPlayers(usersData, hotaLeaderboard);
                setPlayers(registeredPlayers);

                const avatarResults = await Promise.all(
                    registeredPlayers.slice(0, 60).map(async (player) => {
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
            } catch (error) {
                console.error(error);
                setLoadError('Unable to load registered players right now.');
            } finally {
                setLoading(false);
            }
        };

        loadPlayers();
    }, []);

    const filteredPlayers = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) {
            return players;
        }

        return players.filter((player) => player.nickname.toLowerCase().includes(query));
    }, [players, searchTerm]);

    return (
        <div className={`${classes.leaderboard} data-page`}>
            <h2 className={classes.pageTitle}>Players</h2>
            <p className={classes.pageSubtitle}>
                Registered Konoplay members — search by lobby nickname and open a profile for cups,
                stats, and social links. Global HotA rankings live on the{' '}
                <Link to="/leaderboard">Leaderboard</Link>.
            </p>

            <div className={classes.searchWrapper}>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by nickname..."
                    className={classes.searchInput}
                />
                {searchTerm.trim() && filteredPlayers.length === 0 && (
                    <div className={classes.searchHint}>No player found for "{searchTerm.trim()}"</div>
                )}
            </div>

            {loading && <p className={classes.loading}>Loading players...</p>}
            {loadError && <p className={classes.loadError}>{loadError}</p>}

            {!loading && !loadError && (
                <>
                    <div className={classes.sectionHeader}>
                        <h3 className={classes.sectionTitle}>
                            {filteredPlayers.length} registered {filteredPlayers.length === 1 ? 'player' : 'players'}
                        </h3>
                        {hotaAvailable && (
                            <p className={classes.sectionNote}>
                                HotA rank shown when lobby nickname matches a ranked player (top{' '}
                                {HOTA_RANK_LOOKUP_LIMIT} fetched).
                            </p>
                        )}
                    </div>

                    {filteredPlayers.length === 0 ? (
                        <p className={classes.loading}>No registered players yet.</p>
                    ) : (
                        <table className={classes.dataTable}>
                            <thead>
                                <tr>
                                    <th>Player</th>
                                    <th>HotA rank</th>
                                    <th>Cup rating</th>
                                    <th>Cup games</th>
                                    <th>
                                        Site stars
                                        <span className={classes.columnHint}> (max {SITE_STARS_MAX})</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPlayers.map((player) => (
                                    <tr key={player.id}>
                                        <td>
                                            <NavLink to={`/players/${player.id}`} className={classes.playerLink}>
                                                <CountryFlag code={player.countryCode} />
                                                {avatars[player.id] && (
                                                    <img
                                                        src={avatars[player.id]}
                                                        alt={player.nickname}
                                                        className={classes.playerAvatar}
                                                    />
                                                )}
                                                {player.nickname}
                                            </NavLink>
                                        </td>
                                        <td>{player.hotaRankLabel}</td>
                                        <td>{player.cupRating > 0 ? player.cupRating : '—'}</td>
                                        <td>{player.cupGames > 0 ? player.cupGames : '—'}</td>
                                        <td>
                                            <StarsComponent stars={player.siteStars} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </>
            )}
        </div>
    );
};

export default PlayersList;
