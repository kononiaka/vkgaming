const functions = require('firebase-functions');
const admin = require('firebase-admin');

const {
    isTelegramConfigured,
    sendTelegramMessage,
    escapeHtml,
    formatSchedule,
    tournamentLink,
    matchCenterLink,
    matchPairLink,
    getTelegramConfig,
    useDigestOnlyMode
} = require('./telegram');

const {
    notifyLinkedUsersForPair,
    notifyUserDirect,
    buildCommentatorAssignedMessage
} = require('./telegramUserNotifications');

const {
    MORNING_DIGEST_HOUR,
    getKyivDateKey,
    isSameKyivDay,
    isAfterKyivTime,
    collectTodayScheduledMatches,
    buildDailyDigestMessage,
    buildScheduleInstantMessage
} = require('./telegramDigest');

const db = admin.database();

const NOTIFY_STATUSES = new Set([
    'Registration Started',
    'Registration finished!',
    'Tournament Finished'
]);

const DEDUPE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

async function getTournamentSummary(tournamentId) {
    const snap = await db.ref(`tournaments/heroes3/${tournamentId}`).once('value');
    const data = snap.val() || {};
    return {
        name: data.name || 'Турнир',
        status: data.status || '',
        date: data.date || '',
        isPublic: data.isPublic !== false
    };
}

async function getPairSummary(tournamentId, stageIdx, pairIdx) {
    const snap = await db
        .ref(`tournaments/heroes3/${tournamentId}/bracket/playoffPairs/${stageIdx}/${pairIdx}`)
        .once('value');
    return snap.val() || {};
}

async function sendOnce(dedupeKey, text, options = {}) {
    if (!isTelegramConfigured()) {
        return null;
    }

    const ref = db.ref(`meta/telegramNotifications/${dedupeKey}`);
    const existing = await ref.once('value');

    if (existing.exists()) {
        const sentAt = existing.val()?.sentAt;
        if (sentAt && Date.now() - new Date(sentAt).getTime() < DEDUPE_TTL_MS) {
            return null;
        }
    }

    const result = await sendTelegramMessage(text, options);
    if (result.ok) {
        await ref.set({ sentAt: new Date().toISOString() });
    }

    return result;
}

async function postDailyDigest(slot) {
    if (!isTelegramConfigured()) {
        return { ok: false, skipped: true, reason: 'not_configured' };
    }

    const dateKey = getKyivDateKey();
    const dedupeKey = `digest-${slot}-${dateKey}`;
    const tournamentsSnap = await db.ref('tournaments/heroes3').once('value');
    const rows = collectTodayScheduledMatches(tournamentsSnap.val(), dateKey);

    if (!rows.length) {
        return { ok: false, skipped: true, reason: 'no_matches' };
    }

    const { siteUrl } = getTelegramConfig();
    const text = buildDailyDigestMessage(rows, slot, siteUrl);
    if (!text) {
        return { ok: false, skipped: true, reason: 'empty_message' };
    }

    const result = await sendOnce(dedupeKey, text, { parseMode: 'HTML', disablePreview: false });
    return { ok: Boolean(result?.ok), skipped: false, matchCount: rows.length };
}

async function markEveningDigestNeeded(scheduledAtIso) {
    if (!scheduledAtIso) {
        return;
    }

    const dateKey = getKyivDateKey();
    if (!isSameKyivDay(scheduledAtIso, dateKey)) {
        return;
    }

    if (!isAfterKyivTime(MORNING_DIGEST_HOUR)) {
        return;
    }

    await db.ref(`meta/telegramEveningPending/${dateKey}`).set({
        needed: true,
        updatedAt: new Date().toISOString()
    });
}

async function postEveningDigestIfNeeded() {
    const dateKey = getKyivDateKey();
    const pendingSnap = await db.ref(`meta/telegramEveningPending/${dateKey}`).once('value');

    if (!pendingSnap.val()?.needed) {
        return { ok: false, skipped: true, reason: 'not_needed' };
    }

    const result = await postDailyDigest('evening');

    if (result.ok) {
        await db.ref(`meta/telegramEveningPending/${dateKey}`).remove();
    } else if (result.reason === 'no_matches') {
        await db.ref(`meta/telegramEveningPending/${dateKey}`).remove();
    }

    return result;
}

function statusNotificationText(status, tournament) {
    const name = escapeHtml(tournament.name);
    const { siteUrl } = getTelegramConfig();
    const link = tournamentLink(siteUrl, tournament.id || '');
    const home = matchCenterLink(siteUrl);

    switch (status) {
        case 'Registration Started':
            return (
                `📝 <b>Открыта регистрация</b>\n` +
                `${name}\n` +
                (tournament.date ? `Дата: ${escapeHtml(tournament.date)}\n` : '') +
                `\n<a href="${link}">Турнир</a> · <a href="${home}">Матч-центр</a>`
            );
        case 'Registration finished!':
            return `🔒 <b>Регистрация закрыта</b>\n${name}\n\n<a href="${link}">Сетка</a>`;
        case 'Tournament Finished':
            return `🏆 <b>Турнир завершён</b>\n${name}\n\n<a href="${link}">Итоги</a>`;
        default:
            return null;
    }
}

