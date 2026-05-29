// Módulo compartilhado — renderização de cartas (usado por ver.js e cadastrar.js)

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

function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function getCardClass(tipo, subtipo) {
    if (tipo === 'MAGIA')     return 'magia';
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

const SHINE_SUBTYPES = new Set(['Fusão', 'Sincro', 'XYZ', 'Link', 'Ritual']);

const RARITY_CLASS = {
    'Rara':       'rarity-rara',
    'Super Rara': 'rarity-super-rara',
    'Holografica': 'rarity-holografica',
};
const RARITY_LABEL = { 'Rara': 'R', 'Super Rara': 'SR', 'Holografica': 'H' };

// opts.clickable    — adiciona data-id/onclick/cursor (visualização em grade)
// opts.nameFallback — placeholder quando card.nome está vazio (modo prévia)
function buildYgoCard(card, { clickable = false, nameFallback = '' } = {}) {
    const subtipo   = card.tipo_efeito || 'Efeito';
    const cardClass = getCardClass(card.tipo, subtipo);
    const isLink    = subtipo === 'Link';
    const isPendulo = subtipo === 'Pêndulo';
    const isNormal  = subtipo === 'Normal';
    const isMonstro = card.tipo === 'MONSTRO';

    const attrClass = ATTR_CLASS[card.atributo] || '';
    const attrLabel = card.atributo ? card.atributo.substring(0, 3) : '';

    const imageContent = card.imagem
        ? `<img src="${esc(card.imagem)}" alt="${esc(card.nome || '')}" crossorigin="anonymous" onerror="this.parentElement.innerHTML='<span class=card-no-img>?</span>'" />`
        : '<span class="card-no-img">?</span>';

    let starsHTML = '';
    if (isMonstro && !isLink) {
        const count = Math.min(Number(card.nivel) || 0, 12);
        if (count > 0)
            starsHTML = `<div class="card-stars">${'<span class="star-gem"></span>'.repeat(count)}</div>`;
    }

    let typeText = '';
    if (isMonstro) {
        const t = card.tipo_monstro || 'Monstro';
        typeText = `[${t}${subtipo && subtipo !== 'Normal' ? '/' + subtipo : ''}]`;
    } else if (card.tipo === 'MAGIA') {
        typeText = `[Carta de Magia${card.tipo_magia ? ' – ' + card.tipo_magia : ''}]`;
    } else {
        typeText = `[Carta de Armadilha${card.tipo_armadilha ? ' – ' + card.tipo_armadilha : ''}]`;
    }

    const materiaisHTML = isMonstro && ['Fusão','Sincro','XYZ'].includes(subtipo) && card.materiais
        ? `<div class="card-materials"><p>${esc(card.materiais)}</p></div>` : '';

    const fmt = v => (v != null && v !== '') ? v : '?';

    const pendulumHTML = isPendulo ? `
        <div class="card-pendulum-section">
            <div class="pendulum-scale-box"><span class="scale-label">ESC</span><span class="scale-num">${fmt(card.escala_esq)}</span></div>
            <div class="pendulum-effect-box"><p class="pendulum-effect-text">${esc(card.efeito_pendulo || '')}</p></div>
            <div class="pendulum-scale-box"><span class="scale-label">ESC</span><span class="scale-num">${fmt(card.escala_dir)}</span></div>
        </div>` : '';

    let statsHTML = '';
    if (isMonstro) {
        statsHTML = isLink
            ? `<div class="card-stats-link"><span>ATK/${fmt(card.ataque)}</span>${buildLinkArrowsMini(card.setas_link || '')}<span>LINK-${fmt(card.valor_link)}</span></div>`
            : `<div class="card-stats">ATK/${fmt(card.ataque)} &nbsp; DEF/${fmt(card.defesa)}</div>`;
    }

    const descClass = isPendulo ? 'card-description-box compact' : 'card-description-box';
    const descStyle = isNormal ? 'font-style:italic' : '';
    const rootAttrs = clickable
        ? ` data-id="${card.id}" onclick="openModal(${card.id})" style="cursor:pointer"`
        : '';

    // Monstro: tipo abaixo da imagem | Magia/Armadilha: tipo acima da imagem
    const typeHTML = `<div class="card-type-text${isMonstro ? '' : ' card-type-header'}">${typeText}</div>`;

    // Ícone de magia/armadilha no lugar do atributo
    const iconHtml = !isMonstro
        ? `<span class="card-spell-icon card-spell-icon--${card.tipo === 'MAGIA' ? 'spell' : 'trap'}"></span>`
        : (card.atributo ? `<span class="card-attribute ${attrClass}">${attrLabel}</span>` : '');

    // Brilho holográfico: especial para cartas do Deck Extra + Ritual
    const isSpecial = isMonstro && SHINE_SUBTYPES.has(subtipo);
    const shineClass = `card-shine${isSpecial ? ' card-shine--special' : ''}`;

    const rarityClass = RARITY_CLASS[card.raridade] || '';
    const rarityBadge = RARITY_LABEL[card.raridade]
        ? `<div class="rarity-badge rarity-badge--${rarityClass.replace('rarity-', '')}" title="${card.raridade}">${RARITY_LABEL[card.raridade]}</div>`
        : '';

    return `
    <div class="ygo-card ${cardClass}${rarityClass ? ' ' + rarityClass : ''}"${rootAttrs}>
      <div class="${shineClass}"></div>
      ${rarityBadge}
      <div class="card-inner">
        <div class="card-name-bar">
            <span class="card-name">${esc(card.nome || nameFallback)}</span>
            ${iconHtml}
        </div>
        ${starsHTML}
        ${!isMonstro ? typeHTML : ''}
        <div class="card-image-area">${imageContent}</div>
        ${materiaisHTML}
        ${isMonstro ? typeHTML : ''}
        ${pendulumHTML}
        <div class="${descClass}">
            <p class="card-description" style="${descStyle}">${esc(card.descricao || '')}</p>
        </div>
        ${statsHTML}
      </div>
    </div>`;
}
