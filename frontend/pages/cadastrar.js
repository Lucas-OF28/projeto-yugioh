const API    = '/api/cartas';
const YGOPRO = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

// Mapas para importar da API YGOPRODeck
const YGOTYPE_MAP = {
    'Normal Monster':                    { tipo:'MONSTRO', subtipo:'Normal'  },
    'Effect Monster':                    { tipo:'MONSTRO', subtipo:'Efeito'  },
    'Flip Monster':                      { tipo:'MONSTRO', subtipo:'Efeito'  },
    'Flip Effect Monster':               { tipo:'MONSTRO', subtipo:'Efeito'  },
    'Union Effect Monster':              { tipo:'MONSTRO', subtipo:'Efeito'  },
    'Spirit Monster':                    { tipo:'MONSTRO', subtipo:'Efeito'  },
    'Toon Monster':                      { tipo:'MONSTRO', subtipo:'Efeito'  },
    'Gemini Monster':                    { tipo:'MONSTRO', subtipo:'Efeito'  },
    'Ritual Monster':                    { tipo:'MONSTRO', subtipo:'Ritual'  },
    'Ritual Effect Monster':             { tipo:'MONSTRO', subtipo:'Ritual'  },
    'Fusion Monster':                    { tipo:'MONSTRO', subtipo:'Fusão'   },
    'Synchro Monster':                   { tipo:'MONSTRO', subtipo:'Sincro'  },
    'Synchro Tuner Monster':             { tipo:'MONSTRO', subtipo:'Sincro'  },
    'Synchro Pendulum Effect Monster':   { tipo:'MONSTRO', subtipo:'Sincro'  },
    'XYZ Monster':                       { tipo:'MONSTRO', subtipo:'XYZ'     },
    'XYZ Pendulum Effect Monster':       { tipo:'MONSTRO', subtipo:'XYZ'     },
    'Pendulum Normal Monster':           { tipo:'MONSTRO', subtipo:'Pêndulo' },
    'Pendulum Effect Monster':           { tipo:'MONSTRO', subtipo:'Pêndulo' },
    'Pendulum Flip Effect Monster':      { tipo:'MONSTRO', subtipo:'Pêndulo' },
    'Pendulum Effect Fusion Monster':    { tipo:'MONSTRO', subtipo:'Pêndulo' },
    'Pendulum Tuner Effect Monster':     { tipo:'MONSTRO', subtipo:'Pêndulo' },
    'Link Monster':                      { tipo:'MONSTRO', subtipo:'Link'    },
    'Spell Card':                        { tipo:'MAGIA',    subtipo:''       },
    'Trap Card':                         { tipo:'ARMADILHA', subtipo:''      },
};

const ATTR_MAP = {
    FIRE:'FOGO', WATER:'ÁGUA', EARTH:'TERRA',
    WIND:'VENTO', LIGHT:'LUZ', DARK:'TREVAS', DIVINE:'DIVINO'
};

const SPELL_RACE_MAP = {
    Normal:'', Continuous:'Contínua', Equip:'Equipamento',
    Field:'Campo', 'Quick-Play':'Jogo-Rápido', Ritual:'Ritual'
};

const TRAP_RACE_MAP = { Normal:'', Continuous:'Contínua', Counter:'Contador' };

// ── Estado ────────────────────────────────────────────────
const editId  = new URLSearchParams(window.location.search).get('id');
const cloneId = new URLSearchParams(window.location.search).get('clone');
let nivelAtual = 4;
let lastSearchResults = [];

// ── Star Picker ───────────────────────────────────────────
function initStarPicker() {
    renderStars(nivelAtual);
    document.querySelectorAll('.star-item').forEach(star => {
        const val = parseInt(star.dataset.value);
        star.addEventListener('click', () => { setNivel(val); updatePreview(); });
        star.addEventListener('mouseenter', () => renderStars(val, true));
        star.addEventListener('mouseleave', () => renderStars(nivelAtual));
    });
}

function setNivel(n) {
    nivelAtual = n;
    document.getElementById('nivel').value = n;
    document.getElementById('nivelValue').textContent = n;
    renderStars(n);
}

function renderStars(upTo, hovering = false) {
    document.querySelectorAll('.star-item').forEach(star => {
        const val = parseInt(star.dataset.value);
        star.classList.remove('filled', 'hovered');
        if (val <= upTo) star.classList.add(hovering ? 'hovered' : 'filled');
    });
}

