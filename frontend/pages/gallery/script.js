if (!requireLogin()) throw new Error('not auth');
initSidebar('gallery', 'Minhas Cartas');

const API = '/api/cartas';

let allCards      = [];
let activeFilter  = 'TODOS';
let activeAttr    = 'TODOS';
let activeSort    = 'recente';
let activeFavOnly = false;
let favorites     = new Set(JSON.parse(localStorage.getItem('ygo-favorites') || '[]'));
let selectMode    = false;
let selectedIds   = new Set();

function buildCardHTML(carta) {
    const isFav      = favorites.has(carta.id);
    const isAuth     = !!getToken();
    const isSelected = selectedIds.has(carta.id);
    const checkboxHtml = selectMode
        ? `<label class="card-checkbox" onclick="event.stopPropagation()">
               <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelect(${carta.id}, this.checked)">
           </label>`
        : '';
    return `
    <div class="card-wrapper${isSelected ? ' card-selected' : ''}" data-id="${carta.id}">
        ${checkboxHtml}
        ${buildYgoCard(carta, { clickable: !selectMode })}
        <div class="card-actions">
            <button class="btn-fav${isFav ? ' active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${carta.id})" title="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">★</button>
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); baixarCarta(${carta.id})">↓ Baixar</button>
            ${isAuth ? `
            <a href="/pages/card-form/?id=${carta.id}"    class="btn btn-secondary btn-sm" onclick="event.stopPropagation()">Editar</a>
            <a href="/pages/card-form/?clone=${carta.id}" class="btn btn-secondary btn-sm" onclick="event.stopPropagation()">Clonar</a>
            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deletar(${carta.id}, '${esc(carta.nome)}')">Deletar</button>
            ` : ''}
        </div>
    </div>`;
}

function toggleSelectMode() {
    selectMode = !selectMode;
    selectedIds.clear();
    const btn = document.getElementById('selectModeBtn');
    const bar = document.getElementById('batchBar');
    btn.textContent = selectMode ? '✕ Cancelar' : '☑ Selecionar';
    btn.classList.toggle('active', selectMode);
    bar.style.display = selectMode ? 'flex' : 'none';
    renderCards();
}

function toggleSelect(id, checked) {
    if (checked) selectedIds.add(id);
    else selectedIds.delete(id);
    updateBatchCount();
    const wrapper = document.querySelector(`.card-wrapper[data-id="${id}"]`);
    if (wrapper) wrapper.classList.toggle('card-selected', checked);
}

function updateBatchCount() {
    document.getElementById('batchCount').textContent =
        `${selectedIds.size} selecionada${selectedIds.size !== 1 ? 's' : ''}`;
}

function selectAll()   { getFiltered().forEach(c => selectedIds.add(c.id)); updateBatchCount(); renderCards(); }
function deselectAll() { selectedIds.clear(); updateBatchCount(); renderCards(); }

