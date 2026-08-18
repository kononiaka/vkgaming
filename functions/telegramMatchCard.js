const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.database();
const AVATAR_FETCH_TIMEOUT_MS = 2500;

function normalizeStars(value) {
    if (value == null || value === '' || value === '-') {
        return 0;
    }
    if (typeof value === 'string' && value.includes(',')) {
        return Number(value.split(',').at(-1).trim()) || 0;
    }
    return Number(value) || 0;
}

function hasTwitchLink(user = {}, tournamentPlayer = {}) {
    return Boolean(
        user.twitch ||
            user.links?.twitch ||
            user.twitchDisplayName ||
            user.twitchId ||
            user.authProvider === 'twitch' ||
            tournamentPlayer.twitch ||
            tournamentPlayer.links?.twitch
    );
}

function hasYoutubeLink(user = {}, tournamentPlayer = {}) {
    return Boolean(
        user.youtube ||
            user.links?.youtube ||
            user.youtubeId ||
            user.authProvider === 'youtube' ||
            tournamentPlayer.youtube ||
            tournamentPlayer.links?.youtube
    );
}

async function fetchImageDataUri(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AVATAR_FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            return null;
        }
        const contentType = response.headers.get('content-type') || 'image/png';
        if (!contentType.startsWith('image/')) {
            return null;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.length || buffer.length > 2_000_000) {
            return null;
        }
        return `data:${contentType};base64,${buffer.toString('base64')}`;
    } catch (error) {
        console.warn('telegramMatchCard avatar fetch failed:', error?.message || error);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

async function fetchFlagDataUri(countryCode) {
    const code = String(countryCode || '')
        .trim()
        .toLowerCase();
    if (!/^[a-z]{2}$/.test(code)) {
        return null;
    }
    return fetchImageDataUri(`https://flagcdn.com/w80/${code}.png`);
}

async function resolvePlayersByNicknames(nicknames = []) {
    const unique = [...new Set(nicknames.filter(Boolean))];
    const result = {};
    unique.forEach((name) => {
        result[name] = {
            avatarDataUri: null,
            flagDataUri: null,
            stars: 0,
            hasTwitch: false,
            hasYoutube: false,
            countryCode: null
        };
    });

    if (!unique.length) {
        return result;
    }

    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};
    const userByNickname = {};
    const uniqueLower = new Map(unique.map((name) => [String(name).toLowerCase(), name]));

    Object.values(users).forEach((user) => {
        if (!user?.enteredNickname) {
            return;
        }
        const key = uniqueLower.get(String(user.enteredNickname).toLowerCase());
        if (!key) {
            return;
        }
        userByNickname[key] = user;
    });

    await Promise.all(
        unique.map(async (nickname) => {
            const user = userByNickname[nickname] || {};
            const countryCode = user.countryCode || user.country || null;
            const [avatarDataUri, flagDataUri] = await Promise.all([
                fetchImageDataUri(user.avatar || user.profileImageUrl || null),
                fetchFlagDataUri(countryCode)
            ]);
            result[nickname] = {
                avatarDataUri,
                flagDataUri,
                stars: normalizeStars(user.stars),
                hasTwitch: hasTwitchLink(user),
                hasYoutube: hasYoutubeLink(user),
                countryCode
            };
        })
    );

    return result;
}

