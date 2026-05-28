const API = '/api/cartas';

const ATTR_CLASS = {
    'FOGO':'attr-fogo','ÁGUA':'attr-agua','TERRA':'attr-terra',
    'VENTO':'attr-vento','LUZ':'attr-luz','TREVAS':'attr-trevas','DIVINO':'attr-divino'
};

const CARD_CLASS = {
    'Normal':'monstro-normal','Efeito':'monstro-efeito','Ritual':'monstro-ritual',
    'Fusão':'monstro-fusao','Sincro':'monstro-sincro','XYZ':'monstro-xyz',
    'Pêndulo':'monstro-pendulo','Link':'monstro-link'
};

const ARROW_SYM = { NW:'↖',N:'↑',NE:'↗',W:'←',E:'→',SW:'↙',S:'↓',SE:'↘' };
const ARROW_ORDER = ['NW','N','NE','W',null,'E','SW','S','SE'];

let allCards = [];
let activeFilter = 'TODOS';

// ── Helpers ──────────────────────────────────────────────

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
        }).join('') +
        '</div>';
}

function buildCardHTML(carta) {
    const subtipo = carta.tipo_efeito || 'Efeito';
    const cardClass = getCardClass(carta.tipo, subtipo);
    const isLink = subtipo === 'Link';
    const isPendulo = subtipo === 'Pêndulo';
    const isXYZ = subtipo === 'XYZ';
    const isNormal = subtipo === 'Normal';
    const isMonstro = carta.tipo === 'MONSTRO';

    const attrClass = ATTR_CLASS[carta.atributo] || '';
    const attrLabel = carta.atributo ? carta.atributo.substring(0, 3) : '';

    const imageContent = carta.imagem
        ? `<img src="${esc(carta.imagem)}" alt="${esc(carta.nome)}" crossorigin="anonymous" onerror="this.parentElement.innerHTML='<span class=card-no-img>?</span>'" />`
        : '<span class="card-no-img">?</span>';

    // Estrelas / Rank gems
    let starsHTML = '';
    if (isMonstro && !isLink) {
        const count = Math.min(Number(carta.nivel) || 0, 12);
        if (count > 0) {
            const gem = '<span class="star-gem"></span>';
            starsHTML = `<div class="card-stars">${gem.repeat(count)}</div>`;
        }
    }

    // Texto do tipo
    let typeText = '';
    if (isMonstro) {
        const t = carta.tipo_monstro || 'Monstro';
        const sub = subtipo && subtipo !== 'Normal' ? '/' + subtipo : '';
        typeText = `[${t}${sub}]`;
    } else if (carta.tipo === 'MAGIA') {
        typeText = `Carta de Magia${carta.tipo_magia ? ' – ' + carta.tipo_magia : ''}`;
    } else {
        typeText = `Carta de Armadilha${carta.tipo_armadilha ? ' – ' + carta.tipo_armadilha : ''}`;
    }

    // Materiais
    const materiaisHTML = isMonstro && ['Fusão','Sincro','XYZ'].includes(subtipo) && carta.materiais
        ? `<div class="card-materials"><p>${esc(carta.materiais)}</p></div>`
        : '';

    // Seção pêndulo
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

    // Stats
    let statsHTML = '';
    if (isMonstro) {
        if (isLink) {
            statsHTML = `<div class="card-stats-link">
                <span>ATK/${carta.ataque ?? '?'}</span>
                ${buildLinkArrowsMini(carta.setas_link || '')}
                <span>LINK-${carta.valor_link ?? '?'}</span>
            </div>`;
        } else {
            statsHTML = `<div class="card-stats">ATK/${carta.ataque ?? '?'} &nbsp; DEF/${carta.defesa ?? '?'}</div>`;
        }
    }

    const descClass = isPendulo ? 'card-description-box compact' : 'card-description-box';
    const descStyle = isNormal ? 'font-style:italic' : '';

    return `
    <div class="card-wrapper">
        <div class="ygo-card ${cardClass}" data-id="${carta.id}">
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
        </div>
        <div class="card-actions">
            <a href="cadastrarCartas.html?id=${carta.id}" class="btn btn-secondary btn-sm">Editar</a>
            <button class="btn btn-secondary btn-sm" onclick="baixarCarta(${carta.id})">↓ Baixar</button>
            <button class="btn btn-danger btn-sm" onclick="deletar(${carta.id}, '${esc(carta.nome)}')">Deletar</button>
        </div>
    </div>`;
}

// ── Carregar e renderizar ─────────────────────────────────

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
    const grid = document.getElementById('cardsGrid');
    const search = document.getElementById('searchInput').value.toLowerCase().trim();

    let filtered = allCards;
    if (activeFilter !== 'TODOS') filtered = filtered.filter(c => c.tipo === activeFilter);
    if (search) filtered = filtered.filter(c => c.nome.toLowerCase().includes(search));

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty">Nenhuma carta encontrada.</div>';
        return;
    }

    grid.innerHTML = filtered.map(buildCardHTML).join('');
}

// ── Deletar ───────────────────────────────────────────────

async function deletar(id, nome) {
    if (!confirm(`Deletar a carta "${nome}"?`)) return;
    try {
        const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
        if (res.ok) {
            allCards = allCards.filter(c => c.id !== id);
            renderCards();
        } else {
            alert('Erro ao deletar carta.');
        }
    } catch {
        alert('Erro de conexão.');
    }
}

// ── Baixar carta como PNG ─────────────────────────────────

async function baixarCarta(id) {
    const cardEl = document.querySelector(`.ygo-card[data-id="${id}"]`);
    if (!cardEl) return;

    const carta = allCards.find(c => c.id === id);
    const nomeSafe = (carta?.nome || 'carta').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');

    try {
        const canvas = await html2canvas(cardEl, {
            scale: 3,
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: null,
        });

        const a = document.createElement('a');
        a.download = `${nomeSafe}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
    } catch {
        alert('Não foi possível baixar. Tente sem imagem externa, ou use uma URL com permissão CORS.');
    }
}

// ── Eventos ───────────────────────────────────────────────

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        activeFilter = this.dataset.filter;
        renderCards();
    });
});

document.getElementById('searchInput').addEventListener('input', renderCards);

loadCards();
