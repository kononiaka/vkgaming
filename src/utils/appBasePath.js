const normalizePath = (value) => String(value || '').replace(/\/$/, '');

export const getAppBasePath = () => {
    const publicUrl = process.env.PUBLIC_URL || '';

    if (!publicUrl || publicUrl === '.') {
        return '';
    }

    if (/^https?:\/\//i.test(publicUrl)) {
        try {
            return normalizePath(new URL(publicUrl).pathname);
        } catch {
            return '';
        }
    }

    return normalizePath(publicUrl.startsWith('/') ? publicUrl : `/${publicUrl}`);
};

export const getTwitchRedirectUri = () =>
    `${window.location.origin}${getAppBasePath()}/auth/twitch/callback`;

export const getAppHashUrl = (hashPath = '/') => {
    const normalized = hashPath.startsWith('/') ? hashPath : `/${hashPath}`;
    return `${window.location.origin}${getAppBasePath()}/#${normalized}`;
};

export const isTwitchCallbackPath = (pathname = window.location.pathname) =>
    pathname.endsWith('/auth/twitch/callback');
