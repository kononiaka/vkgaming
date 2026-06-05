/**
 * Firebase RTDB REST writes with ID token (?auth=) for secured rules.
 */
export const getAuthToken = () => localStorage.getItem('token') || '';

export const withAuthQuery = (url) => {
    const token = getAuthToken();
    if (!token) {
        return url;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}auth=${encodeURIComponent(token)}`;
};

export const authFetch = (url, options = {}) => fetch(withAuthQuery(url), options);
