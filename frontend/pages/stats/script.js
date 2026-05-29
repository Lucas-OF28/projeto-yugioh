if (!requireLogin()) throw new Error('not auth');
initSidebar('stats', 'Estatísticas');

const CHART_COLORS = {
    MONSTRO:   '#e8a020',
    MAGIA:     '#1aaa5a',
    ARMADILHA: '#aa1a8a',
    FOGO:  '#e03020', ÁGUA:  '#2060e0', TERRA: '#8a6010',
    VENTO: '#108030', LUZ:   '#c89010', TREVAS:'#6010a0', DIVINO:'#c0a020',
};

const RARITY_COLORS = {
    'Comum': '#666', 'Rara': '#a0b8d0', 'Super Rara': '#88ccff', 'Holografica': '#d4a017',
};

function chartDefaults() {
    return {
        plugins: {
            legend: { labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } } },
        },
    };
}

function makeChart(id, type, labels, data, colors, opts = {}) {
    return new Chart(document.getElementById(id), {
        type,
        data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: 'rgba(0,0,0,0.4)', borderWidth: 1 }] },
        options: { ...chartDefaults(), ...opts, responsive: true, maintainAspectRatio: true },
    });
}

function kpi(label, value) {
    return `<div class="kpi-card"><div class="kpi-value">${value}</div><div class="kpi-label">${label}</div></div>`;
}

function topCards(title, list) {
    if (!list.length) return '';
    return `
    <div class="chart-box">
        <div class="chart-title">${title}</div>
        ${list.map(([nome, val]) => `
        <div class="top-card-entry">
            <span class="top-card-name">${esc(nome)}</span>
            <span class="top-card-val">${val}</span>
        </div>`).join('')}
    </div>`;
}

function esc(str) {
    return String(str || '').replace(/[&<>"']/g, m =>
        ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]);
}

