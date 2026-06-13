const admin = require('firebase-admin');
const { sendTelegramDirectMessage, escapeHtml, getTelegramBotUsername, appRoute, tournamentLink } = require('./telegram');

const db = admin.database();

const DEDUPE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const DEFAULT_PREFS = {
    enabled: true,
    matchSchedule: true,
    matchReschedule: true,
    matchLive: true,
    matchResult: true,
    commentatorAssigned: true
};

const normalizeNickname = (value) => String(value || '').trim().toLowerCase();

const mergePrefs = (stored) => ({
    ...DEFAULT_PREFS,
    ...(stored && typeof stored === 'object' ? stored : {})
});

const isFollowedPlayer = (followedPlayers, nickname) => {
    if (!followedPlayers || !nickname) {
        return false;
    }

    const target = normalizeNickname(nickname);
    return Object.keys(followedPlayers).some(
        (key) => followedPlayers[key] === true && normalizeNickname(key) === target
    );
};

const shouldNotifyUser = (user, eventType, pair) => {
    if (!user?.telegramChatId) {
        return false;
    }

    const prefs = mergePrefs(user.telegramNotificationPrefs);
    if (!prefs.enabled || prefs[eventType] === false) {
        return false;
    }

    const team1 = pair?.team1;
    const team2 = pair?.team2;
    const myNick = normalizeNickname(user.enteredNickname);
    const inMatch = myNick && (myNick === normalizeNickname(team1) || myNick === normalizeNickname(team2));
    const followsMatch =
        isFollowedPlayer(user.telegramFollowedPlayers, team1) ||
        isFollowedPlayer(user.telegramFollowedPlayers, team2);

    return inMatch || followsMatch;
};

async function sendUserOnce(uid, dedupeKey, chatId, text, options = {}) {
    const ref = db.ref(`meta/telegramUserNotifications/${uid}/${dedupeKey}`);
    const existing = await ref.once('value');

    if (existing.exists()) {
        const sentAt = existing.val()?.sentAt;
        if (sentAt && Date.now() - new Date(sentAt).getTime() < DEDUPE_TTL_MS) {
            return null;
        }
    }

    const result = await sendTelegramDirectMessage(chatId, text, options);
    if (result.ok) {
        await ref.set({ sentAt: new Date().toISOString() });
    }

    return result;
}

async function notifyLinkedUsersForPair({ eventType, dedupeKey, text, pair, options = {} }) {
    const subsSnap = await db.ref('meta/telegramSubscribers').once('value');
    const subs = subsSnap.val() || {};
    const entries = Object.entries(subs);

    if (!entries.length) {
        return { sent: 0 };
    }

    let sent = 0;

    await Promise.all(
        entries.map(async ([uid, sub]) => {
            const chatId = sub?.chatId || sub?.telegramChatId;
            if (!chatId) {
                return;
            }

            const userSnap = await db.ref(`users/${uid}`).once('value');
            const user = userSnap.val();
            if (!shouldNotifyUser(user, eventType, pair)) {
                return;
            }

            const resolvedChatId = user.telegramChatId || chatId;
            const result = await sendUserOnce(uid, dedupeKey, resolvedChatId, text, options);
            if (result?.ok) {
                sent += 1;
            }
        })
    );

    return { sent };
}

async function notifyUserDirect({ uid, eventType, dedupeKey, text, pair = null, options = {} }) {
    const userSnap = await db.ref(`users/${uid}`).once('value');
    const user = userSnap.val();
    if (!user?.telegramChatId) {
        return { sent: 0 };
    }

    if (pair && !shouldNotifyUser(user, eventType, pair)) {
        return { sent: 0 };
    }

    const prefs = mergePrefs(user.telegramNotificationPrefs);
    if (!prefs.enabled || prefs[eventType] === false) {
        return { sent: 0 };
    }

    const result = await sendUserOnce(uid, dedupeKey, user.telegramChatId, text, options);
    return { sent: result?.ok ? 1 : 0 };
}

async function linkTelegramAccount({ uid, chatId, telegramUsername }) {
    const linkedAt = new Date().toISOString();
    await db.ref(`users/${uid}`).update({
        telegramChatId: String(chatId),
        telegramLinkedAt: linkedAt,
        telegramUsername: telegramUsername || null
    });
    await db.ref(`meta/telegramSubscribers/${uid}`).set({
        chatId: String(chatId),
        linkedAt,
        telegramUsername: telegramUsername || null
    });
}

async function unlinkTelegramAccount(uid) {
    await db.ref(`users/${uid}`).update({
        telegramChatId: null,
        telegramLinkedAt: null,
        telegramUsername: null
    });
    await db.ref(`meta/telegramSubscribers/${uid}`).remove();
}

function buildLinkWelcomeMessage(siteUrl) {
    return (
        `✅ <b>konoplay</b> · bot linked\n\n` +
        `Personal match updates will arrive here when you play or follow players.\n` +
        `Manage toggles in your profile on the site.\n\n` +
        `<a href="${appRoute(siteUrl, '/profile')}">Open profile</a>`
    );
}

function buildCommentatorAssignedMessage(tournamentName, tournamentId, siteUrl) {
    const link = tournamentLink(siteUrl, tournamentId);
    return (
        `🎙 <b>Commentator approved</b>\n` +
        `${escapeHtml(tournamentName)}\n\n` +
        `You can go live as commentator for this cup.\n` +
        `<a href="${link}">Open tournament</a>`
    );
}

module.exports = {
    DEFAULT_PREFS,
    normalizeNickname,
    mergePrefs,
    notifyLinkedUsersForPair,
    notifyUserDirect,
    linkTelegramAccount,
    unlinkTelegramAccount,
    buildLinkWelcomeMessage,
    buildCommentatorAssignedMessage,
    getTelegramBotUsername
};
