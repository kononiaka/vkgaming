const functions = require('firebase-functions');

const TELEGRAM_API = 'https://api.telegram.org';

function getTelegramConfig() {
    const cfg = functions.config().telegram || {};
    return {
        botToken: cfg.bot_token || '',
        channelId: cfg.channel_id || '',
        siteUrl: (cfg.site_url || 'https://vkgaming.com.ua').replace(/\/$/, '')
    };
}

function isTelegramConfigured() {
    const { botToken, channelId } = getTelegramConfig();
    return Boolean(botToken && channelId);
}

async function sendTelegramMessage(text, options = {}) {
    const { botToken, channelId } = getTelegramConfig();

    if (!botToken || !channelId) {
        console.warn('Telegram not configured — skip notification');
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

function tournamentLink(siteUrl, tournamentId) {
    return `${siteUrl}/tournaments/homm3/${tournamentId}`;
}

function matchCenterLink(siteUrl) {
    return `${siteUrl.replace(/\/$/, '')}/`;
}

function useDigestOnlyMode() {
    const cfg = functions.config().telegram || {};
    return cfg.instant_notifications !== 'true';
}

module.exports = {
    getTelegramConfig,
    isTelegramConfigured,
    sendTelegramMessage,
    escapeHtml,
    formatSchedule,
    tournamentLink,
    matchCenterLink,
    useDigestOnlyMode
};
