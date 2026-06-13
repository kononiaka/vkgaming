import { FIREBASE_FUNCTIONS_BASE } from '../config/firebase';
import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { authFetch } from './authFetch';
import { mergeTelegramNotificationPrefs } from '../utils/telegramNotificationPrefs';

const CREATE_LINK_URL = `${FIREBASE_FUNCTIONS_BASE}/createTelegramLinkToken`;
const UNLINK_URL = `${FIREBASE_FUNCTIONS_BASE}/unlinkTelegram`;

export const createTelegramLinkToken = async (userId) => {
    const response = await fetch(CREATE_LINK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Could not create Telegram link.');
    }
    return data;
};

export const unlinkTelegramBot = async (userId) => {
    const response = await fetch(UNLINK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Could not unlink Telegram bot.');
    }
    return data;
};

export const loadTelegramNotificationPrefs = async (userId) => {
    const response = await fetch(`${FIREBASE_DATABASE_URL}/users/${userId}/telegramNotificationPrefs.json`);
    if (!response.ok) {
        return mergeTelegramNotificationPrefs(null);
    }
    const data = await response.json();
    return mergeTelegramNotificationPrefs(data);
};

export const saveTelegramNotificationPrefs = async (userId, prefs) => {
    const payload = mergeTelegramNotificationPrefs(prefs);
    const response = await authFetch(`${FIREBASE_DATABASE_URL}/users/${userId}/telegramNotificationPrefs.json`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
        throw new Error('Could not save Telegram notification preferences.');
    }
    return payload;
};

export const loadTelegramFollowedPlayers = async (userId) => {
    const response = await fetch(`${FIREBASE_DATABASE_URL}/users/${userId}/telegramFollowedPlayers.json`);
    if (!response.ok) {
        return {};
    }
    const data = await response.json();
    return data && typeof data === 'object' ? data : {};
};

export const saveTelegramFollowedPlayers = async (userId, followedPlayers) => {
    const response = await authFetch(`${FIREBASE_DATABASE_URL}/users/${userId}/telegramFollowedPlayers.json`, {
        method: 'PUT',
        body: JSON.stringify(followedPlayers || {}),
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
        throw new Error('Could not save followed players.');
    }
    return followedPlayers;
};

export const loadTelegramLinkState = async (userId) => {
    const response = await fetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`);
    if (!response.ok) {
        return { linked: false, telegramUsername: null, telegramLinkedAt: null };
    }
    const user = await response.json();
    return {
        linked: Boolean(user?.telegramChatId),
        telegramUsername: user?.telegramUsername || null,
        telegramLinkedAt: user?.telegramLinkedAt || null
    };
};
