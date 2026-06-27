import { FIREBASE_DATABASE_URL } from '../../../config/firebase';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getAvatar, lookForUserId } from '../../../api/api';
import CountryFlag from '../../Country/CountryFlag';
import { HeadToHeadStatsButton, HeadToHeadStatsPortal } from '../../HeadToHead/HeadToHeadStatsButton';
import StarsComponent from '../../Stars/Stars';
import MatchScheduleControl from './MatchScheduleControl';
import { useHeadToHeadStats } from '../../../hooks/useHeadToHeadStats';
import { buildCountryLookup, lookupCountryCode } from '../../../utils/country';
import { isGameSessionActive, isPairLive } from '../../../utils/matchCenterData';
import classes from './LeagueBracket.module.css';
import { CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP, compareStandingsWithHeadToHead } from './championsLeagueUtils';
import castleImg from '../../../image/castles/castle.jpeg';
import rampartImg from '../../../image/castles/rampart.jpeg';
import towerImg from '../../../image/castles/tower.jpeg';
import infernoImg from '../../../image/castles/inferno.jpeg';
import necropolisImg from '../../../image/castles/necropolis.jpeg';
import dungeonImg from '../../../image/castles/dungeon.jpeg';
import strongholdImg from '../../../image/castles/stronghold.jpeg';
import fortressImg from '../../../image/castles/fortress.jpeg';
import confluxImg from '../../../image/castles/conflux.jpeg';
import coveImg from '../../../image/castles/cove.jpeg';
import factoryImg from '../../../image/castles/factory.jpeg';
import kronverkImg from '../../../image/castles/kronverk.jpeg';

const CASTLE_IMAGE_MAP = {
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

const getCastleImage = (name) =>
    CASTLE_IMAGE_MAP[
        String(name || '')
            .split('-')[0]
            .trim()
            .toLowerCase()
    ] || null;

const renderRestartTokens = (r111, r112) => {
    const used111 = Math.max(0, Math.min(2, Number(r111) || 0));
    const show112AsUsed = (Number(r112) || 0) >= 1 || used111 >= 1;
    return (
        <div className={classes.restartRow}>
            {[0, 1].map((i) => (
                <span key={i} className={`${classes.restartToken} ${i < used111 ? classes.restartTokenUsed : ''}`}>
                    111
                </span>
            ))}
            <span className={`${classes.restartToken} ${show112AsUsed ? classes.restartTokenUsed : ''}`}>112</span>
        </div>
    );
};

// Circle-method round-robin: returns map of "team1|team2" -> round number (1-indexed)
const buildRoundMap = (names) => {
    const list = names.length % 2 !== 0 ? [...names, null] : [...names];
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
                map[`${p1}|${p2}`] = r + 1;
                map[`${p2}|${p1}`] = r + 1;
            }
        }
    }
    return map;
};

// Leaderboard-based win prediction (no H2H history needed)
const getWinPrediction = (team1Rating, team2Rating, team1Stars, team2Stars, team1Place, team2Place) => {
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const r1 = parseFloat(team1Rating) || 0;
    const r2 = parseFloat(team2Rating) || 0;
    const s1 = parseFloat(team1Stars) || 0;
    const s2 = parseFloat(team2Stars) || 0;
    const p1 = Number(team1Place) > 0 ? Number(team1Place) : null;
    const p2 = Number(team2Place) > 0 ? Number(team2Place) : null;
    const placeAdv = p1 && p2 ? clamp((p2 - p1) * 1.8, -12, 12) : 0;
    const ratingAdv = clamp((r1 - r2) * 0.04, -12, 12);
    const starsAdv = clamp((s1 - s2) * 0.8, -4, 4);
    const pred1 = clamp(50 + placeAdv + ratingAdv + starsAdv, 15, 85);
    return { team1: pred1.toFixed(1), team2: (100 - pred1).toFixed(1) };
};

const parseStarsValue = (value) => {
    if (value == null) {
        return 0;
    }
    const str = String(value);
    if (str.includes(',')) {
        return parseFloat(str.split(',').at(-1)) || 0;
    }
    return parseFloat(str) || 0;
};

const FORM_BADGE_LIMIT = 5;
const FORM_RESULT_LABELS = { W: 'Win', D: 'Draw', L: 'Loss' };
const isPlaceholderPlayer = (name) => !name || name === 'TBD' || name === 'BYE';

const formatFormScore = (pair, playerName) => {
    const score1 = Number(pair.score1) || 0;
    const score2 = Number(pair.score2) || 0;
    return pair.team1 === playerName ? `${score1}:${score2}` : `${score2}:${score1}`;
};