async function loadPairCardData(tournamentId, stageIdx, pairIdx, { cardType = 'result', gameIdx = null } = {}) {
    const [tournamentSnap, pairSnap] = await Promise.all([
        db.ref(`tournaments/heroes3/${tournamentId}`).once('value'),
        db.ref(`tournaments/heroes3/${tournamentId}/bracket/playoffPairs/${stageIdx}/${pairIdx}`).once('value')
    ]);

    const tournament = tournamentSnap.val();
    const pair = pairSnap.val();

    if (!tournament || !pair) {
        return null;
    }

    if (tournament.isPublic === false) {
        return null;
    }

    const team1 = pair.team1 || 'TBD';
    const team2 = pair.team2 || 'TBD';
    const tournamentPlayers = Object.values(tournament.players || {}).filter(Boolean);
    const team1Player = tournamentPlayers.find((player) => player.name === team1) || {};
    const team2Player = tournamentPlayers.find((player) => player.name === team2) || {};
    const profiles = await resolvePlayersByNicknames([team1, team2]);

    const team1Profile = profiles[team1] || {};
    const team2Profile = profiles[team2] || {};

    const team1Country = team1Player.countryCode || team1Profile.countryCode || null;
    const team2Country = team2Player.countryCode || team2Profile.countryCode || null;
    const [team1FlagFallback, team2FlagFallback] = await Promise.all([
        team1Profile.flagDataUri ? null : fetchFlagDataUri(team1Country),
        team2Profile.flagDataUri ? null : fetchFlagDataUri(team2Country)
    ]);

    let castle1 = null;
    let castle2 = null;
    if (cardType === 'live') {
        const games = Array.isArray(pair.games) ? pair.games : [];
        const game =
            gameIdx != null && gameIdx !== ''
                ? games[Number(gameIdx)]
                : games.find((entry) => entry?.castle1 && entry?.castle2 && !entry?.castleWinner) || null;
        castle1 = game?.castle1 || null;
        castle2 = game?.castle2 || null;
    }

    return {
        cardType,
        tournamentName: tournament.name || 'Tournament',
        tournamentType: tournament.type || null,
        stageLabel: pair.stage || `Stage ${Number(stageIdx) + 1}`,
        team1,
        team2,
        winner: pair.winner || '',
        pair,
        scheduledAt: pair.scheduledAt || null,
        castle1,
        castle2,
        team1AvatarDataUri: team1Profile.avatarDataUri || null,
        team2AvatarDataUri: team2Profile.avatarDataUri || null,
        team1FlagDataUri: team1Profile.flagDataUri || team1FlagFallback || null,
        team2FlagDataUri: team2Profile.flagDataUri || team2FlagFallback || null,
        team1Stars: normalizeStars(pair.stars1 ?? team1Player.stars ?? team1Profile.stars),
        team2Stars: normalizeStars(pair.stars2 ?? team2Player.stars ?? team2Profile.stars),
        team1HasTwitch: Boolean(team1Profile.hasTwitch || hasTwitchLink({}, team1Player)),
        team2HasTwitch: Boolean(team2Profile.hasTwitch || hasTwitchLink({}, team2Player)),
        team1HasYoutube: Boolean(team1Profile.hasYoutube || hasYoutubeLink({}, team1Player)),
        team2HasYoutube: Boolean(team2Profile.hasYoutube || hasYoutubeLink({}, team2Player))
    };
}

function parseTournamentWinners(winnersRaw) {
    const medals = [
        {
            keys: ['1st place', '1st Place', '1', 'gold', 'Gold'],
            label: 'Gold',
            place: '1st',
            color: '#f5c400'
        },
        {
            keys: ['2nd place', '2nd Place', '2', 'silver', 'Silver'],
            label: 'Silver',
            place: '2nd',
            color: '#c0c7d1'
        },
        {
            keys: ['3rd place', '3rd Place', '3', 'bronze', 'Bronze'],
            label: 'Bronze',
            place: '3rd',
            color: '#cd7f32'
        }
    ];

    if (!winnersRaw) {
        return [];
    }

    if (Array.isArray(winnersRaw)) {
        return winnersRaw
            .slice(0, 3)
            .map((entry, idx) => {
                const name =
                    typeof entry === 'string'
                        ? entry.trim()
                        : String(entry?.name || entry?.nickname || '').trim();
                if (!name) {
                    return null;
                }
                return {
                    label: medals[idx]?.label || `${idx + 1}`,
                    place: medals[idx]?.place || `${idx + 1}`,
                    color: medals[idx]?.color || '#f8f4ea',
                    name
                };
            })
            .filter(Boolean);
    }

    if (typeof winnersRaw === 'object') {
        return medals
            .map((medal) => {
                const key = medal.keys.find((candidate) => winnersRaw[candidate]);
                const value = key ? winnersRaw[key] : null;
                const name =
                    typeof value === 'string'
                        ? value.trim()
                        : String(value?.name || value?.nickname || '').trim();
                if (!name) {
                    return null;
                }
                return {
                    label: medal.label,
                    place: medal.place,
                    color: medal.color,
                    name
                };
            })
            .filter(Boolean);
    }

    return [];
}

