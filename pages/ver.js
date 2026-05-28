const API = '/api/cartas';

// ── Constantes ─────────────────────────────────────────────────
const ATTR_CLASS = {
    'FOGO':'attr-fogo','ÁGUA':'attr-agua','TERRA':'attr-terra',
    'VENTO':'attr-vento','LUZ':'attr-luz','TREVAS':'attr-trevas','DIVINO':'attr-divino'
};
const CARD_CLASS = {
    'Normal':'monstro-normal','Efeito':'monstro-efeito','Ritual':'monstro-ritual',
    'Fusão':'monstro-fusao','Sincro':'monstro-sincro','XYZ':'monstro-xyz',
    'Pêndulo':'monstro-pendulo','Link':'monstro-link'
};
const ARROW_SYM   = { NW:'↖',N:'↑',NE:'↗',W:'←',E:'→',SW:'↙',S:'↓',SE:'↘' };
const ARROW_ORDER = ['NW','N','NE','W',null,'E','SW','S','SE'];

// ── Estado ─────────────────────────────────────────────────────
let allCards     = [];
let activeFilter = 'TODOS';
let activeAttr   = 'TODOS';
let activeSort   = 'recente';
let activeFavOnly = false;
let favorites    = new Set(JSON.parse(localStorage.getItem('ygo-favorites') || '[]'));

// ── Helpers ────────────────────────────────────────────────────
function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function getCardClass(tipo, subtipo) {
    if (tipo === 'MAGIA') return 'magia';
    if (tipo === 'ARMADILHA') return 'armadilha';
    return CARD_CLASS[subtipo] || 'monstro-efeito';
}

function buildLinkArrowsMini(setasStr) {
    const active = setasStr ? setasStr.split(',') : [];
    return '<div class="link-arrows-mini">' +
        ARROW_ORDER.map(dir => {
            if (!dir) return '<div class="link-arrow-mini-cell"></div>';
            return `<div class="link-arrow-mini-cell${active.includes(dir) ? ' active' : ''}">${ARROW_SYM[dir]}</div>`;
        }).join('') + '</div>';
}

// ── Constrói o elemento .ygo-card (sem wrapper) ─────────────────
function buildYgoCardHTML(carta) {
    const subtipo   = carta.tipo_efeito || 'Efeito';
    const cardClass = getCardClass(carta.tipo, subtipo);
    const isLink    = subtipo === 'Link';
    const isPendulo = subtipo === 'Pêndulo';
    const isXYZ     = subtipo === 'XYZ';
    const isNormal  = subtipo === 'Normal';
    const isMonstro = carta.tipo === 'MONSTRO';

    const attrClass = ATTR_CLASS[carta.atributo] || '';
    const attrLabel = carta.atributo ? carta.atributo.substring(0, 3) : '';

    const imageContent = carta.imagem
        ? `<img src="${esc(carta.imagem)}" alt="${esc(carta.nome)}" crossorigin="anonymous" onerror="this.parentElement.innerHTML='<span class=card-no-img>?</span>'" />`
        : '<span class="card-no-img">?</span>';

    let starsHTML = '';
    if (isMonstro && !isLink) {
        const count = Math.min(Number(carta.nivel) || 0, 12);
        if (count > 0)
            starsHTML = `<div class="card-stars">${'<span class="star-gem"></span>'.repeat(count)}</div>`;
    }

    let typeText = '';
    if (isMonstro) {
        const t = carta.tipo_monstro || 'Monstro';
        typeText = `[${t}${subtipo && subtipo !== 'Normal' ? '/' + subtipo : ''}]`;
    } else if (carta.tipo === 'MAGIA') {
        typeText = `Carta de Magia${carta.tipo_magia ? ' – ' + carta.tipo_magia : ''}`;
    } else {
        typeText = `Carta de Armadilha${carta.tipo_armadilha ? ' – ' + carta.tipo_armadilha : ''}`;
    }

    const materiaisHTML = isMonstro && ['Fusão','Sincro','XYZ'].includes(subtipo) && carta.materiais
        ? `<div class="card-materials"><p>${esc(carta.materiais)}</p></div>` : '';

    const pendulumHTML = isPendulo ? `
        <div class="card-pendulum-section">
            <div class="pendulum-scale-box">
                <span class="scale-label">ESC</span>
                <span class="scale-num">${carta.escala_esq ?? '?'}</span>
            </div>
            <div class="pendulum-effect-box">
                <p class="pendulum-effect-text">${esc(carta.efeito_pendulo || '')}</p>
            </div>
            <div class="pendulum-scale-box">
                <span class="scale-label">ESC</span>
                <span class="scale-num">${carta.escala_dir ?? '?'}</span>
            </div>
        </div>` : '';

    let statsHTML = '';
    if (isMonstro) {
        statsHTML = isLink
            ? `<div class="card-stats-link">
                   <span>ATK/${carta.ataque ?? '?'}</span>
                   ${buildLinkArrowsMini(carta.setas_link || '')}
                   <span>LINK-${carta.valor_link ?? '?'}</span>
               </div>`
            : `<div class="card-stats">ATK/${carta.ataque ?? '?'} &nbsp; DEF/${carta.defesa ?? '?'}</div>`;
    }

    const descClass = isPendulo ? 'card-description-box compact' : 'card-description-box';
    const descStyle = isNormal ? 'font-style:italic' : '';

    return `
    <div class="ygo-card ${cardClass}" data-id="${carta.id}" onclick="openModal(${carta.id})" style="cursor:pointer">
      <div class="card-inner">
        <div class="card-name-bar">
            <span class="card-name">${esc(carta.nome)}</span>
            ${carta.atributo ? `<span class="card-attribute ${attrClass}">${attrLabel}</span>` : ''}
        </div>
        ${starsHTML}
        <div class="card-image-area">${imageContent}</div>
        ${materiaisHTML}
        <div class="card-type-text">${typeText}</div>
        ${pendulumHTML}
        <div class="${descClass}">
            <p class="card-description" style="${descStyle}">${esc(carta.descricao || '')}</p>
        </div>
        ${statsHTML}
      </div>
    </div>`;
}