// ── Visibilidade dos campos ───────────────────────────────
function handleTipoChange() {
    const tipo = document.getElementById('tipo').value;
    document.getElementById('monstroFields').style.display   = tipo === 'MONSTRO'   ? 'block' : 'none';
    document.getElementById('magiaFields').style.display     = tipo === 'MAGIA'      ? 'block' : 'none';
    document.getElementById('armadilhaFields').style.display = tipo === 'ARMADILHA'  ? 'block' : 'none';
    if (tipo === 'MONSTRO') handleSubtipoChange();
    updatePreview();
}

function handleSubtipoChange() {
    const sub       = document.getElementById('tipo_efeito').value;
    const isLink    = sub === 'Link';
    const isPendulo = sub === 'Pêndulo';
    const needsMat  = ['Fusão','Sincro','XYZ'].includes(sub);

    document.getElementById('nivelLabel').textContent           = sub === 'XYZ' ? 'Rank' : 'Nível';
    document.getElementById('nivelGroup').style.display         = isLink    ? 'none' : 'block';
    document.getElementById('defesaGroup').style.display        = isLink    ? 'none' : 'block';
    document.getElementById('materiaisGroup').style.display     = needsMat  ? 'block' : 'none';
    document.getElementById('penduloFields').style.display      = isPendulo ? 'block' : 'none';
    document.getElementById('linkFields').style.display         = isLink    ? 'block' : 'none';
    updatePreview();
}

// ── Leitura do formulário ─────────────────────────────────
function getFormValues() {
    return {
        nome:           document.getElementById('nome').value,
        tipo:           document.getElementById('tipo').value,
        tipo_efeito:    document.getElementById('tipo_efeito').value,
        atributo:       document.getElementById('atributo').value,
        nivel:          parseInt(document.getElementById('nivel').value) || 4,
        tipo_monstro:   document.getElementById('tipo_monstro').value,
        ataque:         document.getElementById('ataque').value,
        defesa:         document.getElementById('defesa').value,
        tipo_magia:     document.getElementById('tipo_magia').value,
        tipo_armadilha: document.getElementById('tipo_armadilha').value,
        descricao:      document.getElementById('descricao').value,
        imagem:         document.getElementById('imagem').value,
        materiais:      document.getElementById('materiais').value,
        escala_esq:     document.getElementById('escala_esq').value,
        escala_dir:     document.getElementById('escala_dir').value,
        efeito_pendulo: document.getElementById('efeito_pendulo').value,
        valor_link:     document.getElementById('valor_link').value,
        setas_link:     Array.from(document.querySelectorAll('.seta-checkbox:checked')).map(cb => cb.value).join(','),
    };
}

function updatePreview() {
    document.getElementById('previewCard').innerHTML =
        buildYgoCard(getFormValues(), { nameFallback: 'Nome da Carta' });
}

// ── Preencher formulário (edição / clone) ─────────────────
function preencherFormulario(carta) {
    document.getElementById('nome').value       = carta.nome || '';
    document.getElementById('tipo').value       = carta.tipo || 'MONSTRO';
    document.getElementById('descricao').value  = carta.descricao || '';
    document.getElementById('imagem').value     = carta.imagem || '';

    handleTipoChange();

    document.getElementById('atributo').value       = carta.atributo      || '';
    document.getElementById('tipo_efeito').value    = carta.tipo_efeito   || 'Normal';
    document.getElementById('tipo_monstro').value   = carta.tipo_monstro  || '';
    document.getElementById('ataque').value         = carta.ataque        ?? '';
    document.getElementById('defesa').value         = carta.defesa        ?? '';
    document.getElementById('tipo_magia').value     = carta.tipo_magia    || '';
    document.getElementById('tipo_armadilha').value = carta.tipo_armadilha || '';
    document.getElementById('materiais').value      = carta.materiais     || '';
    document.getElementById('escala_esq').value     = carta.escala_esq    ?? '';
    document.getElementById('escala_dir').value     = carta.escala_dir    ?? '';
    document.getElementById('efeito_pendulo').value = carta.efeito_pendulo || '';
    document.getElementById('valor_link').value     = carta.valor_link    ?? '';

    setNivel(carta.nivel || 4);
    handleSubtipoChange();

    if (carta.setas_link) {
        const active = carta.setas_link.split(',');
        document.querySelectorAll('.seta-checkbox').forEach(cb => {
            cb.checked = active.includes(cb.value);
        });
    }

    updatePreview();
}

