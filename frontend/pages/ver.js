const API = '/api/cartas';

// ── Estado ─────────────────────────────────────────────────────
let allCards     = [];
let activeFilter = 'TODOS';
let activeAttr   = 'TODOS';
let activeSort   = 'recente';
let activeFavOnly = false;
let favorites    = new Set(JSON.parse(localStorage.getItem('ygo-favorites') || '[]'));

// ── Wrapper com botões de ação ──────────────────────────────────
function buildCardHTML(carta) {
    const isFav = favorites.has(carta.id);
    return `
    <div class="card-wrapper">
        ${buildYgoCard(carta, { clickable: true })}
        <div class="card-actions">
            <button class="btn-fav${isFav ? ' active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${carta.id})" title="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">★</button>
            <a href="cadastrarCartas.html?id=${carta.id}"    class="btn btn-secondary btn-sm" onclick="event.stopPropagation()">Editar</a>
            <a href="cadastrarCartas.html?clone=${carta.id}" class="btn btn-secondary btn-sm" onclick="event.stopPropagation()">Clonar</a>
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); baixarCarta(${carta.id})">↓ Baixar</button>
            <button class="btn btn-danger btn-sm"    onclick="event.stopPropagation(); deletar(${carta.id}, '${esc(carta.nome)}')">Deletar</button>
        </div>
    </div>`;
}

// ── Ordenação ───────────────────────────────────────────────────
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

// ── Filtros ─────────────────────────────────────────────────────
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

    const total = allCards.length;
    const shown = filtered.length;
    document.getElementById('cardCounter').textContent =
        shown === total ? `${total} carta${total !== 1 ? 's' : ''}`
                        : `${shown} de ${total} carta${total !== 1 ? 's' : ''}`;

    document.getElementById('attrFilters').style.display =
        activeFilter === 'MONSTRO' ? 'flex' : 'none';

    grid.innerHTML = filtered.length
        ? filtered.map(buildCardHTML).join('')
        : '<div class="empty">Nenhuma carta encontrada.</div>';
}

// ── Modal fullscreen ────────────────────────────────────────────
function openModal(id) {
    const carta = allCards.find(c => c.id === id);
    if (!carta) return;

    document.getElementById('modalCardContainer').innerHTML = buildYgoCard(carta);
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

// ── Popup de confirmação de exclusão ───────────────────────────
function showDeletePopup(nome) {
    return new Promise(resolve => {
        document.getElementById('deletePopupCardName').textContent = `"${nome}"`;
        const overlay = document.getElementById('deletePopup');
        const btnConf = document.getElementById('deletePopupConfirm');
        const btnCanc = document.getElementById('deletePopupCancel');

        overlay.classList.add('active');

        const done = result => {
            overlay.classList.remove('active');
            btnConf.removeEventListener('click', onConf);
            btnCanc.removeEventListener('click', onCanc);
            document.removeEventListener('keydown', onKey);
            resolve(result);
        };

        const onConf = () => done(true);
        const onCanc = () => done(false);
        const onKey  = e => { if (e.key === 'Escape') done(false); };

        btnConf.addEventListener('click', onConf, { once: true });
        btnCanc.addEventListener('click', onCanc, { once: true });
        document.addEventListener('keydown', onKey);

        overlay.addEventListener('click', function handler(e) {
            if (e.target === overlay) { overlay.removeEventListener('click', handler); done(false); }
        });
    });
}

// ── Deletar ─────────────────────────────────────────────────────
async function deletar(id, nome) {
    const confirmed = await showDeletePopup(nome);
    if (!confirmed) return;
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
    const COLS = 3, ROWS = 3, W = 60, H = 88, ML = 8, MT = 5, GX = 7, GY = 7;

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

            tmp.innerHTML = buildYgoCard(filtered[i]);
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

document.querySelectorAll('.filter-btn:not(#favFilterBtn)').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.filter-btn:not(#favFilterBtn)').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        activeFilter = this.dataset.filter;
        activeAttr   = 'TODOS';
        document.querySelectorAll('.attr-btn').forEach(b => b.classList.toggle('active', b.dataset.attr === 'TODOS'));
        renderCards();
    });
});

document.querySelectorAll('.attr-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.attr-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        activeAttr = this.dataset.attr;
        renderCards();
    });
});

document.getElementById('sortSelect').addEventListener('change', function () {
    activeSort = this.value;
    renderCards();
});

document.getElementById('searchInput').addEventListener('input', renderCards);

document.getElementById('favFilterBtn').addEventListener('click', function () {
    activeFavOnly = !activeFavOnly;
    this.classList.toggle('active', activeFavOnly);
    renderCards();
});

document.getElementById('modalOverlay').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
});

document.getElementById('modalCloseBtn').addEventListener('click', closeModal);

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

loadCards();

// ── Efeito 3D tilt + brilho no modal ───────────────────
(function initModalTilt() {
    const wrapper = document.querySelector('.modal-card-scale-wrapper');

    function getCard() { return wrapper.querySelector('.ygo-card'); }

    function applyTilt(clientX, clientY) {
        const card = getCard();
        if (!card) return;

        const rect = wrapper.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (clientX - (rect.left + rect.width  / 2)) / (rect.width  / 2)));
        const dy = Math.max(-1, Math.min(1, (clientY - (rect.top  + rect.height / 2)) / (rect.height / 2)));

        const rotY =  dx * 22;
        const rotX = -dy * 16;

        card.style.transition = 'none';
        card.style.transform  = `scale(1.5) perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;

        const shine = card.querySelector('.card-shine');
        if (shine) {
            const px = ((dx + 1) / 2) * 100;
            const py = ((dy + 1) / 2) * 100;
            const intensity = 0.25 + Math.abs(dx) * 0.45 + Math.abs(dy) * 0.30;
            shine.classList.add('card-shine--tracking');
            shine.style.backgroundPosition = `${px}% ${py}%`;
            shine.style.opacity = Math.min(intensity, 0.85).toFixed(2);
        }
    }

    function resetTilt() {
        const card = getCard();
        if (!card) return;

        card.style.transition = 'transform 0.65s cubic-bezier(0.23, 1, 0.32, 1)';
        card.style.transform  = 'scale(1.5)';

        const shine = card.querySelector('.card-shine');
        if (shine) {
            shine.classList.remove('card-shine--tracking');
            shine.style.opacity = '';
            shine.style.backgroundPosition = '';
        }
    }

    wrapper.addEventListener('mousemove',  e => applyTilt(e.clientX, e.clientY));
    wrapper.addEventListener('mouseleave', resetTilt);

    wrapper.addEventListener('touchmove', e => {
        e.preventDefault();
        applyTilt(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    wrapper.addEventListener('touchend',   resetTilt);
    wrapper.addEventListener('touchcancel', resetTilt);
})();