function resolvePrizePoolUsd(tournament = {}) {
    const community = Number(tournament.communityFundingUsd);
    if (Number.isFinite(community) && community > 0) {
        return Math.round(community * 100) / 100;
    }
    const total = Number(tournament.totalPrizeUsd);
    if (Number.isFinite(total) && total > 0) {
        return Math.round(total * 100) / 100;
    }
    return 0;
}

async function loadStatusCardData(tournamentId, status) {
    const snap = await db.ref(`tournaments/heroes3/${tournamentId}`).once('value');
    const tournament = snap.val();
    if (!tournament || tournament.isPublic === false) {
        return null;
    }

    const resolvedStatus = status || tournament.status || 'Registration Started';
    let winners =
        resolvedStatus === 'Tournament Finished' ? parseTournamentWinners(tournament.winners) : [];

    if (winners.length) {
        const tournamentPlayers = Object.values(tournament.players || {}).filter(Boolean);
        const profiles = await resolvePlayersByNicknames(winners.map((entry) => entry.name));
        winners = winners.map((entry) => {
            const tournamentPlayer =
                tournamentPlayers.find((player) => player.name === entry.name) || {};
            const profile = profiles[entry.name] || {};
            return {
                ...entry,
                avatarDataUri: profile.avatarDataUri || null,
                stars: normalizeStars(tournamentPlayer.stars ?? profile.stars)
            };
        });
    }

    return {
        cardType: 'status',
        tournamentName: tournament.name || 'Tournament',
        tournamentDate: tournament.date || '',
        status: resolvedStatus,
        winners,
        prizePoolUsd: resolvePrizePoolUsd(tournament)
    };
}

async function loadDigestCardData(slot, dateKey) {
    const { collectTodayScheduledMatches, getKyivDateKey } = require('./telegramDigest');
    const resolvedDateKey = dateKey || getKyivDateKey();
    const tournamentsSnap = await db.ref('tournaments/heroes3').once('value');
    const matches = collectTodayScheduledMatches(tournamentsSnap.val(), resolvedDateKey);

    if (!matches.length) {
        return null;
    }

    return {
        cardType: 'digest',
        slot: slot === 'evening' ? 'evening' : 'morning',
        dateKey: resolvedDateKey,
        matches
    };
}

exports.telegramMatchCard = functions
    .runWith({ memory: '512MB', timeoutSeconds: 30 })
    .https.onRequest(async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.set('Allow', 'GET, HEAD');
            res.status(405).send('Method Not Allowed');
            return;
        }

        const type = String(req.query.type || 'result').toLowerCase();
        const tournamentId = String(req.query.tournamentId || '').trim();
        const stageIdx = String(req.query.stageIdx ?? '').trim();
        const pairIdx = String(req.query.pairIdx ?? '').trim();
        const gameIdx = String(req.query.gameIdx ?? '').trim();
        const status = String(req.query.status || '').trim();
        const slot = String(req.query.slot || 'morning').trim();
        const dateKey = String(req.query.dateKey || '').trim();

        try {
            let data = null;

            if (type === 'result' || type === 'live' || type === 'schedule') {
                if (!tournamentId || stageIdx === '' || pairIdx === '') {
                    res.status(400).json({ error: 'tournamentId, stageIdx, and pairIdx are required.' });
                    return;
                }
                data = await loadPairCardData(tournamentId, stageIdx, pairIdx, {
                    cardType: type,
                    gameIdx: gameIdx === '' ? null : gameIdx
                });
            } else if (type === 'status') {
                if (!tournamentId || !status) {
                    res.status(400).json({ error: 'tournamentId and status are required.' });
                    return;
                }
                data = await loadStatusCardData(tournamentId, status);
            } else if (type === 'digest') {
                data = await loadDigestCardData(slot, dateKey);
            } else {
                res.status(400).json({
                    error: 'Unsupported card type. Use result, live, schedule, status, or digest.'
                });
                return;
            }

            if (!data) {
                res.status(404).json({ error: 'Card data not found or not public.' });
                return;
            }

            const { renderTelegramCard } = require('./telegramMatchCardRender');
            const png = await renderTelegramCard(data);
            res.set({
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=60',
                'Content-Length': String(png.length)
            });

            if (req.method === 'HEAD') {
                res.status(200).end();
                return;
            }

            res.status(200).send(png);
        } catch (error) {
            console.error('telegramMatchCard failed:', error);
            res.status(500).json({ error: 'Failed to render match card.' });
        }
    });