// ── Init ──────────────────────────────────────────────────
async function init() {
    if (editId) {
        document.getElementById('pageTitle').textContent = 'Editar Carta';
        document.getElementById('submitBtn').textContent  = 'Salvar Alterações';
        try {
            const res = await fetch(`${API}/${editId}`);
            if (!res.ok) throw new Error();
            preencherFormulario(await res.json());
        } catch {
            showMsg('Erro ao carregar carta para edição.', 'error');
        }
    } else if (cloneId) {
        document.getElementById('pageTitle').textContent = 'Clonar Carta';
        try {
            const res = await fetch(`${API}/${cloneId}`);
            if (!res.ok) throw new Error();
            const carta = await res.json();
            carta.nome = carta.nome + ' (Cópia)';
            preencherFormulario(carta);
        } catch {
            showMsg('Erro ao carregar carta para clonar.', 'error');
        }
    }
}

// ── Busca carta real (YGOPRODeck) ─────────────────────────
async function searchRealCard() {
    const query = document.getElementById('searchRealInput').value.trim();
    if (!query) return;

    const btn = document.getElementById('searchRealBtn');
    btn.disabled = true;
    btn.textContent = '...';
    document.getElementById('searchRealResults').innerHTML =
        '<p class="search-status">Buscando...</p>';

    try {
        const res = await fetch(`${YGOPRO}?fname=${encodeURIComponent(query)}&num=12&offset=0`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        lastSearchResults = data.data || [];
        showSearchResults(lastSearchResults);
    } catch {
        document.getElementById('searchRealResults').innerHTML =
            '<p class="search-status">Carta não encontrada. Tente o nome em inglês.</p>';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Buscar';
    }
}

function showSearchResults(cards) {
    if (!cards.length) {
        document.getElementById('searchRealResults').innerHTML =
            '<p class="search-status">Nenhuma carta encontrada.</p>';
        return;
    }
    document.getElementById('searchRealResults').innerHTML =
        `<div class="search-results-grid">${
            cards.slice(0, 12).map(c => `
            <div class="search-result-item" onclick="useRealCard(${c.id})">
                <img src="${c.card_images[0].image_url_small}" alt="${esc(c.name)}" />
                <span>${esc(c.name)}</span>
            </div>`).join('')
        }</div>`;
}

function useRealCard(cardId) {
    const card = lastSearchResults.find(c => c.id === cardId);
    if (!card) return;

    const typeInfo = YGOTYPE_MAP[card.type] || { tipo:'MONSTRO', subtipo:'Efeito' };

    document.getElementById('tipo').value = typeInfo.tipo;
    handleTipoChange();
    document.getElementById('tipo_efeito').value = typeInfo.subtipo || 'Normal';

    document.getElementById('nome').value      = card.name;
    document.getElementById('descricao').value = card.desc || '';
    document.getElementById('imagem').value    = card.card_images[0].image_url;

    if (typeInfo.tipo === 'MONSTRO') {
        document.getElementById('atributo').value     = ATTR_MAP[card.attribute] || '';
        document.getElementById('tipo_monstro').value = card.race || '';
        document.getElementById('ataque').value       = card.atk ?? '';
        document.getElementById('defesa').value       = card.def ?? '';
        if (typeInfo.subtipo === 'Link')
            document.getElementById('valor_link').value = card.linkval ?? '';
        else
            setNivel(card.level || card.linkval || 1);
    }

    if (typeInfo.tipo === 'MAGIA')
        document.getElementById('tipo_magia').value = SPELL_RACE_MAP[card.race] ?? '';

    if (typeInfo.tipo === 'ARMADILHA')
        document.getElementById('tipo_armadilha').value = TRAP_RACE_MAP[card.race] ?? '';

    handleSubtipoChange();
    document.getElementById('searchRealResults').innerHTML = '';
    document.getElementById('searchRealInput').value = '';
    updatePreview();
}

// ── Download da prévia ────────────────────────────────────
document.getElementById('downloadPreviewBtn').addEventListener('click', async () => {
    const cardEl = document.querySelector('#previewCard .ygo-card');
    if (!cardEl) return;

    const btn = document.getElementById('downloadPreviewBtn');
    btn.disabled = true;
    btn.textContent = 'Gerando...';

    try {
        const canvas = await html2canvas(cardEl, {
            scale: 3, useCORS: true, allowTaint: false, logging: false, backgroundColor: null,
        });
        const nome = (document.getElementById('nome').value.trim() || 'carta')
            .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
        const a = document.createElement('a');
        a.download = `${nome}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
    } catch {
        alert('Não foi possível gerar a imagem. Tente sem URL de imagem externa.');
    } finally {
        btn.disabled = false;
        btn.textContent = '↓ Baixar carta (PNG)';
    }
});

// ── Submit ────────────────────────────────────────────────
document.getElementById('cartaForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const v = getFormValues();

    if (!v.nome.trim()) {
        showMsg('O nome da carta é obrigatório.', 'error');
        document.getElementById('nome').focus();
        return;
    }

    const sub      = v.tipo_efeito;
    const isLink   = sub === 'Link';
    const isPendulo = sub === 'Pêndulo';
    const needsMat = ['Fusão','Sincro','XYZ'].includes(sub);

    const payload = {
        nome:           v.nome.trim(),
        tipo:           v.tipo,
        descricao:      v.descricao.trim() || null,
        imagem:         v.imagem.trim()    || null,
        tipo_efeito:    v.tipo === 'MONSTRO' ? sub : null,
        atributo:       v.tipo === 'MONSTRO' ? (v.atributo || null) : null,
        nivel:          v.tipo === 'MONSTRO' && !isLink ? (v.nivel || null) : null,
        tipo_monstro:   v.tipo === 'MONSTRO' ? (v.tipo_monstro.trim() || null) : null,
        ataque:         v.tipo === 'MONSTRO' ? (v.ataque !== '' ? parseInt(v.ataque) : null) : null,
        defesa:         v.tipo === 'MONSTRO' && !isLink ? (v.defesa !== '' ? parseInt(v.defesa) : null) : null,
        tipo_magia:     v.tipo === 'MAGIA'      ? (v.tipo_magia     || null) : null,
        tipo_armadilha: v.tipo === 'ARMADILHA'  ? (v.tipo_armadilha || null) : null,
        materiais:      needsMat  ? (v.materiais.trim()      || null) : null,
        escala_esq:     isPendulo ? (v.escala_esq !== '' ? parseInt(v.escala_esq) : null) : null,
        escala_dir:     isPendulo ? (v.escala_dir !== '' ? parseInt(v.escala_dir) : null) : null,
        efeito_pendulo: isPendulo ? (v.efeito_pendulo.trim() || null) : null,
        valor_link:     isLink    ? (v.valor_link !== '' ? parseInt(v.valor_link) : null) : null,
        setas_link:     isLink    ? (v.setas_link || null) : null,
    };

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        const method = editId ? 'PUT' : 'POST';
        const url    = editId ? `${API}/${editId}` : API;
        const res    = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            showMsg(editId ? 'Carta atualizada!' : 'Carta cadastrada!', 'success');
            setTimeout(() => { window.location.href = 'verCartas.html'; }, 700);
        } else {
            const err = await res.json().catch(() => ({}));
            showMsg(err.error || 'Erro ao salvar carta.', 'error');
            btn.disabled = false;
            btn.textContent = editId ? 'Salvar Alterações' : 'Cadastrar Carta';
        }
    } catch {
        showMsg('Erro de conexão com o servidor.', 'error');
        btn.disabled = false;
        btn.textContent = editId ? 'Salvar Alterações' : 'Cadastrar Carta';
    }
});

// ── Feedback ──────────────────────────────────────────────
function showMsg(text, type) {
    const el = document.getElementById('formMsg');
    el.textContent = text;
    el.className = 'form-msg ' + type;
}

// ── Upload de imagem local ────────────────────────────────
document.getElementById('imagemFile').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
        alert('Arquivo muito grande. Use uma imagem menor que 4 MB.');
        this.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target.result;
        document.getElementById('imagem').value = base64;
        document.getElementById('imageFilename').textContent = file.name;
        document.getElementById('imageThumbPreview').innerHTML = `<img src="${base64}" alt="preview" />`;
        updatePreview();
    };
    reader.readAsDataURL(file);
});

document.getElementById('imagem').addEventListener('input', function () {
    if (!this.value.startsWith('data:')) {
        document.getElementById('imagemFile').value = '';
        document.getElementById('imageFilename').textContent = '';
        document.getElementById('imageThumbPreview').innerHTML = '';
    }
});

// ── Eventos gerais ────────────────────────────────────────
document.getElementById('tipo').addEventListener('change', handleTipoChange);
document.getElementById('tipo_efeito').addEventListener('change', handleSubtipoChange);
document.getElementById('searchRealBtn').addEventListener('click', searchRealCard);
document.getElementById('searchRealInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); searchRealCard(); }
});

document.querySelectorAll('.seta-checkbox').forEach(cb => {
    cb.addEventListener('change', updatePreview);
});

document.querySelectorAll('#cartaForm input:not(.seta-checkbox):not([type="file"]), #cartaForm textarea, #cartaForm select').forEach(el => {
    el.addEventListener('input', updatePreview);
});

// ── Inicialização ─────────────────────────────────────────
handleTipoChange();
updatePreview();
initStarPicker();
init();