function exportarJSONSelecionadas() {
    const sel = allCards.filter(c => selectedIds.has(c.id));
    if (!sel.length) { alert('Nenhuma carta selecionada.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(sel, null, 2)], { type: 'application/json' }));
    a.download = `cartas-selecionadas-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
}

async function deletarSelecionadas() {
    if (!selectedIds.size) { alert('Nenhuma carta selecionada.'); return; }
    const n = selectedIds.size;
    if (!confirm(`Deletar ${n} carta${n !== 1 ? 's' : ''} selecionada${n !== 1 ? 's' : ''}? Esta ação não pode ser desfeita.`)) return;
    let erros = 0;
    for (const id of [...selectedIds]) {
        try {
            const res = await authFetch(`${API}/${id}`, { method: 'DELETE' });
            if (res && res.ok) allCards = allCards.filter(c => c.id !== id);
            else erros++;
        } catch { erros++; }
    }
    selectedIds.clear(); updateBatchCount(); renderStats(); renderCards();
    if (erros) alert(`${erros} carta(s) não puderam ser deletadas.`);
}

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

function renderStats() {
    document.getElementById('statTotal').textContent      = allCards.length;
    document.getElementById('statMonstros').textContent   = allCards.filter(c => c.tipo === 'MONSTRO').length;
    document.getElementById('statMagias').textContent     = allCards.filter(c => c.tipo === 'MAGIA').length;
    document.getElementById('statArmadilhas').textContent = allCards.filter(c => c.tipo === 'ARMADILHA').length;
}

async function loadCards() {
    if (!requireLogin()) return;
    try {
        const res = await authFetch(API);
        if (!res || !res.ok) throw new Error();
        allCards = await res.json();
        renderStats(); renderCards();
    } catch {
        document.getElementById('cardsGrid').innerHTML =
            '<div class="error-msg">Erro ao carregar cartas. Verifique se o servidor está rodando.</div>';
    }
}

function renderCards() {
    const grid     = document.getElementById('cardsGrid');
    const filtered = getFiltered();
    const total = allCards.length;
    const shown = filtered.length;
    document.getElementById('cardCounter').textContent =
        shown === total ? `${total} carta${total !== 1 ? 's' : ''}` : `${shown} de ${total} carta${total !== 1 ? 's' : ''}`;
    document.getElementById('attrFilters').style.display = activeFilter === 'MONSTRO' ? 'flex' : 'none';
    grid.innerHTML = filtered.length
        ? filtered.map(buildCardHTML).join('')
        : '<div class="empty">Nenhuma carta encontrada.</div>';
}

function openModal(id) {
    const carta  = allCards.find(c => c.id === id);
    if (!carta) return;
    const isAuth = !!getToken();
    document.getElementById('modalCardContainer').innerHTML = buildYgoCard(carta);
    document.getElementById('modalEditBtn').href  = `/pages/card-form/?id=${id}`;
    document.getElementById('modalCloneBtn').href = `/pages/card-form/?clone=${id}`;
    document.getElementById('modalDlBtn').onclick  = () => baixarCartaModal(id);
    document.getElementById('modalDelBtn').onclick = () => { closeModal(); deletar(id, carta.nome); };
    document.getElementById('modalEditBtn').style.display  = isAuth ? '' : 'none';
    document.getElementById('modalCloneBtn').style.display = isAuth ? '' : 'none';
    document.getElementById('modalDelBtn').style.display   = isAuth ? '' : 'none';
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

async function renderCartaOffscreen(carta, scale = 3) {
    const tmp = document.createElement('div');
    tmp.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none;';
    tmp.innerHTML = buildYgoCard(carta);
    const shine = tmp.querySelector('.card-shine');
    if (shine) shine.style.display = 'none';
    document.body.appendChild(tmp);
    try {
        return await html2canvas(tmp.querySelector('.ygo-card'), {
            scale, useCORS: true, allowTaint: false, logging: false, backgroundColor: null,
        });
    } finally { document.body.removeChild(tmp); }
}

function nomeArquivo(carta) {
    return (carta?.nome || 'carta').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
}

async function baixarCartaModal(id) {
    const carta = allCards.find(c => c.id === id);
    if (!carta) return;
    try {
        const canvas = await renderCartaOffscreen(carta, 3);
        const a = document.createElement('a');
        a.download = `${nomeArquivo(carta)}.png`; a.href = canvas.toDataURL('image/png'); a.click();
    } catch { alert('Não foi possível baixar.'); }
}

async function baixarCarta(id) {
    const carta = allCards.find(c => c.id === id);
    if (!carta) return;
    try {
        const canvas = await renderCartaOffscreen(carta, 3);
        const a = document.createElement('a');
        a.download = `${nomeArquivo(carta)}.png`; a.href = canvas.toDataURL('image/png'); a.click();
    } catch { alert('Não foi possível baixar.'); }
}

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

async function deletar(id, nome) {
    const confirmed = await showDeletePopup(nome);
    if (!confirmed) return;
    try {
        const res = await authFetch(`${API}/${id}`, { method: 'DELETE' });
        if (res && res.ok) { allCards = allCards.filter(c => c.id !== id); renderStats(); renderCards(); }
        else if (res) alert('Erro ao deletar carta.');
    } catch { alert('Erro de conexão.'); }
}

function toggleFavorite(id) {
    if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
    localStorage.setItem('ygo-favorites', JSON.stringify([...favorites]));
    renderCards();
}

function exportarJSON() {
    if (!allCards.length) { alert('Nenhuma carta para exportar.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(allCards, null, 2)], { type: 'application/json' }));
    a.download = `colecao-yugioh-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
}

async function exportarPDF() {
    const filtered = getFiltered();
    if (!filtered.length) { alert('Nenhuma carta para exportar.'); return; }
    if (filtered.length > 30 && !confirm(`Serão exportadas ${filtered.length} cartas. Pode demorar. Continuar?`)) return;
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
            const col = i % COLS, row = Math.floor(i / COLS) % ROWS;
            tmp.innerHTML = buildYgoCard(filtered[i]);
            const shine = tmp.querySelector('.card-shine');
            if (shine) shine.style.display = 'none';
            btn.textContent = `PDF... ${i + 1}/${filtered.length}`;
            const canvas = await html2canvas(tmp.querySelector('.ygo-card'), {
                scale: 2, useCORS: true, allowTaint: false, logging: false, backgroundColor: null,
            });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', ML + col * (W + GX), MT + row * (H + GY), W, H);
        }
        pdf.save(`colecao-yugioh-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
        document.body.removeChild(tmp);
        btn.disabled = false; btn.textContent = '↓ PDF';
    }
}

document.querySelectorAll('.filter-btn:not(#favFilterBtn)').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.filter-btn:not(#favFilterBtn)').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        activeFilter = this.dataset.filter;
        activeAttr = 'TODOS';
        document.querySelectorAll('.attr-btn').forEach(b => b.classList.toggle('active', b.dataset.attr === 'TODOS'));
        renderCards();
    });
});
document.querySelectorAll('.attr-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.attr-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active'); activeAttr = this.dataset.attr; renderCards();
    });
});
document.getElementById('sortSelect').addEventListener('change', function () { activeSort = this.value; renderCards(); });
document.getElementById('searchInput').addEventListener('input', renderCards);
document.getElementById('favFilterBtn').addEventListener('click', function () {
    activeFavOnly = !activeFavOnly; this.classList.toggle('active', activeFavOnly); renderCards();
});
document.getElementById('modalOverlay').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

loadCards();

(function initModalTilt() {
    const wrapper = document.querySelector('.modal-card-scale-wrapper');
    function getCard() { return wrapper.querySelector('.ygo-card'); }
    function applyTilt(cx, cy) {
        const card = getCard(); if (!card) return;
        const rect = wrapper.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (cx - (rect.left + rect.width / 2)) / (rect.width / 2)));
        const dy = Math.max(-1, Math.min(1, (cy - (rect.top + rect.height / 2)) / (rect.height / 2)));
        card.style.transition = 'none';
        card.style.transform  = `scale(1.5) perspective(600px) rotateX(${-dy * 16}deg) rotateY(${dx * 22}deg)`;
        const shine = card.querySelector('.card-shine');
        if (shine) {
            shine.classList.add('card-shine--tracking');
            shine.style.backgroundPosition = `${((dx+1)/2)*100}% ${((dy+1)/2)*100}%`;
            shine.style.opacity = Math.min(0.25 + Math.abs(dx) * 0.45 + Math.abs(dy) * 0.30, 0.85).toFixed(2);
        }
    }
    function resetTilt() {
        const card = getCard(); if (!card) return;
        card.style.transition = 'transform 0.65s cubic-bezier(0.23, 1, 0.32, 1)';
        card.style.transform  = 'scale(1.5)';
        const shine = card.querySelector('.card-shine');
        if (shine) { shine.classList.remove('card-shine--tracking'); shine.style.opacity = ''; shine.style.backgroundPosition = ''; }
    }
    wrapper.addEventListener('mousemove',  e => applyTilt(e.clientX, e.clientY));
    wrapper.addEventListener('mouseleave', resetTilt);
    wrapper.addEventListener('touchmove', e => { e.preventDefault(); applyTilt(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    wrapper.addEventListener('touchend',   resetTilt);
    wrapper.addEventListener('touchcancel', resetTilt);
})();
