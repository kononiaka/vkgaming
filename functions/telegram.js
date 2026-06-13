const functions = require('firebase-functions');

const TELEGRAM_API = 'https://api.telegram.org';
const TELEGRAM_BOT_USERNAME = 'konoplay_bot';

function getTelegramConfig() {
    const cfg = functions.config().telegram || {};
    return {
        botToken: cfg.bot_token || '',
        channelId: cfg.channel_id || '',
        siteUrl: (cfg.site_url || 'https://vkgaming.com.ua').replace(/\/$/, ''),
        botUsername: cfg.bot_username || TELEGRAM_BOT_USERNAME
    };
}

function getTelegramBotUsername() {
    return getTelegramConfig().botUsername || TELEGRAM_BOT_USERNAME;
}

function isTelegramConfigured() {
    const { botToken, channelId } = getTelegramConfig();
    return Boolean(botToken && channelId);
}

function isBotConfigured() {
    const { botToken } = getTelegramConfig();
    return Boolean(botToken);
}

async function postTelegramMessage(body) {
    const { botToken } = getTelegramConfig();

    if (!botToken) {
        console.warn('Telegram bot token missing — skip notification');
        return { ok: false, skipped: true };
    }

    const response = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
        console.error('Telegram sendMessage failed:', JSON.stringify(data));
        return { ok: false, error: data };
    }

    return { ok: true, messageId: data.result?.message_id };
}

async function sendTelegramMessage(text, options = {}) {
    const { channelId } = getTelegramConfig();

    if (!channelId) {
        console.warn('Telegram channel not configured — skip notification');
        return { ok: false, skipped: true };
    }

    const body = {
        chat_id: channelId,
        text,
        disable_web_page_preview: options.disablePreview !== false
    };

    if (options.parseMode) {
        body.parse_mode = options.parseMode;
    }

    return postTelegramMessage(body);
}

async function sendTelegramDirectMessage(chatId, text, options = {}) {
    if (!chatId) {
        return { ok: false, skipped: true };
    }

    const body = {
        chat_id: chatId,
        text,
        disable_web_page_preview: options.disablePreview !== false
    };

    if (options.parseMode) {
        body.parse_mode = options.parseMode;
    }

    return postTelegramMessage(body);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatSchedule(iso) {
    if (!iso) {
        return 'TBD';
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return 'TBD';
    }

    return date.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Kyiv'
    });
}

function appRoute(siteUrl, path) {
    const base = siteUrl.replace(/\/$/, '');
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${base}/#${normalized}`;
}

function tournamentLink(siteUrl, tournamentId) {
    return appRoute(siteUrl, `/tournaments/homm3/${tournamentId}`);
}

function matchCenterLink(siteUrl) {
    return appRoute(siteUrl, '/live');
}

function matchPairLink(siteUrl, tournamentId, stageIdx, pairIdx) {
    return appRoute(siteUrl, `/live/match/${tournamentId}/${stageIdx}/${pairIdx}`);
}

function useDigestOnlyMode() {
    const cfg = functions.config().telegram || {};
    return cfg.instant_notifications !== 'true';
}

module.exports = {
    getTelegramConfig,
    getTelegramBotUsername,
    isTelegramConfigured,
    isBotConfigured,
    sendTelegramMessage,
    sendTelegramDirectMessage,
    escapeHtml,
    formatSchedule,
    tournamentLink,
    matchCenterLink,
    matchPairLink,
    appRoute,
    useDigestOnlyMode
};
