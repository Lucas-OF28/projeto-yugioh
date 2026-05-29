if (!requireLogin()) throw new Error('not auth');
initSidebar('dashboard', 'Dashboard');

function pct(n, total) {
    return total ? `${Math.round(n / total * 100)}% do total` : '–';
}

function buildDeckCoverHTML(deck, cards) {
    if (deck.capa) {
        return `<img class="deck-mini-cover-img" src="${_esc(deck.capa)}" alt="Capa" onerror="this.parentElement.innerHTML='<div class=deck-mini-cover-placeholder>📁</div>'">`;
    }
    const unique   = [...new Set(deck.principal || [])].slice(0, 4);
    const wImages  = unique.map(id => cards.find(c => c.id === id)).filter(c => c?.imagem);
    if (!wImages.length) {
        return `<div class="deck-mini-cover-placeholder">📁</div>`;
    }
    const cnt = Math.min(wImages.length, 4);
    const cls = ['', 'one', 'two', 'three', ''][cnt] || '';
    return `<div class="deck-mini-cover-collage ${cls}">
        ${wImages.slice(0, cnt).map(c =>
            `<img src="${_esc(c.imagem)}" alt="" onerror="this.style.display='none'">`
        ).join('')}
    </div>`;
}

function _esc(str) {
    return String(str || '').replace(/[&<>"']/g, m =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

function typeIcon(tipo) {
    return tipo === 'MONSTRO' ? '👹' : tipo === 'MAGIA' ? '✨' : '⚡';
}

function typeBadge(tipo) {
    const cls = tipo === 'MONSTRO' ? 'monstro' : tipo === 'MAGIA' ? 'magia' : 'armadilha';
    const label = tipo === 'MONSTRO' ? 'Monstro' : tipo === 'MAGIA' ? 'Magia' : 'Armadilha';
    return `<span class="mini-card-badge badge-${cls}">${label}</span>`;
}

function bgColorForType(tipo) {
    const m = { MONSTRO: 'rgba(232,160,32,.2)', MAGIA: 'rgba(26,170,90,.2)', ARMADILHA: 'rgba(170,26,138,.2)' };
    return m[tipo] || 'rgba(255,255,255,.05)';
}

function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (d > 0) return `${d}d atrás`;
    if (h > 0) return `${h}h atrás`;
    return 'Agora';
}

function dateFmt(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

async function loadDashboard() {
    const [resC, resD] = await Promise.all([
        authFetch('/api/cartas'),
        authFetch('/api/decks'),
    ]);

    const cartas = resC ? await resC.json() : [];
    const decks  = resD ? await resD.json() : [];

    const monstros   = cartas.filter(c => c.tipo === 'MONSTRO');
    const magias     = cartas.filter(c => c.tipo === 'MAGIA');
    const armadilhas = cartas.filter(c => c.tipo === 'ARMADILHA');
    const total      = cartas.length;

    // Stats
    document.getElementById('sTotal').textContent       = total;
    document.getElementById('sTotalSub').textContent    = '100% da coleção';
    document.getElementById('sMonstros').textContent    = monstros.length;
    document.getElementById('sMonstrosSub').textContent = pct(monstros.length, total);
    document.getElementById('sMagias').textContent      = magias.length;
    document.getElementById('sMagiasSub').textContent   = pct(magias.length, total);
    document.getElementById('sArmadilhas').textContent  = armadilhas.length;
    document.getElementById('sArmadilhasSub').textContent = pct(armadilhas.length, total);
    document.getElementById('sDecks').textContent  = decks.length;
    document.getElementById('sDecksSub').textContent = decks.length ? `Último: ${timeAgo(decks[0]?.criado_em)}` : 'Nenhum';

    // Últimas cartas (6 mais recentes)
    const rcEl = document.getElementById('recentCards');
    const recent = [...cartas].sort((a, b) => b.id - a.id).slice(0, 6);
    if (!recent.length) {
        rcEl.innerHTML = `<div class="empty-panel">Nenhuma carta criada ainda.<br><a href="/pages/card-form/" style="color:var(--gold)">Criar primeira →</a></div>`;
    } else {
        rcEl.innerHTML = recent.map(c => {
            const bg = c.imagem
                ? `background-image:url('${_esc(c.imagem)}');background-color:#000`
                : `background-color:${bgColorForType(c.tipo)}`;
            const icon = c.imagem ? '' : typeIcon(c.tipo);
            return `
            <a class="mini-card" href="/pages/gallery/" title="${_esc(c.nome)}">
                <div class="mini-card-img" style="${bg}">${icon}</div>
                <div class="mini-card-info">
                    <div class="mini-card-name">${_esc(c.nome)}</div>
                    ${typeBadge(c.tipo)}
                </div>
            </a>`;
        }).join('');
    }

    // Meus Decks (4 mais recentes + novo)
    const rdEl = document.getElementById('recentDecks');
    const recentDecks = decks.slice(0, 4);
    const newBtn = `<a href="/pages/decks/?id=novo" class="deck-mini-card new-deck"><span class="plus">＋</span><span>Novo Deck</span></a>`;
    if (!recentDecks.length) {
        rdEl.innerHTML = newBtn;
    } else {
        rdEl.innerHTML = recentDecks.map(d => `
            <a href="/pages/decks/?id=${d.id}" class="deck-mini-card">
                <div class="deck-mini-cover">${buildDeckCoverHTML(d, cartas)}</div>
                <div class="deck-mini-info">
                    <div class="deck-mini-name">${_esc(d.nome)}</div>
                    <div class="deck-mini-counts">${(d.principal?.length || 0)} + ${(d.extra?.length || 0)} + ${(d.side?.length || 0)} cartas</div>
                </div>
            </a>`).join('') + newBtn;
    }

    // Atividade recente (5 cartas por data de criação)
    const actEl = document.getElementById('recentActivity');
    const byDate = [...cartas].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em)).slice(0, 6);
    if (!byDate.length) {
        actEl.innerHTML = '<div class="empty-panel">Nenhuma atividade ainda.</div>';
    } else {
        actEl.innerHTML = byDate.map(c => `
            <div class="activity-item">
                <div class="activity-icon" style="background:${bgColorForType(c.tipo)}">${typeIcon(c.tipo)}</div>
                <div class="activity-text">
                    <div class="activity-title">Carta "${_esc(c.nome)}" criada</div>
                    <div class="activity-time">${dateFmt(c.criado_em)}, ${new Date(c.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div class="activity-time-col">${timeAgo(c.criado_em)}</div>
            </div>`).join('');
    }

    // Estatísticas rápidas
    const qsEl = document.getElementById('quickStats');
    const topATK = monstros.filter(c => c.ataque != null).sort((a, b) => b.ataque - a.ataque)[0];
    const topType = total
        ? [['Monstros', monstros.length], ['Magias', magias.length], ['Armadilhas', armadilhas.length]]
              .sort((a, b) => b[1] - a[1])[0][0]
        : '–';
    const rareCards = cartas.filter(c => c.raridade && c.raridade !== 'Comum');
    const topRare   = cartas.filter(c => c.raridade === 'Holografica')[0]
                   || cartas.filter(c => c.raridade === 'Super Rara')[0]
                   || rareCards[0];
    const totalATK  = monstros.reduce((s, c) => s + (c.ataque || 0), 0);
    const firstCard = cartas.length ? [...cartas].sort((a, b) => a.id - b.id)[0] : null;
    const diasUso   = firstCard
        ? Math.ceil((Date.now() - new Date(firstCard.criado_em).getTime()) / 86400000)
        : 0;

    qsEl.innerHTML = [
        ['⭐', 'Carta mais forte', topATK ? `${_esc(topATK.nome)} (${topATK.ataque} ATK)` : '–'],
        ['🏆', 'Tipo mais criado', topType],
        ['💎', 'Carta mais rara',  topRare ? _esc(topRare.nome) : '–'],
        ['⚔️', 'Total de ATK',    totalATK.toLocaleString('pt-BR')],
        ['📅', 'Dias usando',      diasUso > 0 ? `${diasUso} dia${diasUso !== 1 ? 's' : ''}` : '–'],
        ['🃏', 'Média ATK',        monstros.filter(c => c.ataque != null).length
            ? Math.round(monstros.reduce((s, c) => s + (c.ataque || 0), 0) / monstros.filter(c => c.ataque != null).length)
            : '–'],
    ].map(([icon, label, val]) => `
        <div class="quick-stat-item">
            <span class="quick-stat-icon">${icon}</span>
            <div>
                <div class="quick-stat-label">${label}</div>
                <div class="quick-stat-val">${val}</div>
            </div>
        </div>`).join('');
}

// FAB
function toggleFab() {
    const btn  = document.getElementById('fabBtn');
    const menu = document.getElementById('fabMenu');
    btn.classList.toggle('open');
    menu.classList.toggle('open');
}

document.addEventListener('click', e => {
    if (!document.getElementById('fab')?.contains(e.target)) {
        document.getElementById('fabBtn')?.classList.remove('open');
        document.getElementById('fabMenu')?.classList.remove('open');
    }
});

loadDashboard();
