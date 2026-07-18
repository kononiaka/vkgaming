const normalizePath = (value) => String(value || '').replace(/\/$/, '');

export const DEFAULT_GITHUB_PAGES_SITE = 'https://kononiaka.github.io';
export const DEFAULT_CUSTOM_DOMAIN_SITE = 'https://konoplay.com';

const isLocalhostUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(String(url || ''));

export const getAppBasePath = () => {
    const publicUrl = process.env.PUBLIC_URL || '';

    if (!publicUrl || publicUrl === '.' || publicUrl === 'undefined') {
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

/**
 * Prefer the live browser origin so a stale REACT_APP_SITE_URL (e.g. github.io)
 * cannot hijack post-login redirects when the app is opened on konoplay.com.
 */
export const getSiteBaseUrl = () => {
    if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${getAppBasePath()}`;
    }

    const configuredSite = normalizePath(process.env.REACT_APP_SITE_URL);
    if (configuredSite && !isLocalhostUrl(configuredSite)) {
        return configuredSite;
    }

    return DEFAULT_CUSTOM_DOMAIN_SITE;
};

export const getTwitchRedirectUri = () => {
    if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${getAppBasePath()}/auth/twitch/callback`;
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

/** Production site for local-dev warnings / docs. */
export const DEFAULT_PRODUCTION_SITE = DEFAULT_CUSTOM_DOMAIN_SITE;