async function loadStats() {
    if (!requireLogin()) return;
    const res = await authFetch('/api/cartas');
    if (!res) return;
    const cartas = await res.json();

    const main = document.getElementById('statsMain');

    if (!cartas.length) {
        main.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,.4);padding:4rem">Nenhuma carta na coleção ainda.</div>';
        return;
    }

    const monstros   = cartas.filter(c => c.tipo === 'MONSTRO');
    const magias     = cartas.filter(c => c.tipo === 'MAGIA');
    const armadilhas = cartas.filter(c => c.tipo === 'ARMADILHA');

    const avgATK = monstros.filter(c => c.ataque != null).reduce((s, c) => s + c.ataque, 0) / (monstros.filter(c => c.ataque != null).length || 1);
    const avgDEF = monstros.filter(c => c.defesa != null).reduce((s, c) => s + c.defesa, 0) / (monstros.filter(c => c.defesa != null).length || 1);

    const highATK = [...monstros].filter(c => c.ataque != null).sort((a, b) => b.ataque - a.ataque).slice(0, 5).map(c => [c.nome, c.ataque]);
    const highDEF = [...monstros].filter(c => c.defesa != null).sort((a, b) => b.defesa - a.defesa).slice(0, 5).map(c => [c.nome, c.defesa]);

    // Distribuição por atributo
    const attrCount = {};
    monstros.forEach(c => { if (c.atributo) attrCount[c.atributo] = (attrCount[c.atributo] || 0) + 1; });

    // Distribuição por subtipo
    const subCount = {};
    monstros.forEach(c => { if (c.tipo_efeito) subCount[c.tipo_efeito] = (subCount[c.tipo_efeito] || 0) + 1; });

    // Distribuição por nível
    const lvlCount = {};
    monstros.forEach(c => { if (c.nivel) lvlCount[c.nivel] = (lvlCount[c.nivel] || 0) + 1; });
    const lvlLabels = Object.keys(lvlCount).sort((a, b) => a - b);
    const lvlData   = lvlLabels.map(l => lvlCount[l]);

    // Distribuição por raridade
    const rarCount = { Comum: 0, Rara: 0, 'Super Rara': 0, Holografica: 0 };
    cartas.forEach(c => { const r = c.raridade || 'Comum'; rarCount[r] = (rarCount[r] || 0) + 1; });

    main.innerHTML = `
    <!-- KPIs -->
    <div class="kpi-row">
        ${kpi('Total de Cartas', cartas.length)}
        ${kpi('Monstros', monstros.length)}
        ${kpi('Magias', magias.length)}
        ${kpi('Armadilhas', armadilhas.length)}
        ${kpi('ATK Médio', monstros.filter(c=>c.ataque!=null).length ? Math.round(avgATK) : '–')}
        ${kpi('DEF Médio', monstros.filter(c=>c.defesa!=null).length ? Math.round(avgDEF) : '–')}
    </div>

    <!-- Gráficos -->
    <div class="charts-grid">
        <div class="chart-box">
            <div class="chart-title">Distribuição por Tipo</div>
            <canvas id="chartTipo"></canvas>
        </div>
        ${Object.keys(attrCount).length ? `
        <div class="chart-box">
            <div class="chart-title">Monstros por Atributo</div>
            <canvas id="chartAtributo"></canvas>
        </div>` : ''}
        ${Object.keys(subCount).length ? `
        <div class="chart-box">
            <div class="chart-title">Monstros por Subtipo</div>
            <canvas id="chartSubtipo"></canvas>
        </div>` : ''}
        ${lvlLabels.length ? `
        <div class="chart-box">
            <div class="chart-title">Monstros por Nível / Rank</div>
            <canvas id="chartNivel"></canvas>
        </div>` : ''}
        <div class="chart-box">
            <div class="chart-title">Distribuição por Raridade</div>
            <canvas id="chartRaridade"></canvas>
        </div>
        ${highATK.length ? topCards('Top 5 Maior ATK', highATK) : ''}
        ${highDEF.length ? topCards('Top 5 Maior DEF', highDEF) : ''}
    </div>`;

    // Renderiza gráficos
    makeChart('chartTipo', 'doughnut',
        ['Monstros', 'Magias', 'Armadilhas'],
        [monstros.length, magias.length, armadilhas.length],
        [CHART_COLORS.MONSTRO, CHART_COLORS.MAGIA, CHART_COLORS.ARMADILHA]
    );

    if (Object.keys(attrCount).length) {
        const attrs = Object.keys(attrCount);
        makeChart('chartAtributo', 'pie',
            attrs, attrs.map(a => attrCount[a]),
            attrs.map(a => CHART_COLORS[a] || '#888')
        );
    }

    if (Object.keys(subCount).length) {
        const subs = Object.keys(subCount).sort((a, b) => subCount[b] - subCount[a]);
        makeChart('chartSubtipo', 'bar',
            subs, subs.map(s => subCount[s]),
            subs.map(() => 'rgba(212,160,23,0.7)'),
            {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { color: 'rgba(255,255,255,0.08)' } },
                    y: { ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { color: 'rgba(255,255,255,0.08)' } },
                },
            }
        );
    }

    if (lvlLabels.length) {
        makeChart('chartNivel', 'bar',
            lvlLabels.map(l => `Nv ${l}`), lvlData,
            lvlData.map(() => 'rgba(168,100,200,0.7)'),
            {
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { color: 'rgba(255,255,255,0.08)' } },
                    y: { ticks: { color: 'rgba(255,255,255,0.6)', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.08)' } },
                },
            }
        );
    }

    const rarLabels = Object.keys(rarCount).filter(k => rarCount[k] > 0);
    makeChart('chartRaridade', 'doughnut',
        rarLabels, rarLabels.map(r => rarCount[r]),
        rarLabels.map(r => RARITY_COLORS[r] || '#888')
    );
}

loadStats();
