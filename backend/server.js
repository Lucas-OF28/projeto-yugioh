const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const https     = require('https');
const db        = require('./database');

const app    = express();
const PORT   = process.env.PORT || 3000;
const isProd = !!process.env.VERCEL;

app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy:    false,
    crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https:\/\/.*\.vercel\.app$/,
    process.env.SITE_URL ? new RegExp(`^${process.env.SITE_URL.replace(/\./g, '\\.')}`) : null,
].filter(Boolean);

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const ok = allowedOrigins.some(o =>
            o instanceof RegExp ? o.test(origin) : origin.startsWith(o)
        );
        if (ok) return cb(null, true);
        cb(new Error('CORS: origem não permitida'));
    },
}));

app.use(express.json({ limit: '6mb' }));

// Estáticos apenas no dev local — no Vercel o CDN serve frontend/
if (!process.env.VERCEL) {
    app.use(express.static(path.join(__dirname, '..', 'frontend')));
}

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max:      100,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: 'Muitas requisições. Aguarde alguns minutos e tente novamente.' },
});

const writeLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max:      30,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: 'Limite de operações atingido. Aguarde antes de continuar.' },
});

app.use('/api/', apiLimiter);

// ── Validação ────────────────────────────────────────────
const TIPOS       = ['MONSTRO', 'MAGIA', 'ARMADILHA'];
const SUBTIPOS    = ['Normal', 'Efeito', 'Ritual', 'Fusão', 'Sincro', 'XYZ', 'Pêndulo', 'Link'];
const ATRIBUTOS   = ['FOGO', 'ÁGUA', 'TERRA', 'VENTO', 'LUZ', 'TREVAS', 'DIVINO'];
const TIPOS_MAGIA = ['', 'Contínua', 'Equipamento', 'Campo', 'Jogo-Rápido', 'Ritual'];
const TIPOS_TRAP  = ['', 'Contínua', 'Contador'];
const SETAS_VALIDAS = new Set(['N','NE','E','SE','S','SW','W','NW']);

function validateCarta(body) {
    const erros = [];
    const { nome, tipo } = body;

    if (!nome || typeof nome !== 'string' || !nome.trim())
        erros.push('Nome é obrigatório.');
    else if (nome.length > 100)
        erros.push('Nome deve ter no máximo 100 caracteres.');

    if (!tipo || !TIPOS.includes(tipo))
        erros.push('Tipo inválido.');

    if (body.tipo_efeito && !SUBTIPOS.includes(body.tipo_efeito))
        erros.push('Subtipo inválido.');

    if (body.atributo && !ATRIBUTOS.includes(body.atributo))
        erros.push('Atributo inválido.');

    if (body.tipo_magia !== undefined && body.tipo_magia !== null && !TIPOS_MAGIA.includes(body.tipo_magia))
        erros.push('Tipo de magia inválido.');

    if (body.tipo_armadilha !== undefined && body.tipo_armadilha !== null && !TIPOS_TRAP.includes(body.tipo_armadilha))
        erros.push('Tipo de armadilha inválido.');

    const nivel = Number(body.nivel);
    if (body.nivel !== null && body.nivel !== undefined && (!Number.isInteger(nivel) || nivel < 1 || nivel > 12))
        erros.push('Nível deve ser um inteiro entre 1 e 12.');

    const atk = Number(body.ataque);
    if (body.ataque !== null && body.ataque !== undefined && (isNaN(atk) || atk < 0 || atk > 99999))
        erros.push('ATK deve ser entre 0 e 99999.');

    const def = Number(body.defesa);
    if (body.defesa !== null && body.defesa !== undefined && (isNaN(def) || def < 0 || def > 99999))
        erros.push('DEF deve ser entre 0 e 99999.');

    if (body.descricao && body.descricao.length > 1500)
        erros.push('Descrição deve ter no máximo 1500 caracteres.');

    if (body.tipo_monstro && body.tipo_monstro.length > 60)
        erros.push('Tipo do monstro deve ter no máximo 60 caracteres.');

    if (body.materiais && body.materiais.length > 300)
        erros.push('Materiais deve ter no máximo 300 caracteres.');

    const escEsq = Number(body.escala_esq);
    const escDir = Number(body.escala_dir);
    if (body.escala_esq !== null && body.escala_esq !== undefined && (isNaN(escEsq) || escEsq < 0 || escEsq > 13))
        erros.push('Escala pêndulo esquerda deve ser entre 0 e 13.');
    if (body.escala_dir !== null && body.escala_dir !== undefined && (isNaN(escDir) || escDir < 0 || escDir > 13))
        erros.push('Escala pêndulo direita deve ser entre 0 e 13.');

    const link = Number(body.valor_link);
    if (body.valor_link !== null && body.valor_link !== undefined && (!Number.isInteger(link) || link < 1 || link > 6))
        erros.push('Valor link deve ser entre 1 e 6.');

    if (body.setas_link) {
        const setas = body.setas_link.split(',').map(s => s.trim()).filter(Boolean);
        if (setas.some(s => !SETAS_VALIDAS.has(s)))
            erros.push('Setas link contêm valores inválidos.');
    }

    if (body.imagem) {
        const isBase64 = body.imagem.startsWith('data:image/');
        const isUrl    = /^https?:\/\/.+/.test(body.imagem);
        if (!isBase64 && !isUrl)
            erros.push('Imagem deve ser uma URL http(s) ou arquivo base64 válido.');
        if (isBase64 && body.imagem.length > 5.5 * 1024 * 1024)
            erros.push('Imagem muito grande (máximo ~4 MB).');
    }

    return erros;
}

