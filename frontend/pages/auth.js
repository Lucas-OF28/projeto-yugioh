const TOKEN_KEY    = 'yugioh_token';
const DASHBOARD    = '/pages/verCartas.html';
const LANDING      = '/';

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

function _esc(str) {
    return String(str).replace(/[&<>"']/g, m =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]
    );
}

async function initHeader() {
    const headerInner = document.querySelector('.header-inner');
    if (!headerInner) return;

    const authDiv = document.createElement('div');
    authDiv.className = 'header-auth';
    headerInner.appendChild(authDiv);

    const token = getToken();
    if (!token) {
        authDiv.innerHTML = `<a href="${LANDING}" class="btn btn-secondary btn-sm">Entrar</a>`;
        return;
    }

    try {
        const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            removeToken();
            authDiv.innerHTML = `<a href="${LANDING}" class="btn btn-secondary btn-sm">Entrar</a>`;
            return;
        }
        const user = await res.json();
        authDiv.innerHTML = `
            <span class="header-username">&#128100; ${_esc(user.username)}</span>
            <button class="btn btn-secondary btn-sm" onclick="logout()">Sair</button>
        `;
    } catch {
        authDiv.innerHTML = `<a href="${LANDING}" class="btn btn-secondary btn-sm">Entrar</a>`;
    }
}

document.addEventListener('DOMContentLoaded', initHeader);