// ── Wrapper com botões de ação ──────────────────────────────────
function buildCardHTML(carta) {
    const isFav = favorites.has(carta.id);
    return `
    <div class="card-wrapper">
        ${buildYgoCardHTML(carta)}
        <div class="card-actions">
            <button class="btn-fav${isFav ? ' active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${carta.id})" title="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">★</button>
            <a href="cadastrarCartas.html?id=${carta.id}"    class="btn btn-secondary btn-sm" onclick="event.stopPropagation()">Editar</a>
            <a href="cadastrarCartas.html?clone=${carta.id}" class="btn btn-secondary btn-sm" onclick="event.stopPropagation()">Clonar</a>
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); baixarCarta(${carta.id})">↓ Baixar</button>
            <button class="btn btn-danger btn-sm"    onclick="event.stopPropagation(); deletar(${carta.id}, '${esc(carta.nome)}')">Deletar</button>
        </div>
    </div>`;
}

// ── Filtro + Ordenação ──────────────────────────────────────────
function sortCards(cards) {
    const c = [...cards];
    switch (activeSort) {
        case 'recente':    return c.sort((a, b) => b.id - a.id);
        case 'antigo':     return c.sort((a, b) => a.id - b.id);
        case 'nome-az':    return c.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
        case 'nome-za':    return c.sort((a, b) => b.nome.localeCompare(a.nome, 'pt'));
        case 'nivel-desc': return c.sort((a, b) => (b.nivel ?? -1) - (a.nivel ?? -1));
        case 'nivel-asc':  return c.sort((a, b) => (a.nivel ?? -1) - (b.nivel ?? -1));
        case 'atk-desc':   return c.sort((a, b) => (b.ataque ?? -1) - (a.ataque ?? -1));
        case 'atk-asc':    return c.sort((a, b) => (a.ataque ?? -1) - (b.ataque ?? -1));
        default:           return c;
    }
}

function getFiltered() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    let filtered = allCards;
    if (activeFilter !== 'TODOS') filtered = filtered.filter(c => c.tipo === activeFilter);
    if (activeFilter === 'MONSTRO' && activeAttr !== 'TODOS')
        filtered = filtered.filter(c => c.atributo === activeAttr);
    if (activeFavOnly) filtered = filtered.filter(c => favorites.has(c.id));
    if (search) filtered = filtered.filter(c => c.nome.toLowerCase().includes(search));
    return sortCards(filtered);
}

// ── Carregar e renderizar ───────────────────────────────────────
async function loadCards() {
    try {
        const res = await fetch(API);
        if (!res.ok) throw new Error();
        allCards = await res.json();
        renderCards();
    } catch {
        document.getElementById('cardsGrid').innerHTML =
            '<div class="error-msg">Erro ao carregar cartas. Verifique se o servidor está rodando em http://localhost:3000</div>';
    }
}

function renderCards() {
    const grid     = document.getElementById('cardsGrid');
    const filtered = getFiltered();

    // Contador
    const total = allCards.length;
    const shown = filtered.length;
    document.getElementById('cardCounter').textContent =
        shown === total ? `${total} carta${total !== 1 ? 's' : ''}`
                        : `${shown} de ${total} carta${total !== 1 ? 's' : ''}`;

    // Filtro de atributo — visível só quando filtrando Monstros
    document.getElementById('attrFilters').style.display =
        activeFilter === 'MONSTRO' ? 'flex' : 'none';

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty">Nenhuma carta encontrada.</div>';
        return;
    }
    grid.innerHTML = filtered.map(buildCardHTML).join('');
}

