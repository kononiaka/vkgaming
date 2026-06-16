const normalizePath = (value) => String(value || '').replace(/\/$/, '');

export const DEFAULT_GITHUB_PAGES_SITE = 'https://kononiaka.github.io';

const isLocalhostUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(String(url || ''));

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

export const getSiteBaseUrl = () => {
    if (typeof window !== 'undefined') {
        const { hostname, origin } = window.location;

        if (hostname.endsWith('github.io')) {
            return `${origin}${getAppBasePath()}`;
        }

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `${origin}${getAppBasePath()}`;
        }

        const configuredSite = normalizePath(process.env.REACT_APP_SITE_URL);
        if (configuredSite && !isLocalhostUrl(configuredSite)) {
            return configuredSite;
        }

        return `${origin}${getAppBasePath()}`;
    }

    const configuredSite = normalizePath(process.env.REACT_APP_SITE_URL);
    if (configuredSite && !isLocalhostUrl(configuredSite)) {
        return configuredSite;
    }

    return DEFAULT_GITHUB_PAGES_SITE;
};

export const getTwitchRedirectUri = () => {
    if (typeof window !== 'undefined') {
        const { hostname, origin } = window.location;

        if (hostname.endsWith('github.io') || hostname === 'localhost' || hostname === '127.0.0.1') {
            return `${origin}${getAppBasePath()}/auth/twitch/callback`;
        }
    }

    const configuredRedirect = String(process.env.REACT_APP_TWITCH_REDIRECT_URI || '').trim();
    if (configuredRedirect) {
        return configuredRedirect;
    }

    return `${getSiteBaseUrl()}/auth/twitch/callback`;
};

export const getAppHashUrl = (hashPath = '/') => {
    const normalized = hashPath.startsWith('/') ? hashPath : `/${hashPath}`;
    return `${getSiteBaseUrl()}/#${normalized}`;
};

export const isTwitchCallbackPath = (pathname = window.location.pathname) =>
    /\/auth\/twitch\/callback\/?$/.test(pathname);

export const isTwitchOAuthReturn = (search = window.location.search) => {
    const params = new URLSearchParams(search);
    return params.has('code') || params.has('error');
};

export const shouldHandleTwitchOAuth = (pathname = window.location.pathname, search = window.location.search) =>
    isTwitchCallbackPath(pathname) || isTwitchOAuthReturn(search);

/** @deprecated use DEFAULT_GITHUB_PAGES_SITE */
export const DEFAULT_PRODUCTION_SITE = DEFAULT_GITHUB_PAGES_SITE;
