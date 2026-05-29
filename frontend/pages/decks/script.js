if (!requireLogin()) throw new Error('not auth');
initSidebar('decks', 'Meus Decks');

const EXTRA_SUBTYPES = new Set(['Fusão', 'Sincro', 'XYZ', 'Link']);
const deckId = new URLSearchParams(location.search).get('id');

let allCards    = [];
let deck        = null;
let deckPrincipal = [];
let deckExtra     = [];
let deckSide      = [];

function esc(str) {
    return String(str || '').replace(/[&<>"']/g, m =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

function typeIcon(tipo) {
    return tipo === 'MONSTRO' ? '👹' : tipo === 'MAGIA' ? '✨' : '⚡';
}

// ── Popup de exclusão ────────────────────────────────────
function showDeleteDeckPopup(nome) {
    return new Promise(resolve => {
        document.getElementById('deleteDeckName').textContent = `"${nome}"`;
        const overlay = document.getElementById('deleteDeckPopup');
        const btnConf = document.getElementById('deleteDeckConfirm');
        const btnCanc = document.getElementById('deleteDeckCancel');
        overlay.classList.add('active');
        const done = v => {
            overlay.classList.remove('active');
            btnConf.removeEventListener('click', onY);
            btnCanc.removeEventListener('click', onN);
            resolve(v);
        };
        const onY = () => done(true);
        const onN = () => done(false);
        btnConf.addEventListener('click', onY, { once: true });
        btnCanc.addEventListener('click', onN, { once: true });
    });
}

// ── Capa do deck ─────────────────────────────────────────
function buildCoverHTML(deck, cards) {
    if (deck.capa) {
        return `<img class="deck-cover-img-single" src="${esc(deck.capa)}" alt="Capa" onerror="this.replaceWith(buildCoverPlaceholder())">`;
    }
    const ids     = [...(deck.principal || [])];
    const unique  = [...new Set(ids)].slice(0, 4);
    const wImages = unique.map(id => cards.find(c => c.id === id)).filter(c => c?.imagem);

    if (!wImages.length) return coverPlaceholderHTML();

    const cnt = Math.min(wImages.length, 4);
    const cls = ['', 'one', 'two', 'three', ''][cnt] || '';
    return `<div class="deck-cover-collage ${cls}">
        ${wImages.slice(0, cnt).map(c =>
            `<img src="${esc(c.imagem)}" alt="${esc(c.nome)}" onerror="this.style.display='none'">`
        ).join('')}
    </div>`;
}

function coverPlaceholderHTML() {
    return `<div class="deck-cover-placeholder">📁<span>Sem capa</span></div>`;
}

// ── Lista de decks ───────────────────────────────────────
async function showDeckList() {
    const [resD, resC] = await Promise.all([
        authFetch('/api/decks'),
        authFetch('/api/cartas'),
    ]);
    if (!resD || !resC) return;

    const decks = await resD.json();
    const cards = await resC.json();

    const main = document.getElementById('appMain');
    main.innerHTML = `
    <div class="decks-list-header">
        <a href="/pages/gallery/" class="btn-back">← Minhas Cartas</a>
        <h2>Meus Decks</h2>
        <a href="/pages/decks/?id=novo" class="btn btn-secondary btn-sm">+ Novo Deck</a>
    </div>
    <div class="decks-grid" id="deckGrid"></div>`;

    const grid = document.getElementById('deckGrid');

    if (!decks.length) {
        grid.innerHTML = `
        <div class="decks-empty">
            <p>Você ainda não tem nenhum deck.</p>
            <a href="/pages/decks/?id=novo" class="btn btn-primary">Criar primeiro deck</a>
        </div>`;
        return;
    }

    grid.innerHTML = decks.map(d => {
        const p = d.principal?.length || 0;
        const e = d.extra?.length     || 0;
        const s = d.side?.length      || 0;
        const warnP = p > 0 && (p < 40 || p > 60);
        return `
        <div class="deck-card">
            <div class="deck-cover">${buildCoverHTML(d, cards)}</div>
            <div class="deck-card-body">
                <div class="deck-name">${esc(d.nome)}</div>
                ${d.descricao ? `<div class="deck-desc">${esc(d.descricao)}</div>` : ''}
                <div class="deck-counts">
                    <span class="deck-count-badge ${warnP ? 'warn' : p > 0 ? 'ok' : ''}">
                        Principal: ${p}/60
                    </span>
                    <span class="deck-count-badge${e > 15 ? ' warn' : e > 0 ? ' ok' : ''}">Extra: ${e}/15</span>
                    <span class="deck-count-badge${s > 15 ? ' warn' : ''}">Side: ${s}/15</span>
                </div>
            </div>
            <div class="deck-actions">
                <a href="/pages/decks/?id=${d.id}" class="btn btn-secondary btn-sm">Editar</a>
                <button class="btn btn-danger btn-sm" onclick="deletarDeck(${d.id}, '${esc(d.nome)}')">Deletar</button>
            </div>
        </div>`;
    }).join('');
}

async function deletarDeck(id, nome) {
    const ok = await showDeleteDeckPopup(nome);
    if (!ok) return;
    const res = await authFetch(`/api/decks/${id}`, { method: 'DELETE' });
    if (res && res.ok) showDeckList();
    else alert('Erro ao deletar deck.');
}

// ── Editor de deck ───────────────────────────────────────
async function showEditor() {
    const resC = await authFetch('/api/cartas');
    if (!resC) return;
    allCards = await resC.json();

    if (deckId !== 'novo') {
        const resD = await authFetch(`/api/decks/${deckId}`);
        if (!resD || !resD.ok) { alert('Deck não encontrado.'); location.href = '/pages/decks/'; return; }
        deck         = await resD.json();
        deckPrincipal = [...(deck.principal || [])];
        deckExtra     = [...(deck.extra     || [])];
        deckSide      = [...(deck.side      || [])];
    } else {
        deckPrincipal = []; deckExtra = []; deckSide = [];
    }

    const nome      = deck?.nome || '';
    const desc      = deck?.descricao || '';
    const capaVal   = deck?.capa || '';
    const capaThumb = capaVal
        ? `<img src="${esc(capaVal)}" alt="Capa">`
        : '🖼️';

    document.getElementById('appMain').innerHTML = `
    <div class="page-header" style="max-width:1300px;margin:0 auto;padding:1.25rem 1.5rem;">
        <a href="/pages/decks/" class="btn-back">← Meus Decks</a>
        <h2 style="font-family:'Cinzel',serif;color:var(--gold);font-size:1.2rem;">
            ${deckId === 'novo' ? 'Novo Deck' : 'Editar Deck'}
        </h2>
        <div style="width:80px"></div>
    </div>

    <div class="deck-editor">
        <!-- Painel esquerdo: coleção -->
        <div class="collection-panel">
            <div class="collection-header">Suas Cartas (${allCards.length})</div>
            <div class="collection-search">
                <input type="text" id="collSearch" placeholder="Buscar carta..." oninput="filterCollection()" />
            </div>
            <div class="collection-list" id="collList"></div>
        </div>

        <!-- Painel direito: deck -->
        <div class="deck-panel">
            <div class="deck-panel-header">
                <span class="deck-panel-title">Construtor de Deck</span>
            </div>

            <input type="text" id="deckNameInput" class="deck-name-input"
                placeholder="Nome do deck..." value="${esc(nome)}" maxlength="50" />
            <textarea id="deckDescInput" class="deck-desc-input" rows="2"
                placeholder="Descrição (opcional)..." maxlength="200">${esc(desc)}</textarea>

            <!-- Capa personalizada -->
            <div class="deck-capa-section">
                <div class="deck-capa-preview" id="capaPreview">${capaThumb}</div>
                <div class="deck-capa-inputs">
                    <div class="deck-capa-label">Capa do Deck</div>
                    <input type="text" id="capaUrl" class="deck-capa-url"
                        placeholder="Cole uma URL de imagem..." value="${esc(capaVal)}"
                        oninput="onCapaUrlChange()" />
                    <label class="deck-capa-upload">
                        📁 Selecionar arquivo
                        <input type="file" id="capaFile" accept="image/*" hidden onchange="onCapaFileChange(event)">
                    </label>
                </div>
            </div>

            <!-- Deck Principal -->
            <div class="deck-section">
                <div class="deck-section-header">
                    <span class="deck-section-title">Deck Principal</span>
                    <span class="deck-section-count" id="countP">0/60</span>
                    <span style="font-size:.72rem;color:rgba(255,255,255,.3)">(40–60 recomendado)</span>
                </div>
                <div class="deck-section-items" id="itemsP"></div>
            </div>

            <!-- Deck Extra -->
            <div class="deck-section">
                <div class="deck-section-header">
                    <span class="deck-section-title">Deck Extra</span>
                    <span class="deck-section-count" id="countE">0/15</span>
                    <span style="font-size:.72rem;color:rgba(255,255,255,.3)">(Fusão, Sincro, XYZ, Link)</span>
                </div>
                <div class="deck-section-items" id="itemsE"></div>
            </div>

            <!-- Side Deck -->
            <div class="deck-section">
                <div class="deck-section-header">
                    <span class="deck-section-title">Side Deck</span>
                    <span class="deck-section-count" id="countS">0/15</span>
                </div>
                <div class="deck-section-items" id="itemsS"></div>
            </div>

            <div class="deck-save-row">
                <button class="btn btn-primary" onclick="salvarDeck()">
                    ${deckId === 'novo' ? 'Criar Deck' : 'Salvar Deck'}
                </button>
                <a href="/pages/decks/" class="btn btn-secondary">Cancelar</a>
                <span class="deck-save-msg" id="saveDeckMsg"></span>
            </div>
        </div>
    </div>`;

    filterCollection();
    renderDeckSections();
}

// ── Capa: URL e arquivo ───────────────────────────────────
function onCapaUrlChange() {
    const url = document.getElementById('capaUrl').value.trim();
    const preview = document.getElementById('capaPreview');
    if (url) {
        preview.innerHTML = `<img src="${esc(url)}" alt="Capa" onerror="this.parentElement.innerHTML='🖼️'">`;
    } else {
        preview.innerHTML = '🖼️';
    }
}

function onCapaFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const base64 = ev.target.result;
        document.getElementById('capaUrl').value = base64;
        document.getElementById('capaPreview').innerHTML = `<img src="${base64}" alt="Capa">`;
    };
    reader.readAsDataURL(file);
}

// ── Coleção com imagens ───────────────────────────────────
function filterCollection() {
    const q    = (document.getElementById('collSearch')?.value || '').toLowerCase().trim();
    const list = document.getElementById('collList');
    if (!list) return;

    const filtered = allCards.filter(c => !q || c.nome.toLowerCase().includes(q));
    if (!filtered.length) {
        list.innerHTML = '<div style="padding:1rem;color:rgba(255,255,255,.35);font-size:.85rem">Nenhuma carta encontrada.</div>';
        return;
    }

    list.innerHTML = filtered.map(c => {
        const sub     = c.tipo === 'MONSTRO' ? (c.tipo_efeito || 'Efeito') : c.tipo;
        const copies  = copiesInDeck(c.id);
        const imgHtml = c.imagem
            ? `<img src="${esc(c.imagem)}" alt="${esc(c.nome)}" onerror="this.parentElement.innerHTML='${typeIcon(c.tipo)}'">`
            : typeIcon(c.tipo);
        return `
        <div class="coll-item">
            <div class="coll-item-thumb">${imgHtml}</div>
            <div class="coll-item-info">
                <div class="coll-item-name">${esc(c.nome)}</div>
                <div class="coll-item-type">${sub}</div>
            </div>
            ${copies > 0 ? `<span class="coll-item-count">×${copies}</span>` : ''}
            <div class="coll-item-actions">
                <button class="coll-item-add" onclick="addToDeck(${c.id})" title="Adicionar ao Principal/Extra">+</button>
                <button class="coll-item-add side" onclick="addToSide(${c.id})" title="Adicionar ao Side Deck">S</button>
            </div>
        </div>`;
    }).join('');
}

// ── Lógica de deck ────────────────────────────────────────
function copiesInDeck(id) {
    return [deckPrincipal, deckExtra, deckSide].reduce((n, arr) => n + arr.filter(x => x === id).length, 0);
}

function addToDeck(id) {
    const carta = allCards.find(c => c.id === id);
    if (!carta) return;
    if (copiesInDeck(id) >= 3) { showSaveMsg('Máximo de 3 cópias por carta no deck.', 'error'); return; }
    const isExtra = carta.tipo === 'MONSTRO' && EXTRA_SUBTYPES.has(carta.tipo_efeito);
    if (isExtra) {
        if (deckExtra.length >= 15) { showSaveMsg('Extra Deck cheio (máx 15).', 'error'); return; }
        deckExtra.push(id);
    } else {
        if (deckPrincipal.length >= 60) { showSaveMsg('Deck Principal cheio (máx 60).', 'error'); return; }
        deckPrincipal.push(id);
    }
    refreshAfterAdd();
}

function addToSide(id) {
    if (copiesInDeck(id) >= 3) { showSaveMsg('Máximo de 3 cópias por carta.', 'error'); return; }
    if (deckSide.length >= 15) { showSaveMsg('Side Deck cheio (máx 15).', 'error'); return; }
    deckSide.push(id);
    refreshAfterAdd();
}

function refreshAfterAdd() {
    renderDeckSections();
    filterCollection(); // atualiza contador de cópias no painel esquerdo
}

function removeFromSection(section, id) {
    const arr = section === 'P' ? deckPrincipal : section === 'E' ? deckExtra : deckSide;
    const idx = arr.lastIndexOf(id);
    if (idx !== -1) arr.splice(idx, 1);
    refreshAfterAdd();
}

function renderDeckSections() {
    renderSection('P', deckPrincipal, 60, [40, 60]);
    renderSection('E', deckExtra,     15, [0,  15]);
    renderSection('S', deckSide,      15, [0,  15]);
}

function renderSection(key, arr, max, [min, maxVal]) {
    const countEl = document.getElementById(`count${key}`);
    const itemsEl = document.getElementById(`items${key}`);
    if (!countEl || !itemsEl) return;

    const count = arr.length;
    const warn  = count > maxVal || (key === 'P' && count > 0 && count < min);
    countEl.textContent = `${count}/${maxVal}`;
    countEl.className   = `deck-section-count ${warn ? 'warn' : count > 0 ? 'ok' : ''}`;

    if (!count) {
        itemsEl.innerHTML = '<span class="deck-section-empty">Vazio — clique em + na coleção para adicionar</span>';
        return;
    }

    // Agrupa por id mantendo ordem de inserção
    const groups = {};
    arr.forEach(id => { groups[id] = (groups[id] || 0) + 1; });

    itemsEl.innerHTML = Object.entries(groups).map(([id, qty]) => {
        const c = allCards.find(c => c.id === Number(id));
        if (!c) return '';

        const imgHtml = c.imagem
            ? `<img src="${esc(c.imagem)}" alt="${esc(c.nome)}" onerror="this.parentElement.innerHTML='${typeIcon(c.tipo)}'">`
            : typeIcon(c.tipo);

        return `
        <div class="deck-img-card" title="${esc(c.nome)}">
            <div class="deck-img-card-img">${imgHtml}</div>
            ${qty > 1 ? `<span class="deck-img-card-badge">×${qty}</span>` : ''}
            <button class="deck-img-card-remove" onclick="removeFromSection('${key}', ${id})" title="Remover uma cópia">✕</button>
            <div class="deck-img-card-name">${esc(c.nome)}</div>
        </div>`;
    }).join('');
}

function showSaveMsg(msg, type) {
    const el = document.getElementById('saveDeckMsg');
    if (!el) return;
    el.textContent = msg;
    el.className   = `deck-save-msg ${type}`;
    if (type === 'success') setTimeout(() => { el.textContent = ''; el.className = 'deck-save-msg'; }, 3000);
    if (type === 'error')   setTimeout(() => { el.textContent = ''; el.className = 'deck-save-msg'; }, 4000);
}

async function salvarDeck() {
    const nome = document.getElementById('deckNameInput')?.value.trim();
    const desc = document.getElementById('deckDescInput')?.value.trim() || null;
    const capa = document.getElementById('capaUrl')?.value.trim() || null;
    if (!nome) { showSaveMsg('Nome do deck é obrigatório.', 'error'); return; }

    const payload = { nome, descricao: desc, capa, principal: deckPrincipal, extra: deckExtra, side: deckSide };
    const url     = deckId === 'novo' ? '/api/decks' : `/api/decks/${deckId}`;
    const method  = deckId === 'novo' ? 'POST' : 'PUT';

    const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res) return;
    if (res.ok) {
        const saved = await res.json();
        showSaveMsg('Deck salvo com sucesso!', 'success');
        if (deckId === 'novo') {
            setTimeout(() => { location.href = `/pages/decks/?id=${saved.id}`; }, 800);
        } else {
            deck = saved;
        }
    } else {
        const err = await res.json().catch(() => ({}));
        showSaveMsg(err.error || 'Erro ao salvar.', 'error');
    }
}

// ── Init ─────────────────────────────────────────────────
if (deckId) {
    showEditor();
} else {
    showDeckList();
}
