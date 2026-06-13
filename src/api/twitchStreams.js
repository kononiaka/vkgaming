import { FIREBASE_FUNCTIONS_BASE } from '../config/firebase';
import { extractTwitchLogin } from '../utils/twitchUtils';

export const fetchTwitchLiveLogins = async (logins) => {
    const unique = [...new Set(logins.map((login) => extractTwitchLogin(login)).filter(Boolean))];

    if (unique.length === 0) {
        return new Set();
    }

    try {
        const response = await fetch(`${FIREBASE_FUNCTIONS_BASE}/twitchStreamStatus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { logins: unique } })
        });

        if (!response.ok) {
            return new Set();
        }

        const payload = await response.json();
        const liveLogins = payload?.result?.liveLogins || payload?.liveLogins || [];
        return new Set(liveLogins.map((login) => String(login).toLowerCase()));
    } catch (error) {
        console.error('Failed to fetch Twitch live status:', error);
        return new Set();
    }
};
