const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

const {
    getTelegramConfig,
    getTelegramBotUsername,
    isBotConfigured,
    sendTelegramDirectMessage
} = require('./telegram');

const {
    linkTelegramAccount,
    unlinkTelegramAccount,
    buildLinkWelcomeMessage
} = require('./telegramUserNotifications');

const db = admin.database();
const LINK_TOKEN_TTL_MS = 15 * 60 * 1000;

const setCors = (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
};

exports.createTelegramLinkToken = functions.https.onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!isBotConfigured()) {
        return res.status(503).json({ error: 'Telegram bot is not configured.' });
    }

    const { userId } = req.body || {};
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    const userSnap = await db.ref(`users/${userId}`).once('value');
    if (!userSnap.exists()) {
        return res.status(404).json({ error: 'User not found' });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + LINK_TOKEN_TTL_MS;

    await db.ref(`meta/telegramLinkTokens/${token}`).set({
        uid: userId,
        expiresAt
    });

    return res.json({
        token,
        botUrl: `https://t.me/${getTelegramBotUsername()}?start=${token}`,
        expiresInMinutes: 15
    });
});

exports.unlinkTelegram = functions.https.onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId } = req.body || {};
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    await unlinkTelegramAccount(userId);
    return res.json({ ok: true });
});

exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method not allowed');
    }

    if (!isBotConfigured()) {
        return res.status(503).send('Bot not configured');
    }

    const update = req.body || {};
    const message = update.message;
    if (!message?.text) {
        return res.send('ok');
    }

    const chatId = message.chat.id;
    const text = String(message.text).trim();
    const telegramUsername = message.from?.username || null;
    const { siteUrl } = getTelegramConfig();

    if (text.startsWith('/start')) {
        const token = text.split(/\s+/)[1];

        if (!token) {
            await sendTelegramDirectMessage(
                chatId,
                'Open your konoplay profile → Telegram notifications → Connect, then tap the bot link again.',
                { parseMode: 'HTML', disablePreview: true }
            );
            return res.send('ok');
        }

        const tokenRef = db.ref(`meta/telegramLinkTokens/${token}`);
        const tokenSnap = await tokenRef.once('value');
        const tokenData = tokenSnap.val();

        if (!tokenData?.uid) {
            await sendTelegramDirectMessage(
                chatId,
                'This link expired or is invalid. Generate a new one from your konoplay profile.',
                { disablePreview: true }
            );
            return res.send('ok');
        }

        if (tokenData.expiresAt && Date.now() > Number(tokenData.expiresAt)) {
            await tokenRef.remove();
            await sendTelegramDirectMessage(
                chatId,
                'This link expired. Generate a new one from your konoplay profile.',
                { disablePreview: true }
            );
            return res.send('ok');
        }

        await linkTelegramAccount({
            uid: tokenData.uid,
            chatId,
            telegramUsername
        });
        await tokenRef.remove();

        await sendTelegramDirectMessage(chatId, buildLinkWelcomeMessage(siteUrl), {
            parseMode: 'HTML',
            disablePreview: false
        });

        return res.send('ok');
    }

    if (text === '/stop' || text === '/unlink') {
        const subsSnap = await db.ref('meta/telegramSubscribers').once('value');
        const subs = subsSnap.val() || {};
        const matchedUid = Object.entries(subs).find(([, sub]) => String(sub.chatId) === String(chatId))?.[0];

        if (matchedUid) {
            await unlinkTelegramAccount(matchedUid);
            await sendTelegramDirectMessage(chatId, 'konoplay bot unlinked. You can connect again from your profile.', {
                disablePreview: true
            });
        }

        return res.send('ok');
    }

    return res.send('ok');
});
