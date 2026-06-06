/**
 * Firebase RTDB REST writes with ID token (?auth=) for secured rules.
 */
export const getAuthToken = () => localStorage.getItem('token') || '';

export const getFirebaseUid = () => {
    const stored = localStorage.getItem('firebaseUid');
    if (stored) {
        return stored;
    }

    const token = getAuthToken();
    if (!token) {
        return null;
    }

    try {
        const payload = token.split('.')[1];
        if (!payload) {
            return null;
        }

        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(atob(normalized));
        return decoded.user_id || decoded.sub || null;
    } catch {
        return null;
    }
};

export const withAuthQuery = (url) => {
    const token = getAuthToken();
    if (!token) {
        return url;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}auth=${encodeURIComponent(token)}`;
};

export const authFetch = (url, options = {}) => fetch(withAuthQuery(url), options);
