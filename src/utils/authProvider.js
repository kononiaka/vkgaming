export const resolveAuthProvider = (user) => {
    if (!user || typeof user !== 'object') {
        return null;
    }

    const provider = String(user.authProvider || '')
        .trim()
        .toLowerCase();

    if (provider === 'twitch' || provider === 'youtube') {
        return provider;
    }

    if (user.twitchId) {
        return 'twitch';
    }

    if (user.youtubeId) {
        return 'youtube';
    }

    return null;
};