function formatSeriesScore(pair) {
    const score1 = Number(pair.score1) || 0;
    const score2 = Number(pair.score2) || 0;
    const type = pair.type === 'bo-5' ? 'BO5' : pair.type === 'bo-3' ? 'BO3' : pair.type === 'bo-2' ? 'BO2' : 'BO1';
    return `${score1}:${score2} (${type})`;
}

function formatLiveMapLabel(pair, gameIdx) {
    if (pair?.type === 'bo-1' || !pair?.type) {
        return 'Map';
    }
    return `Map ${Number(gameIdx) + 1}`;
}

function isGameLive(game) {
    return Boolean(game?.castle1 && game?.castle2 && !game?.castleWinner);
}

exports.notifyTelegramTournamentStatus = functions.database
    .ref('/tournaments/heroes3/{tournamentId}/status')
    .onWrite(async (change, context) => {
        const after = change.after.val();
        const before = change.before.val();

        if (!after || after === before || !NOTIFY_STATUSES.has(after)) {
            return null;
        }

        const { tournamentId } = context.params;
        const tournament = await getTournamentSummary(tournamentId);
        tournament.id = tournamentId;

        if (!tournament.isPublic) {
            return null;
        }

        const text = statusNotificationText(after, tournament);
        if (!text) {
            return null;
        }

        await sendOnce(`status-${tournamentId}-${after}`, text, { parseMode: 'HTML' });
        return null;
    });

exports.notifyTelegramMatchSchedule = functions.database
    .ref('/tournaments/heroes3/{tournamentId}/bracket/playoffPairs/{stageIdx}/{pairIdx}/scheduledAt')
    .onWrite(async (change, context) => {
        const after = change.after.val();
        const before = change.before.val();

        if (!after || after === before) {
            return null;
        }

        const { tournamentId, stageIdx, pairIdx } = context.params;
        const [tournament, pair] = await Promise.all([
            getTournamentSummary(tournamentId),
            getPairSummary(tournamentId, stageIdx, pairIdx)
        ]);

        const { siteUrl } = getTelegramConfig();
        const text = buildScheduleInstantMessage(tournament.name, pair, after, tournamentId, siteUrl);
        const eventType = before ? 'matchReschedule' : 'matchSchedule';
        const dedupeKey = `schedule-${tournamentId}-${stageIdx}-${pairIdx}-${after}`;

        if (useDigestOnlyMode()) {
            await markEveningDigestNeeded(after);
        } else {
            await sendOnce(dedupeKey, text, { parseMode: 'HTML' });
        }

        await notifyLinkedUsersForPair({
            eventType,
            dedupeKey,
            text,
            pair,
            options: { parseMode: 'HTML' }
        });
        return null;
    });

exports.notifyTelegramMatchLive = functions.database
    .ref('/tournaments/heroes3/{tournamentId}/bracket/playoffPairs/{stageIdx}/{pairIdx}/games/{gameIdx}')
    .onWrite(async (change, context) => {
        const after = change.after.val();
        const before = change.before.val();

        if (!isGameLive(after) || isGameLive(before)) {
            return null;
        }

        const { tournamentId, stageIdx, pairIdx, gameIdx } = context.params;
        const [tournament, pair] = await Promise.all([
            getTournamentSummary(tournamentId),
            getPairSummary(tournamentId, stageIdx, pairIdx)
        ]);

        const team1 = escapeHtml(pair.team1 || 'TBD');
        const team2 = escapeHtml(pair.team2 || 'TBD');
        const castle1 = escapeHtml(after.castle1);
        const castle2 = escapeHtml(after.castle2);
        const mapLabel = escapeHtml(formatLiveMapLabel(pair, gameIdx));
        const seriesScore = escapeHtml(formatSeriesScore(pair));
        const watchLink = matchPairLink(getTelegramConfig().siteUrl, tournamentId, stageIdx, pairIdx);

        const text =
            `🔴 <b>Match live</b>\n` +
            `${escapeHtml(tournament.name)}\n\n` +
            `${team1} vs ${team2}\n` +
            `Score: ${seriesScore}\n` +
            `${mapLabel}: ${castle1} vs ${castle2}\n\n` +
            `<a href="${watchLink}">Watch</a>`;

        const dedupeKey = `live-${tournamentId}-${stageIdx}-${pairIdx}-${gameIdx}`;

        if (!useDigestOnlyMode()) {
            await sendOnce(dedupeKey, text, { parseMode: 'HTML' });
        }

        await notifyLinkedUsersForPair({
            eventType: 'matchLive',
            dedupeKey,
            text,
            pair,
            options: { parseMode: 'HTML' }
        });
        return null;
    });

