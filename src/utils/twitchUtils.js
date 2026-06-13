export const extractTwitchLogin = (value) => {
    if (!value || typeof value !== 'string') {
        return null;
    }

    const cleaned = value.trim().replace(/^@/, '');
    if (!cleaned) {
        return null;
    }

    const urlMatch = cleaned.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([^/?#]+)/i);
    if (urlMatch?.[1]) {
        return urlMatch[1].toLowerCase();
    }

    if (/^[a-z0-9_]{3,25}$/i.test(cleaned)) {
        return cleaned.toLowerCase();
    }

    return null;
};

export const getTwitchWatchUrl = (loginOrUrl) => {
    const login = extractTwitchLogin(loginOrUrl);
    return login ? `https://www.twitch.tv/${login}` : null;
};

export const getTwitchEmbedParent = () => {
    if (typeof window === 'undefined') {
        return 'localhost';
    }
    return window.location.hostname || 'localhost';
};

export const getTwitchEmbedUrl = (loginOrUrl) => {
    const login = extractTwitchLogin(loginOrUrl);
    if (!login) {
        return null;
    }

    const parent = getTwitchEmbedParent();
    const params = new URLSearchParams({
        channel: login,
        parent,
        muted: 'false'
    });

    return `https://player.twitch.tv/?${params.toString()}`;
};

export const pickMatchStreamLogin = (match, liveLogins = new Set()) => {
    const candidates = [
        match.commentatorStreamLogin,
        match.streamLogin,
        match.team1TwitchLogin,
        match.team2TwitchLogin
    ]
        .map((value) => extractTwitchLogin(value))
        .filter(Boolean);

    const liveCandidate = candidates.find((login) => liveLogins.has(login));
    return liveCandidate || candidates[0] || null;
};
