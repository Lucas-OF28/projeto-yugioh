// Injetor de sidebar e top-bar compartilhado entre todas as páginas autenticadas

const _NAV = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard',      href: '/pages/dashboard/' },
    { id: 'gallery',   icon: '🃏', label: 'Cartas',          href: '/pages/gallery/' },
    { id: 'decks',     icon: '📁', label: 'Decks',           href: '/pages/decks/' },
    { id: 'stats',     icon: '📊', label: 'Estatísticas',    href: '/pages/stats/' },
];
const _TOOLS = [
    { id: 'card-form', icon: '✏️', label: 'Nova Carta',      href: '/pages/card-form/' },
];

function _navItems(list, active) {
    return list.map(item => `
        <a href="${item.href}" class="nav-item${item.id === active ? ' active' : ''}">
            <span class="nav-icon">${item.icon}</span>
            <span>${item.label}</span>
        </a>`).join('');
}

function initSidebar(activePage, pageTitle) {
    document.body.classList.add('has-sidebar');

    // Backdrop para mobile
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    backdrop.id = 'sidebarBackdrop';
    backdrop.onclick = () => closeSidebar();
    document.body.appendChild(backdrop);

    // Sidebar
    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.id = 'appSidebar';
    sidebar.innerHTML = `
        <div class="sidebar-logo">
            <div class="sidebar-logo-title">YU-GI-OH!</div>
            <div class="sidebar-logo-sub">Card Generator</div>
        </div>
        <nav class="sidebar-nav">
            <div class="sidebar-section-label">Principal</div>
            ${_navItems(_NAV, activePage)}
            <div class="sidebar-section-label" style="margin-top:.5rem">Ferramentas</div>
            ${_navItems(_TOOLS, activePage)}
        </nav>
        <div class="sidebar-footer" id="sidebarVer">Yu-Gi-Oh! Card Generator v1.0.0</div>
    `;
    document.body.insertBefore(sidebar, document.body.firstChild);

    // Main wrapper (envolve o conteúdo já existente)
    const existing = [...document.body.children].filter(el => !el.classList.contains('sidebar') && !el.classList.contains('sidebar-backdrop'));
    const mainWrapper = document.createElement('div');
    mainWrapper.className = 'main-wrapper';

    // Top bar
    const topBar = document.createElement('div');
    topBar.className = 'top-bar';
    topBar.innerHTML = `
        <button class="sidebar-toggle" onclick="toggleSidebar()" title="Menu">&#9776;</button>
        <span class="top-bar-title">${pageTitle || ''}</span>
        <div class="user-pill">
            <div class="user-avatar-pill" id="topUserAvatar">?</div>
            <span class="user-pill-name" id="topUsername">…</span>
            <button class="btn btn-secondary btn-sm" onclick="logout()">Sair</button>
        </div>
    `;
    mainWrapper.appendChild(topBar);

    existing.forEach(el => mainWrapper.appendChild(el));
    document.body.appendChild(mainWrapper);

    _loadTopUser();
}

async function _loadTopUser() {
    const token = getToken();
    if (!token) return;
    try {
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const user = await res.json();
        const nameEl = document.getElementById('topUsername');
        const avatarEl = document.getElementById('topUserAvatar');
        if (nameEl) nameEl.textContent = user.username;
        if (avatarEl) avatarEl.textContent = user.username[0].toUpperCase();

        const welcomeEl = document.getElementById('welcomeName');
        if (welcomeEl) welcomeEl.textContent = user.username;
    } catch {}
}

function toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const bd = document.getElementById('sidebarBackdrop');
    const open = sidebar.classList.toggle('sidebar--open');
    bd.classList.toggle('active', open);
}

function closeSidebar() {
    document.getElementById('appSidebar')?.classList.remove('sidebar--open');
    document.getElementById('sidebarBackdrop')?.classList.remove('active');
}