exports.notifyTelegramMatchResult = functions.database
    .ref('/tournaments/heroes3/{tournamentId}/bracket/playoffPairs/{stageIdx}/{pairIdx}/winner')
    .onWrite(async (change, context) => {
        const after = (change.after.val() || '').trim();
        const before = (change.before.val() || '').trim();

        if (!after || after === before) {
            return null;
        }

        const { tournamentId, stageIdx, pairIdx } = context.params;
        const [tournament, pair] = await Promise.all([
            getTournamentSummary(tournamentId),
            getPairSummary(tournamentId, stageIdx, pairIdx)
        ]);

        const team1 = escapeHtml(pair.team1 || 'TBD');
        const team2 = escapeHtml(pair.team2 || 'TBD');
        const winner = escapeHtml(after);
        const seriesScore = escapeHtml(formatSeriesScore(pair));
        const stageLabel = escapeHtml(pair.stage || `Stage ${Number(stageIdx) + 1}`);
        const link = tournamentLink(getTelegramConfig().siteUrl, tournamentId);

        const text =
            `✅ <b>Match result</b>\n` +
            `${escapeHtml(tournament.name)} · ${stageLabel}\n\n` +
            `${team1} vs ${team2}\n` +
            `Score: ${seriesScore}\n` +
            `Winner: <b>${winner}</b>\n\n` +
            `<a href="${link}">Bracket</a>`;

        const dedupeKey = `result-${tournamentId}-${stageIdx}-${pairIdx}-${after}`;

        if (!useDigestOnlyMode()) {
            await sendOnce(dedupeKey, text, { parseMode: 'HTML' });
        }

        await notifyLinkedUsersForPair({
            eventType: 'matchResult',
            dedupeKey,
            text,
            pair,
            options: { parseMode: 'HTML' }
        });
        return null;
    });

exports.notifyTelegramCommentatorApproved = functions.database
    .ref('/tournaments/heroes3/{tournamentId}/commentators/{commentatorUid}')
    .onCreate(async (snap, context) => {
        const { tournamentId, commentatorUid } = context.params;
        const tournament = await getTournamentSummary(tournamentId);
        const { siteUrl } = getTelegramConfig();
        const text = buildCommentatorAssignedMessage(tournament.name, tournamentId, siteUrl);

        await notifyUserDirect({
            uid: commentatorUid,
            eventType: 'commentatorAssigned',
            dedupeKey: `commentator-${tournamentId}-${commentatorUid}`,
            text,
            options: { parseMode: 'HTML' }
        });

        return null;
    });

exports.notifyTelegramMorningDigest = functions.pubsub
    .schedule('every day 09:00')
    .timeZone('Europe/Kyiv')
    .onRun(async () => {
        await postDailyDigest('morning');
        return null;
    });

exports.notifyTelegramEveningDigest = functions.pubsub
    .schedule('every day 18:00')
    .timeZone('Europe/Kyiv')
    .onRun(async () => {
        await postEveningDigestIfNeeded();
        return null;
    });

exports.telegramDigestToday = functions.https.onRequest(async (req, res) => {
    const testSecret = functions.config().telegram?.test_secret;
    if (testSecret && req.query.secret !== testSecret) {
        return res.status(403).send('Forbidden');
    }

    const slot = req.query.slot === 'morning' ? 'morning' : 'evening';
    const force = req.query.force === '1';

    if (force) {
        const dateKey = getKyivDateKey();
        await db.ref(`meta/telegramNotifications/digest-${slot}-${dateKey}`).remove();
    }

    if (slot === 'evening' && !force) {
        const pending = (await db.ref(`meta/telegramEveningPending/${getKyivDateKey()}`).once('value')).val();
        if (!pending?.needed) {
            return res.send('Evening digest not needed today (no new match times after 09:00).');
        }
    }

    if (force && slot === 'evening') {
        await db.ref(`meta/telegramEveningPending/${getKyivDateKey()}`).set({ needed: true });
    }

    const result = slot === 'evening' ? await postEveningDigestIfNeeded() : await postDailyDigest('morning');

    if (result.skipped && result.reason === 'no_matches') {
        return res.send('No scheduled matches for today — nothing posted.');
    }
    if (result.skipped && result.reason === 'not_needed') {
        return res.send('Evening digest not needed today (no new match times after 09:00).');
    }
    if (result.skipped && result.reason === 'not_configured') {
        return res.status(500).send('Telegram is not configured.');
    }
    if (!result.ok && result.skipped) {
        return res.send('Digest already sent today (use ?force=1 to resend).');
    }

    return res.send(`Posted ${slot} digest with ${result.matchCount} match(es).`);
});

exports.telegramTest = functions.https.onRequest(async (req, res) => {
    const testSecret = functions.config().telegram?.test_secret;
    if (testSecret && req.query.secret !== testSecret) {
        return res.status(403).send('Forbidden');
    }

    if (!isTelegramConfigured()) {
        return res.status(500).send('Telegram is not configured. Set telegram.bot_token and telegram.channel_id.');
    }

    const result = await sendTelegramMessage(
        '✅ konoplay · уведомления подключены к каналу @vkgamingplay.',
        { parseMode: 'HTML' }
    );

    if (!result.ok) {
        return res.status(500).send('Failed to send test message. Check function logs.');
    }

    return res.send('Test message sent to Telegram channel.');
});
