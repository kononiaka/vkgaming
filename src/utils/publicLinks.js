export const normalizeSocialUrl = (rawValue, platform) => {
    if (!rawValue) {
        return null;
    }

    const value = String(rawValue).trim();
    if (!value) {
        return null;
    }

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    const cleaned = value.replace(/^@/, '');

    if (platform === 'telegram') {
        return `https://t.me/${cleaned}`;
    }

    if (platform === 'twitch') {
        return `https://www.twitch.tv/${cleaned.replace(/^www\.twitch\.tv\//i, '').replace(/^twitch\.tv\//i, '')}`;
    }

    if (platform === 'youtube') {
        if (value.startsWith('@')) {
            return `https://www.youtube.com/${value}`;
        }
        return `https://www.youtube.com/${cleaned}`;
    }

    return null;
};

export const buildPublicLinks = (player) => {
    const source = player && typeof player === 'object' ? player : {};

    return [
        {
            key: 'telegram',
            label: 'Telegram',
            value: source.telegram,
            href: normalizeSocialUrl(source.telegram, 'telegram')
        },
        {
            key: 'twitch',
            label: 'Twitch',
            value: source.twitch,
            href: normalizeSocialUrl(source.twitch, 'twitch')
        },
        {
            key: 'youtube',
            label: 'YouTube',
            value: source.youtube,
            href: normalizeSocialUrl(source.youtube, 'youtube')
        }
    ].filter((entry) => entry.value && entry.href);
};

export const PUBLIC_LINK_FIELDS = [
    {
        key: 'telegram',
        label: 'Telegram',
        placeholder: '@username or t.me/username'
    },
    {
        key: 'twitch',
        label: 'Twitch',
        placeholder: 'twitch.tv/username'
    },
    {
        key: 'youtube',
        label: 'YouTube',
        placeholder: '@channel or youtube.com/...'
    }
];