const getPlayerFormHistory = (pairs, playerName, limit = FORM_BADGE_LIMIT) => {
    if (isPlaceholderPlayer(playerName)) {
        return [];
    }
    const completed = pairs
        .filter(
            (pair) => pair.winner && pair.winner !== 'TBD' && (pair.team1 === playerName || pair.team2 === playerName)
        )
        .sort((a, b) => Number(a.round || 0) - Number(b.round || 0));

    const results = completed.map((pair) => {
        const opponent = pair.team1 === playerName ? pair.team2 : pair.team1;
        if (pair.isBye || pair.team2 === 'BYE') {
            return {
                result: 'W',
                title: `Win vs BYE · ${formatFormScore(pair, playerName)}`
            };
        }
        if (pair.winner === 'draw') {
            return {
                result: 'D',
                title: `Draw vs ${opponent} · ${formatFormScore(pair, playerName)}`
            };
        }
        const result = pair.winner === playerName ? 'W' : 'L';
        return {
            result,
            title: `${FORM_RESULT_LABELS[result]} vs ${opponent} · ${formatFormScore(pair, playerName)}`
        };
    });

    return results.slice(-limit).reverse();
};

const StandingsFormCell = ({ form }) => (
    <div className={classes.formRow}>
        {form.length === 0 ? (
            <span className={classes.formEmpty}>—</span>
        ) : (
            form.map((entry, index) => (
                <span
                    key={`${entry.result}-${index}`}
                    className={`${classes.formBadge} ${
                        entry.result === 'W'
                            ? classes.formBadgeWin
                            : entry.result === 'D'
                              ? classes.formBadgeDraw
                              : classes.formBadgeLoss
                    }`}
                    title={entry.title}
                >
                    {entry.result}
                </span>
            ))
        )}
    </div>
);

const formatMatchTypeLabel = (type) => {
    const normalized = String(type || 'bo-1')
        .toUpperCase()
        .replace('-', '');
    return normalized.startsWith('BO') ? normalized : `BO${normalized}`;
};

