const TOKEN_KEY = 'yugioh_token';
const DASHBOARD  = '/pages/dashboard/';
const LANDING    = '/';

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        removeToken();
        location.href = LANDING;
        return null;
    }
    return res;
}

function requireLogin() {
    if (!getToken()) {
        location.href = LANDING;
        return false;
    }
    return true;
}

function logout() {
    removeToken();
    location.href = LANDING;
}

// Não usado com sidebar (sidebar.js cuida do header), mantido por compatibilidade
async function initHeader() {}