function errDetail(e) {
    return isProd ? {} : { details: e.message };
}

// ── Proxy de imagem (YGOPRODeck → base64 sem CORS) ───────
app.get('/api/proxy-image', apiLimiter, (req, res) => {
    const { url } = req.query;
    if (!url || !url.startsWith('https://images.ygoprodeck.com/')) {
        return res.status(400).json({ error: 'URL não permitida.' });
    }
    https.get(url, (imgRes) => {
        if (imgRes.statusCode !== 200) {
            imgRes.resume();
            return res.status(502).json({ error: 'Falha ao buscar imagem.' });
        }
        res.setHeader('Content-Type', imgRes.headers['content-type'] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        imgRes.pipe(res);
    }).on('error', () => res.status(502).json({ error: 'Falha ao buscar imagem.' }));
});

// ── Rotas da API ─────────────────────────────────────────

app.get('/api/cartas', async (req, res) => {
    try {
        res.json(await db.all());
    } catch (e) {
        console.error('[GET /api/cartas]', e.message);
        res.status(500).json({ error: 'Erro ao listar cartas.', ...errDetail(e) });
    }
});

app.get('/api/cartas/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1)
        return res.status(400).json({ error: 'ID inválido.' });
    try {
        const carta = await db.get(id);
        if (!carta) return res.status(404).json({ error: 'Carta não encontrada.' });
        res.json(carta);
    } catch (e) {
        console.error('[GET /api/cartas/:id]', e.message);
        res.status(500).json({ error: 'Erro ao buscar carta.', ...errDetail(e) });
    }
});

app.post('/api/cartas', writeLimiter, async (req, res) => {
    const erros = validateCarta(req.body);
    if (erros.length) return res.status(400).json({ error: erros[0], erros });

    const {
        nome, tipo, atributo, nivel, tipo_monstro, tipo_efeito,
        ataque, defesa, tipo_magia, tipo_armadilha, descricao, imagem,
        materiais, escala_esq, escala_dir, efeito_pendulo, valor_link, setas_link
    } = req.body;

    try {
        const nova = await db.insert({
            nome: nome.trim(), tipo,
            atributo:       atributo || null,
            nivel:          nivel ?? null,
            tipo_monstro:   tipo_monstro?.trim() || null,
            tipo_efeito:    tipo_efeito || null,
            ataque:         ataque  != null ? Number(ataque)  : null,
            defesa:         defesa  != null ? Number(defesa)  : null,
            tipo_magia:     tipo_magia     || null,
            tipo_armadilha: tipo_armadilha || null,
            descricao:      descricao?.trim()      || null,
            imagem:         imagem                 || null,
            materiais:      materiais?.trim()      || null,
            escala_esq:     escala_esq != null ? Number(escala_esq) : null,
            escala_dir:     escala_dir != null ? Number(escala_dir) : null,
            efeito_pendulo: efeito_pendulo?.trim() || null,
            valor_link:     valor_link != null ? Number(valor_link) : null,
            setas_link:     setas_link || null,
        });
        res.status(201).json(nova);
    } catch (e) {
        console.error('[POST /api/cartas]', e.message);
        res.status(500).json({ error: 'Erro ao criar carta.', ...errDetail(e) });
    }
});

app.put('/api/cartas/:id', writeLimiter, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1)
        return res.status(400).json({ error: 'ID inválido.' });

    const erros = validateCarta(req.body);
    if (erros.length) return res.status(400).json({ error: erros[0], erros });

    const {
        nome, tipo, atributo, nivel, tipo_monstro, tipo_efeito,
        ataque, defesa, tipo_magia, tipo_armadilha, descricao, imagem,
        materiais, escala_esq, escala_dir, efeito_pendulo, valor_link, setas_link
    } = req.body;

    try {
        const atualizada = await db.update(id, {
            nome: nome.trim(), tipo,
            atributo:       atributo || null,
            nivel:          nivel ?? null,
            tipo_monstro:   tipo_monstro?.trim() || null,
            tipo_efeito:    tipo_efeito || null,
            ataque:         ataque  != null ? Number(ataque)  : null,
            defesa:         defesa  != null ? Number(defesa)  : null,
            tipo_magia:     tipo_magia     || null,
            tipo_armadilha: tipo_armadilha || null,
            descricao:      descricao?.trim()      || null,
            imagem:         imagem                 || null,
            materiais:      materiais?.trim()      || null,
            escala_esq:     escala_esq != null ? Number(escala_esq) : null,
            escala_dir:     escala_dir != null ? Number(escala_dir) : null,
            efeito_pendulo: efeito_pendulo?.trim() || null,
            valor_link:     valor_link != null ? Number(valor_link) : null,
            setas_link:     setas_link || null,
        });
        if (!atualizada) return res.status(404).json({ error: 'Carta não encontrada.' });
        res.json(atualizada);
    } catch (e) {
        console.error('[PUT /api/cartas/:id]', e.message);
        res.status(500).json({ error: 'Erro ao atualizar carta.', ...errDetail(e) });
    }
});

app.delete('/api/cartas/:id', writeLimiter, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1)
        return res.status(400).json({ error: 'ID inválido.' });
    try {
        const ok = await db.delete(id);
        if (!ok) return res.status(404).json({ error: 'Carta não encontrada.' });
        res.json({ message: 'Carta deletada com sucesso.' });
    } catch (e) {
        console.error('[DELETE /api/cartas/:id]', e.message);
        res.status(500).json({ error: 'Erro ao deletar carta.', ...errDetail(e) });
    }
});

if (require.main === module) {
    app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
}

module.exports = app;