const formatRoundDeadline = (deadlineIso) => {
    if (!deadlineIso) {
        return null;
    }

    const deadline = new Date(deadlineIso);
    if (Number.isNaN(deadline.getTime())) {
        return null;
    }

    return deadline.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

const StandingsPlayerCell = ({
    name,
    player,
    stars,
    countryCode = null,
    showKnockoutBadge = false,
    knockoutBadgeLabel = 'Knock-out'
}) => {
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [userId, setUserId] = useState(player?.siteUserId || null);

    useEffect(() => {
        if (!name) {
            setAvatarUrl(null);
            setUserId(null);
            return undefined;
        }

        let cancelled = false;

        const loadPlayerProfile = async () => {
            try {
                let resolvedUserId = player?.siteUserId || null;
                if (!resolvedUserId) {
                    resolvedUserId = await lookForUserId(name);
                }

                if (!cancelled) {
                    setUserId(resolvedUserId || null);
                }

                if (resolvedUserId && !cancelled) {
                    const avatar = await getAvatar(resolvedUserId);
                    if (!cancelled && avatar) {
                        setAvatarUrl(avatar);
                    }
                }
            } catch {
                // Profile data is optional.
            }
        };

        loadPlayerProfile();

        return () => {
            cancelled = true;
        };
    }, [name, player?.siteUserId]);

    const nameContent = userId ? (
        <NavLink to={`/players/${userId}`} className={classes.standingsPlayerName}>
            {name}
        </NavLink>
    ) : (
        <span className={classes.standingsPlayerName}>{name}</span>
    );

    return (
        <div className={classes.standingsPlayer}>
            {countryCode ? (
                <span className={classes.standingsPlayerFlag}>
                    <CountryFlag code={countryCode} size={16} />
                </span>
            ) : null}
            {avatarUrl ? (
                <img src={avatarUrl} alt="" className={classes.standingsPlayerAvatar} />
            ) : (
                <div className={classes.standingsPlayerAvatarFallback} aria-hidden="true">
                    {name.charAt(0).toUpperCase()}
                </div>
            )}
            {nameContent}
            {stars > 0 && (
                <span className={classes.standingsPlayerStars}>
                    <StarsComponent stars={stars} />
                </span>
            )}
            {showKnockoutBadge && <span className={classes.qualifierBadge}>{knockoutBadgeLabel}</span>}
        </div>
    );
};

const usePlayerAvatar = (name, player) => {
    const [avatarUrl, setAvatarUrl] = useState(null);

    useEffect(() => {
        if (!name) {
            setAvatarUrl(null);
            return undefined;
        }

        let cancelled = false;

        const loadAvatar = async () => {
            try {
                let userId = player?.siteUserId || null;
                if (!userId) {
                    userId = await lookForUserId(name);
                }

                if (userId && !cancelled) {
                    const avatar = await getAvatar(userId);
                    if (!cancelled && avatar) {
                        setAvatarUrl(avatar);
                    }
                }
            } catch {
                // Avatar is optional.
            }
        };

        loadAvatar();

        return () => {
            cancelled = true;
        };
    }, [name, player?.siteUserId]);

    return avatarUrl;
};

const SchedulePlayerCell = ({ name, player, stars, place, countryCode, align = 'left', isWinner = false }) => {
    const avatarUrl = usePlayerAvatar(name, player);
    const isRight = align === 'right';

    const avatar = avatarUrl ? (
        <img src={avatarUrl} alt="" className={classes.schedulePlayerAvatar} />
    ) : (
        <div className={classes.schedulePlayerAvatarFallback} aria-hidden="true">
            {String(name || '?')
                .charAt(0)
                .toUpperCase()}
        </div>
    );

    return (
        <div className={`${classes.schedulePlayerCell} ${isRight ? classes.schedulePlayerCellRight : ''}`}>
            {countryCode ? (
                <span className={classes.schedulePlayerFlag}>
                    <CountryFlag code={countryCode} size={16} />
                </span>
            ) : null}
            {stars > 0 ? (
                <div className={classes.schedulePlayerStars}>
                    <StarsComponent stars={stars} />
                </div>
            ) : null}
            {avatar}
            <span className={`${classes.schedulePlayerName} ${isWinner ? classes.winnerName : ''}`}>
                {!isRight && place ? <span className={classes.placeTag}>#{place}</span> : null}
                {name}
                {isRight && place ? <span className={classes.placeTag}>#{place}</span> : null}
            </span>
        </div>
    );
};

/**
 * LeagueBracket — display component for round-robin league tournaments.
 *
 * Props:
 *  pairs              — flat array of all league match objects (playoffPairs[0])
 *  onSelectPair(idx)  — called when user wants to report / view a match
 *  canViewReportButton(pair) — whether to show the report button for this pair
 *  canSchedulePair(pair)     — whether the user can set match start time
 *  onSaveSchedule(idx, iso)  — persist scheduledAt for pair index
 */
const getDefaultDayIndex = (groups) => {
    if (!groups.length) {
        return 0;
    }
    const firstOpen = groups.findIndex(({ items }) =>
        items.some(({ pair }) => {
            if (pair.winner) {
                return false;
            }
            return true;
        })
    );
    if (firstOpen >= 0) {
        return firstOpen;
    }
    return groups.length - 1;
};

const LeagueBracket = ({
    pairs = [],
    onSelectPair,
    canViewReportButton,
    canSchedulePair,
    onSaveSchedule,
    registeredPlayers = [],
    playersObj = {},
    roundLabel = 'Day',
    scheduleTitle = 'League views',
    groupLabels = [],
    highlightPair = null,
    storageStageIndex = 0,
    scoringMode = 'restart',
    isSwissFormat = false,
    isCsSwissFormat = false,
    swissWinTarget = 3,
    swissLossLimit = 3,
    swissRoundDeadlines = {}
}) => {
    const [activeTab, setActiveTab] = useState(isSwissFormat ? 'standings' : 'schedule');
    const [activeGroup, setActiveGroup] = useState(groupLabels[0] || '');
    const [activeDayIndex, setActiveDayIndex] = useState(0);
    const [rankByNickname, setRankByNickname] = useState({});
    const [userIdByNickname, setUserIdByNickname] = useState({});
    const [countryLookup, setCountryLookup] = useState({});
    const dayNavInitialized = useRef(false);
    const highlightHandledRef = useRef(null);
    const headToHeadPairs = useMemo(() => [pairs], [pairs]);
    const {
        stats,
        loading: statsLoading,
        open: statsOpen,
        showHeadToHeadStats,
        closeHeadToHeadStats
    } = useHeadToHeadStats({ playoffPairs: headToHeadPairs });
    const hasGroups = groupLabels.length > 0;
    const scopedPairs = hasGroups ? pairs.filter((pair) => pair.group === activeGroup) : pairs;
    const scopedRegisteredPlayers = (
        hasGroups ? scopedPairs.flatMap((pair) => [pair.team1, pair.team2]) : registeredPlayers
    ).filter((name) => !isPlaceholderPlayer(name));
    const uniqueScopedRegisteredPlayers = [...new Set(scopedRegisteredPlayers)];

    // Fetch all users once and compute global leaderboard ranks (same as StartingPageContent)
    useEffect(() => {
        const fetchRanks = async () => {
            try {
                const res = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
                if (!res.ok) {
                    return;
                }
                const data = await res.json();
                const getLatestRating = (u) => {
                    const r = u.ratings;
                    if (typeof r === 'string' && r.includes(',')) {
                        return parseFloat(r.split(',').at(-1)) || 0;
                    }
                    return parseFloat(r) || 0;
                };
                const sorted = Object.values(data || {})
                    .filter((u) => u && u.ratings !== undefined)
                    .sort((a, b) => getLatestRating(b) - getLatestRating(a));
                const map = {};
                sorted.forEach((u, idx) => {
                    if (u.enteredNickname) {
                        map[u.enteredNickname] = idx + 1;
                    }
                });
                setRankByNickname(map);
                setUserIdByNickname(
                    Object.entries(data || {}).reduce((acc, [id, user]) => {
                        if (user?.enteredNickname) {
                            acc[user.enteredNickname] = id;
                        }
                        return acc;
                    }, {})
                );
                setCountryLookup(buildCountryLookup(data || {}));
            } catch {
                // silently ignore
            }
        };
        fetchRanks();
    }, []);

    // Points for a series win based on total restarts used by the winner:
    //   0 restarts → 3 pts | 1× 111 → 2.5 pts | 2× 111 or any 112 → 2 pts
    const calcWinPoints = (pair, winnerTeam) => {
        const games = Array.isArray(pair.games) ? pair.games : [];
        const isTeam1 = winnerTeam === pair.team1;
        let total111 = 0;
        let total112 = 0;
        games.forEach((g) => {
            if (!g) {
                return;
            }
            total111 += Number(isTeam1 ? g.restart1_111 : g.restart2_111) || 0;
            total112 += Number(isTeam1 ? g.restart1_112 : g.restart2_112) || 0;
        });
        const totalRestarts = total111 + total112;
        if (totalRestarts === 0) {
            return 3;
        }
        if (totalRestarts === 1) {
            return 2.5;
        }
        return 2;
    };

    // Compute standings from settled pairs, seeding all registered players at zero
    useEffect(() => {
        if (groupLabels.length > 0 && !groupLabels.includes(activeGroup)) {
            setActiveGroup(groupLabels[0]);
        }
    }, [groupLabels, activeGroup]);

    const computeStandings = () => {
        const map = {};
        uniqueScopedRegisteredPlayers.forEach((name) => {
            map[name] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        });
        scopedPairs.forEach((pair) => {
            if (!isPlaceholderPlayer(pair.team1) && !map[pair.team1]) {
                map[pair.team1] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
            }
            if (!isPlaceholderPlayer(pair.team2) && !map[pair.team2]) {
                map[pair.team2] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
            }
            if (pair.winner && pair.winner !== 'TBD') {
                if (pair.isBye || pair.team2 === 'BYE') {
                    map[pair.team1].played++;
                    map[pair.team1].wins++;
                    map[pair.team1].points += 3;
                    return;
                }

                map[pair.team1].played++;
                map[pair.team2].played++;
                if (pair.winner === 'draw') {
                    // BO-2 draw: 1 point each
                    map[pair.team1].draws++;
                    map[pair.team1].points += 1;
                    map[pair.team2].draws++;
                    map[pair.team2].points += 1;
                } else {
                    const pts =
                        scoringMode === 'classic' || pair.type === 'bo-2' ? 2 : calcWinPoints(pair, pair.winner);
                    if (pair.winner === pair.team1) {
                        map[pair.team1].wins++;
                        map[pair.team1].points += pts;
                        map[pair.team2].losses++;
                    } else {
                        map[pair.team2].wins++;
                        map[pair.team2].points += pts;
                        map[pair.team1].losses++;
                    }
                }
            }
        });
        return Object.entries(map)
            .filter(([name]) => !isPlaceholderPlayer(name))
            .map(([name, s]) => ({ name, ...s }))
            .sort(compareStandingsWithHeadToHead(scopedPairs));
    };

    const standings = computeStandings();
    const hasBo2 = scopedPairs.some((p) => p.type === 'bo-2');
    const showFormColumn = isSwissFormat && !hasGroups;
    const csSwissKnockoutCutoff = isCsSwissFormat ? Math.floor(uniqueScopedRegisteredPlayers.length / 2) : 0;
    const standingsColumnCount = hasBo2 ? 7 : 6;
    const finished = scopedPairs.filter((p) => p.winner).length;
    const total = scopedPairs.length;

    const getPlayerByName = (name) =>
        name && name !== 'TBD' ? Object.values(playersObj || {}).find((p) => p && p.name === name) || null : null;

    const getPlayerStars = (name) => {
        for (const pair of scopedPairs) {
            if (pair.team1 === name && pair.stars1 != null) {
                return parseStarsValue(pair.stars1);
            }
            if (pair.team2 === name && pair.stars2 != null) {
                return parseStarsValue(pair.stars2);
            }
        }
        return parseStarsValue(getPlayerByName(name)?.stars);
    };

    // Group matches into days using pair.round if available, else compute via circle method
    const computeRoundGroups = (groupOverride = activeGroup) => {
        const targetGroup = hasGroups ? groupOverride : null;
        const visiblePairs = hasGroups ? pairs.filter((pair) => pair.group === targetGroup) : pairs;
        if (visiblePairs.length === 0) {
            return [];
        }
        if (visiblePairs[0]?.round != null) {
            const groups = {};
            pairs.forEach((pair, idx) => {
                if (hasGroups && pair.group !== targetGroup) {
                    return;
                }
                const r = pair.round;
                if (!groups[r]) {
                    groups[r] = [];
                }
                groups[r].push({ pair, idx });
            });
            return Object.keys(groups)
                .sort((a, b) => Number(a) - Number(b))
                .map((r) => ({ round: Number(r), items: groups[r] }));
        }
        // Fallback: derive rounds from team names using circle method
        const playerNames = [
            ...new Set(visiblePairs.flatMap((p) => [p.team1, p.team2]).filter((n) => n && n !== 'TBD'))
        ];
        const roundMap = buildRoundMap(playerNames);
        const groups = {};
        pairs.forEach((pair, idx) => {
            if (hasGroups && pair.group !== targetGroup) {
                return;
            }
            const r = roundMap[`${pair.team1}|${pair.team2}`] || 1;
            if (!groups[r]) {
                groups[r] = [];
            }
            groups[r].push({ pair, idx });
        });
        return Object.keys(groups)
            .sort((a, b) => Number(a) - Number(b))
            .map((r) => ({ round: Number(r), items: groups[r] }));
    };
    const roundGroups = useMemo(() => computeRoundGroups(), [pairs, activeGroup, hasGroups]);
    const activeRound = roundGroups[activeDayIndex] || null;
    const dayCount = roundGroups.length;
    const activeRoundDeadline = activeRound ? swissRoundDeadlines?.[activeRound.round] : null;
    const activeRoundDeadlineLabel = formatRoundDeadline(activeRoundDeadline);
    const activeRoundHasOpenMatches = activeRound?.items.some(({ pair }) => !pair.winner);
    const isActiveRoundOverdue =
        Boolean(activeRoundDeadline) &&
        activeRoundHasOpenMatches &&
        new Date(activeRoundDeadline).getTime() < Date.now();

    useEffect(() => {
        if (dayCount === 0) {
            setActiveDayIndex(0);
            dayNavInitialized.current = false;
            return;
        }
        setActiveDayIndex((prev) => Math.min(prev, dayCount - 1));
    }, [dayCount]);

    useEffect(() => {
        if (activeTab !== 'schedule' || dayNavInitialized.current || dayCount === 0) {
            return;
        }
        setActiveDayIndex(getDefaultDayIndex(roundGroups));
        dayNavInitialized.current = true;
    }, [activeTab, dayCount, roundGroups]);

    useEffect(() => {
        if (!highlightPair) {
            highlightHandledRef.current = null;
            return;
        }

        const highlightKey = `${highlightPair.stageIndex ?? storageStageIndex}:${highlightPair.pairIndex}:${highlightPair.round ?? ''}`;
        if (highlightHandledRef.current === highlightKey) {
            return;
        }
        highlightHandledRef.current = highlightKey;

        const pair = pairs[highlightPair.pairIndex];
        const targetGroup = pair?.group && hasGroups ? pair.group : activeGroup;
        if (pair?.group && hasGroups) {
            setActiveGroup(pair.group);
        }
        setActiveTab('schedule');

        const highlightRoundGroups = computeRoundGroups(targetGroup);
        const dayIdx =
            highlightPair.round != null && !Number.isNaN(Number(highlightPair.round))
                ? highlightRoundGroups.findIndex(({ round }) => Number(round) === Number(highlightPair.round))
                : highlightRoundGroups.findIndex(({ items }) =>
                      items.some(({ idx }) => idx === highlightPair.pairIndex)
                  );
        if (dayIdx >= 0) {
            setActiveDayIndex(dayIdx);
            dayNavInitialized.current = true;
        } else {
            dayNavInitialized.current = false;
        }

        const timer = setTimeout(() => {
            const el = document.getElementById(
                `pair-s${highlightPair.stageIndex ?? storageStageIndex}-p${highlightPair.pairIndex}`
            );
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);

        return () => clearTimeout(timer);
    }, [highlightPair, pairs, hasGroups, storageStageIndex]);

    const goToPrevDay = () => setActiveDayIndex((prev) => Math.max(0, prev - 1));
    const goToNextDay = () => setActiveDayIndex((prev) => Math.min(dayCount - 1, prev + 1));

    const progressPct = total > 0 ? Math.round((finished / total) * 100) : 0;

    return (
        <div className={classes.container}>
            <div className={classes.progress}>
                <div className={classes.progressMeta}>
                    <span className={classes.progressLabel}>Matches played</span>
                    <span className={classes.progressCount}>
                        {finished} / {total}
                    </span>
                </div>
                <div className={classes.progressTrack} aria-hidden="true">
                    <div className={classes.progressFill} style={{ width: `${progressPct}%` }} />
                </div>
            </div>

            {hasGroups && (
                <div className={classes.tabs} role="tablist" aria-label="Group stage">
                    {groupLabels.map((groupLabel) => (
                        <button
                            key={groupLabel}
                            type="button"
                            role="tab"
                            aria-selected={activeGroup === groupLabel}
                            className={`${classes.tab} ${activeGroup === groupLabel ? classes.activeTab : ''}`}
                            onClick={() => {
                                setActiveGroup(groupLabel);
                                dayNavInitialized.current = false;
                            }}
                        >
                            Group {groupLabel}
                        </button>
                    ))}
                </div>
            )}

            <div className={classes.tabs} role="tablist" aria-label={scheduleTitle}>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'schedule'}
                    className={`${classes.tab} ${activeTab === 'schedule' ? classes.activeTab : ''}`}
                    onClick={() => setActiveTab('schedule')}
                >
                    Schedule
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'standings'}
                    className={`${classes.tab} ${activeTab === 'standings' ? classes.activeTab : ''}`}
                    onClick={() => setActiveTab('standings')}
                >
                    Standings
                </button>
            </div>

            {activeTab === 'schedule' && (
                <>
                    {dayCount > 0 && (
                        <div className={classes.dayNav}>
                            <button
                                type="button"
                                className={classes.dayNavBtn}
                                onClick={goToPrevDay}
                                disabled={activeDayIndex === 0}
                                aria-label="Previous day"
                            >
                                ‹
                            </button>
                            <div className={classes.dayNavCenter}>
                                <span className={classes.dayNavTitle}>
                                    {roundLabel} {activeRound.round}
                                </span>
                                <span className={classes.dayNavMeta}>
                                    {activeDayIndex + 1} / {dayCount}
                                    {' · '}
                                    {activeRound.items.length} {activeRound.items.length === 1 ? 'match' : 'matches'}
                                </span>
                                {activeRoundDeadlineLabel && (
                                    <span
                                        className={`${classes.roundDeadline} ${
                                            isActiveRoundOverdue ? classes.roundDeadlineOverdue : ''
                                        }`}
                                    >
                                        Deadline: {activeRoundDeadlineLabel}
                                        {isActiveRoundOverdue ? ' · overdue' : ''}
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                className={classes.dayNavBtn}
                                onClick={goToNextDay}
                                disabled={activeDayIndex >= dayCount - 1}
                                aria-label="Next day"
                            >
                                ›
                            </button>
                        </div>
                    )}
                    <div className={classes.schedule}>
                        {activeRound?.items.map(({ pair, idx }) => {
                            const isBye = pair.isBye || pair.team2 === 'BYE';
                            const isFinished = Boolean(pair.winner);
                            const showBtn = !isBye && canViewReportButton ? canViewReportButton(pair) : false;
                            const canSchedule = canSchedulePair ? canSchedulePair(pair) : false;
                            const inProgressGames = !isFinished
                                ? (pair.games || []).filter((game) => isGameSessionActive(game))
                                : [];
                            const isInProgress = !isBye && !isFinished && isPairLive(pair);

                            const getPlayer = (name) =>
                                name && name !== 'TBD'
                                    ? Object.values(playersObj || {}).find((p) => p && p.name === name) || null
                                    : null;

                            const getLatestRating = (ratingsStr) => {
                                if (!ratingsStr) {
                                    return 0;
                                }
                                const str = String(ratingsStr);
                                if (str.includes(',')) {
                                    return parseFloat(str.split(',').at(-1)) || 0;
                                }
                                return parseFloat(str) || 0;
                            };

                            const p1 = getPlayer(pair.team1);
                            const p2 = getPlayer(pair.team2);

                            const stars1 =
                                pair.stars1 != null
                                    ? (typeof pair.stars1 === 'string' && pair.stars1.includes(',')
                                          ? parseFloat(pair.stars1.split(',').at(-1))
                                          : parseFloat(pair.stars1)) || 0
                                    : parseFloat(p1?.stars) || 0;
                            const stars2 =
                                pair.stars2 != null
                                    ? (typeof pair.stars2 === 'string' && pair.stars2.includes(',')
                                          ? parseFloat(pair.stars2.split(',').at(-1))
                                          : parseFloat(pair.stars2)) || 0
                                    : parseFloat(p2?.stars) || 0;

                            const place1 = rankByNickname[pair.team1] || p1?.placeInLeaderboard || null;
                            const place2 = rankByNickname[pair.team2] || p2?.placeInLeaderboard || null;

                            const rating1 = getLatestRating(pair.ratings1 ?? p1?.ratings);
                            const rating2 = getLatestRating(pair.ratings2 ?? p2?.ratings);

                            const prediction = getWinPrediction(rating1, rating2, stars1, stars2, place1, place2);
                            const country1 = lookupCountryCode(pair.team1, countryLookup, p1);
                            const country2 = lookupCountryCode(pair.team2, countryLookup, p2);
                            const isHighlighted =
                                highlightPair?.pairIndex === idx &&
                                (highlightPair?.stageIndex ?? storageStageIndex) === storageStageIndex;

                            return (
                                <div
                                    key={idx}
                                    id={`pair-s${storageStageIndex}-p${idx}`}
                                    className={`${classes.matchRow} ${isBye ? classes.matchBye : ''} ${isFinished ? classes.matchFinished : isInProgress ? classes.matchInProgress : classes.matchPending} ${isHighlighted ? classes.matchHighlighted : ''}`}
                                >
                                    {!isBye && (
                                        <span className={classes.matchTopLeftControls}>
                                            <HeadToHeadStatsButton
                                                team1={pair.team1}
                                                team2={pair.team2}
                                                onShow={showHeadToHeadStats}
                                                className={classes.headToHeadBtn}
                                            />
                                            {isInProgress && (
                                                <span
                                                    className={classes.liveDot}
                                                    title="Match is live"
                                                    aria-label="Match is live"
                                                />
                                            )}
                                        </span>
                                    )}
                                    <div className={classes.teamCell}>
                                        <SchedulePlayerCell
                                            name={pair.team1}
                                            player={p1}
                                            stars={stars1}
                                            place={place1}
                                            countryCode={country1}
                                            isWinner={pair.winner === pair.team1}
                                        />
                                    </div>

                                    <div className={classes.centerBlock}>
                                        {isBye ? (
                                            <div className={classes.byeCenter}>
                                                <span className={classes.byeLabel}>Round bye</span>
                                                <span className={classes.byeHint}>No match this round</span>
                                            </div>
                                        ) : isFinished ? (
                                            <span className={classes.score}>
                                                {pair.score1 ?? 0}&nbsp;:&nbsp;{pair.score2 ?? 0}
                                            </span>
                                        ) : isInProgress ? (
                                            <span className={classes.liveTag}>LIVE</span>
                                        ) : (
                                            <span className={classes.vs}>vs</span>
                                        )}
                                        {!isBye && (
                                            <span className={classes.matchMetaRow}>
                                                <span className={classes.matchTypeBadge}>
                                                    {formatMatchTypeLabel(pair.type)}
                                                </span>
                                            </span>
                                        )}
                                        {!isFinished && !isBye && (
                                            <div
                                                className={classes.predictionEmbed}
                                                aria-label={`Win prediction ${prediction.team1}% to ${prediction.team2}%`}
                                            >
                                                <span className={classes.predictionPct}>{prediction.team1}%</span>
                                                <span className={classes.predictionLabel}>win odds</span>
                                                <span className={classes.predictionPct}>{prediction.team2}%</span>
                                            </div>
                                        )}
                                        {showBtn && (
                                            <button
                                                className={`${classes.reportBtn} ${isFinished ? classes.reReportBtn : ''}`}
                                                onClick={() => onSelectPair(idx)}
                                                title={isFinished ? 'Re-report result' : 'Report result'}
                                            >
                                                {isFinished ? 'Edit' : 'Report'}
                                            </button>
                                        )}
                                        {(pair.scheduledAt || canSchedule) && onSaveSchedule && (
                                            <div className={classes.scheduleControl}>
                                                <MatchScheduleControl
                                                    scheduledAt={pair.scheduledAt}
                                                    scheduledBy={pair.scheduledBy}
                                                    canEdit={canSchedule}
                                                    onSave={(iso) => onSaveSchedule(idx, iso)}
                                                    compact
                                                    showMissingHint={canSchedule}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className={`${classes.teamCell} ${classes.teamCellRight}`}>
                                        {isBye ? (
                                            <span className={classes.byeOpponentPlaceholder}>Automatic win</span>
                                        ) : (
                                            <SchedulePlayerCell
                                                name={pair.team2}
                                                player={p2}
                                                stars={stars2}
                                                place={place2}
                                                countryCode={country2}
                                                align="right"
                                                isWinner={pair.winner === pair.team2}
                                            />
                                        )}
                                    </div>

                                    {isInProgress &&
                                        inProgressGames.map((game, gIdx) => (
                                            <div key={gIdx} className={classes.gameDetail}>
                                                <div className={classes.castleCard}>
                                                    {getCastleImage(game.castle1) && (
                                                        <img
                                                            src={getCastleImage(game.castle1)}
                                                            alt={game.castle1}
                                                            className={classes.castleImg}
                                                        />
                                                    )}
                                                    <div className={classes.castleName}>{game.castle1 || '—'}</div>
                                                    <div className={classes.goldRow}>Gold: {game.gold1 ?? 0}</div>
                                                    {renderRestartTokens(game.restart1_111, game.restart1_112)}
                                                </div>
                                                <div className={classes.gameDetailCenter}>
                                                    Game {(game.gameId ?? gIdx) + 1}
                                                </div>
                                                <div className={`${classes.castleCard} ${classes.castleCardRight}`}>
                                                    {getCastleImage(game.castle2) && (
                                                        <img
                                                            src={getCastleImage(game.castle2)}
                                                            alt={game.castle2}
                                                            className={classes.castleImg}
                                                        />
                                                    )}
                                                    <div className={classes.castleName}>{game.castle2 || '—'}</div>
                                                    <div className={classes.goldRow}>Gold: {game.gold2 ?? 0}</div>
                                                    {renderRestartTokens(game.restart2_111, game.restart2_112)}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            );
                        })}
                        {scopedPairs.length === 0 && <p className={classes.emptyNote}>No matches generated yet.</p>}
                    </div>
                </>
            )}

            {activeTab === 'standings' && (
                <div className={classes.standingsWrapper}>
                    <table className={classes.standingsTable}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Player</th>
                                <th title="Played">P</th>
                                <th title="Wins">W</th>
                                {hasBo2 && <th title="Draws">D</th>}
                                <th title="Losses">L</th>
                                {showFormColumn ? <th title="Recent form">Form</th> : <th title="Points">Pts</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {standings.map((s, i) => {
                                const isConfirmedCsSwissQualifier = isCsSwissFormat && s.wins >= swissWinTarget;
                                const isCsSwissEliminated = isCsSwissFormat && s.losses >= swissLossLimit;
                                const isProjectedCsSwissQualifier =
                                    isCsSwissFormat &&
                                    !isConfirmedCsSwissQualifier &&
                                    !isCsSwissEliminated &&
                                    i < csSwissKnockoutCutoff;
                                const isKnockoutQualifier =
                                    (hasGroups && i < CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP) ||
                                    isConfirmedCsSwissQualifier ||
                                    isProjectedCsSwissQualifier;
                                const player = getPlayerByName(s.name);
                                const countryCode = lookupCountryCode(s.name, countryLookup, player);
                                const rowClass = [
                                    isKnockoutQualifier ? classes.qualifierRow : '',
                                    isCsSwissEliminated ? classes.eliminatedRow : '',
                                    !hasGroups && i === 0 && s.played > 0 ? classes.leader : ''
                                ]
                                    .filter(Boolean)
                                    .join(' ');

                                return (
                                    <tr key={s.name} className={rowClass || undefined}>
                                        <td>{i + 1}</td>
                                        <td className={classes.playerCell}>
                                            {userIdByNickname[s.name] ? (
                                                <Link
                                                    to={`/players/${userIdByNickname[s.name]}`}
                                                    className={classes.standingsPlayerLink}
                                                >
                                                    <StandingsPlayerCell
                                                        name={s.name}
                                                        player={player}
                                                        stars={getPlayerStars(s.name)}
                                                        countryCode={countryCode}
                                                        showKnockoutBadge={isKnockoutQualifier}
                                                        knockoutBadgeLabel={
                                                            isProjectedCsSwissQualifier ? 'Projected' : 'Knock-out'
                                                        }
                                                    />
                                                </Link>
                                            ) : (
                                                <StandingsPlayerCell
                                                    name={s.name}
                                                    player={player}
                                                    stars={getPlayerStars(s.name)}
                                                    countryCode={countryCode}
                                                    showKnockoutBadge={isKnockoutQualifier}
                                                    knockoutBadgeLabel={
                                                        isProjectedCsSwissQualifier ? 'Projected' : 'Knock-out'
                                                    }
                                                />
                                            )}
                                        </td>
                                        <td>{s.played}</td>
                                        <td>{s.wins}</td>
                                        {hasBo2 && <td>{s.draws || 0}</td>}
                                        <td>{s.losses}</td>
                                        {showFormColumn ? (
                                            <td>
                                                <StandingsFormCell form={getPlayerFormHistory(scopedPairs, s.name)} />
                                            </td>
                                        ) : (
                                            <td className={classes.pointsCell}>{s.points}</td>
                                        )}
                                    </tr>
                                );
                            })}
                            {standings.length === 0 && (
                                <tr>
                                    <td colSpan={standingsColumnCount} className={classes.emptyNote}>
                                        No completed matches yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <p className={classes.pointsNote}>
                        {hasGroups
                            ? 'Top 2 in each group (green) advance to the knockout stage.'
                            : isCsSwissFormat
                              ? `Green rows are current/projected knock-out places. ${swissWinTarget} wins qualify, ${swissLossLimit} losses eliminate.`
                              : showFormColumn
                                ? 'Swiss standings are sorted by match results. Form shows recent results from left to right.'
                                : hasBo2
                                  ? 'BO-2: Win 2pts · Draw(1-1) 1pt each · Loss 0pts'
                                  : 'Win pts: 3 (no restarts) · 2.5 (1× 111) · 2 (2× 111 or 112)'}
                    </p>
                </div>
            )}
            <HeadToHeadStatsPortal
                stats={stats}
                loading={statsLoading}
                open={statsOpen}
                onClose={closeHeadToHeadStats}
            />
        </div>
    );
};

export default LeagueBracket;