// ── Modal fullscreen ────────────────────────────────────────────
function openModal(id) {
    const carta = allCards.find(c => c.id === id);
    if (!carta) return;

    document.getElementById('modalCardContainer').innerHTML = buildYgoCardHTML(carta);
    document.getElementById('modalEditBtn').href  = `cadastrarCartas.html?id=${id}`;
    document.getElementById('modalCloneBtn').href = `cadastrarCartas.html?clone=${id}`;
    document.getElementById('modalDlBtn').onclick  = () => baixarCartaModal(id);
    document.getElementById('modalDelBtn').onclick = () => { closeModal(); deletar(id, carta.nome); };

    const favBtn = document.getElementById('modalFavBtn');
    const syncFavBtn = () => {
        const f = favorites.has(id);
        favBtn.textContent = f ? '★ Favorito' : '☆ Favorito';
        favBtn.classList.toggle('fav-active', f);
    };
    syncFavBtn();
    favBtn.onclick = () => { toggleFavorite(id); syncFavBtn(); };

    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

async function baixarCartaModal(id) {
    const cardEl = document.querySelector('#modalCardContainer .ygo-card');
    if (!cardEl) return;
    const carta = allCards.find(c => c.id === id);
    const nome = (carta?.nome || 'carta').replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'_');
    const canvas = await html2canvas(cardEl, { scale: 3, useCORS: true, logging: false, backgroundColor: null });
    const a = document.createElement('a');
    a.download = `${nome}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
}

// ── Download individual ─────────────────────────────────────────
async function baixarCarta(id) {
    const cardEl = document.querySelector(`.ygo-card[data-id="${id}"]`);
    if (!cardEl) return;
    const carta = allCards.find(c => c.id === id);
    const nome = (carta?.nome || 'carta').replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'_');
    try {
        const canvas = await html2canvas(cardEl, { scale: 3, useCORS: true, allowTaint: false, logging: false, backgroundColor: null });
        const a = document.createElement('a');
        a.download = `${nome}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
    } catch {
        alert('Não foi possível baixar. Tente usar uma URL de imagem com CORS habilitado.');
    }
}

// ── Deletar ─────────────────────────────────────────────────────
async function deletar(id, nome) {
    if (!confirm(`Deletar a carta "${nome}"?`)) return;
    try {
        const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
        if (res.ok) { allCards = allCards.filter(c => c.id !== id); renderCards(); }
        else alert('Erro ao deletar carta.');
    } catch { alert('Erro de conexão.'); }
}

// ── Favoritos ───────────────────────────────────────────────────
function toggleFavorite(id) {
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    localStorage.setItem('ygo-favorites', JSON.stringify([...favorites]));
    renderCards();
}

// ── Exportar JSON ───────────────────────────────────────────────
function exportarJSON() {
    if (!allCards.length) { alert('Nenhuma carta para exportar.'); return; }
    const blob = new Blob([JSON.stringify(allCards, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `colecao-yugioh-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ── Exportar PDF ────────────────────────────────────────────────
async function exportarPDF() {
    const filtered = getFiltered();
    if (!filtered.length) { alert('Nenhuma carta para exportar.'); return; }
    if (filtered.length > 30 && !confirm(`Serão exportadas ${filtered.length} cartas. Pode demorar alguns minutos. Continuar?`)) return;

    const btn = document.getElementById('exportPDFBtn');
    btn.disabled = true;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // 3 cols × 3 rows = 9 cartas por página
    const COLS = 3, ROWS = 3;
    const W = 60, H = 88, ML = 8, MT = 5, GX = 7, GY = 7;

    const tmp = document.createElement('div');
    tmp.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none;';
    document.body.appendChild(tmp);

    try {
        for (let i = 0; i < filtered.length; i++) {
            if (i > 0 && i % (COLS * ROWS) === 0) pdf.addPage();

            const col = i % COLS;
            const row = Math.floor(i / COLS) % ROWS;
            const x = ML + col * (W + GX);
            const y = MT + row * (H + GY);

            tmp.innerHTML = buildYgoCardHTML(filtered[i]);
            const cardEl = tmp.querySelector('.ygo-card');

            btn.textContent = `PDF... ${i + 1}/${filtered.length}`;

            const canvas = await html2canvas(cardEl, {
                scale: 2, useCORS: true, allowTaint: false, logging: false, backgroundColor: null,
            });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', x, y, W, H);
        }
        pdf.save(`colecao-yugioh-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
        document.body.removeChild(tmp);
        btn.disabled = false;
        btn.textContent = '↓ Exportar PDF';
    }
}

// ── Eventos ─────────────────────────────────────────────────────

// Filtros de tipo
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        activeFilter = this.dataset.filter;
        activeAttr   = 'TODOS';
        document.querySelectorAll('.attr-btn').forEach(b => b.classList.toggle('active', b.dataset.attr === 'TODOS'));
        renderCards();
    });
});

// Filtros de atributo
document.querySelectorAll('.attr-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.attr-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        activeAttr = this.dataset.attr;
        renderCards();
    });
});

// Ordenação
document.getElementById('sortSelect').addEventListener('change', function () {
    activeSort = this.value;
    renderCards();
});

// Busca
document.getElementById('searchInput').addEventListener('input', renderCards);

// Favoritos
document.getElementById('favFilterBtn').addEventListener('click', function () {
    activeFavOnly = !activeFavOnly;
    this.classList.toggle('active', activeFavOnly);
    renderCards();
});

// Modal — fechar ao clicar fora
document.getElementById('modalOverlay').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
});

// Modal — botão fechar
document.getElementById('modalCloseBtn').addEventListener('click', closeModal);

// Modal — tecla Escape
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

loadCards();
