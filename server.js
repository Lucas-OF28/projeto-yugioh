const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));   // suporta imagens em base64
app.use(express.static(path.join(__dirname)));

// ── GET all ──────────────────────────────────────────────
app.get('/api/cartas', async (req, res) => {
    try {
        res.json(await db.all());
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar cartas.' });
    }
});

// ── GET one ──────────────────────────────────────────────
app.get('/api/cartas/:id', async (req, res) => {
    try {
        const carta = await db.get(req.params.id);
        if (!carta) return res.status(404).json({ error: 'Carta não encontrada' });
        res.json(carta);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar carta.' });
    }
});

// ── POST create ──────────────────────────────────────────
app.post('/api/cartas', async (req, res) => {
    const {
        nome, tipo, atributo, nivel, tipo_monstro, tipo_efeito,
        ataque, defesa, tipo_magia, tipo_armadilha, descricao, imagem,
        materiais, escala_esq, escala_dir, efeito_pendulo, valor_link, setas_link
    } = req.body;

    if (!nome || !tipo) return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });

    try {
        const nova = await db.insert({
            nome, tipo,
            atributo: atributo ?? null,
            nivel: nivel ?? null,
            tipo_monstro: tipo_monstro ?? null,
            tipo_efeito: tipo_efeito ?? null,
            ataque: ataque ?? null,
            defesa: defesa ?? null,
            tipo_magia: tipo_magia ?? null,
            tipo_armadilha: tipo_armadilha ?? null,
            descricao: descricao ?? null,
            imagem: imagem ?? null,
            materiais: materiais ?? null,
            escala_esq: escala_esq ?? null,
            escala_dir: escala_dir ?? null,
            efeito_pendulo: efeito_pendulo ?? null,
            valor_link: valor_link ?? null,
            setas_link: setas_link ?? null,
        });
        res.status(201).json(nova);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao criar carta.' });
    }
});

// ── PUT update ───────────────────────────────────────────
app.put('/api/cartas/:id', async (req, res) => {
    const {
        nome, tipo, atributo, nivel, tipo_monstro, tipo_efeito,
        ataque, defesa, tipo_magia, tipo_armadilha, descricao, imagem,
        materiais, escala_esq, escala_dir, efeito_pendulo, valor_link, setas_link
    } = req.body;

    try {
        const atualizada = await db.update(req.params.id, {
            nome, tipo,
            atributo: atributo ?? null,
            nivel: nivel ?? null,
            tipo_monstro: tipo_monstro ?? null,
            tipo_efeito: tipo_efeito ?? null,
            ataque: ataque ?? null,
            defesa: defesa ?? null,
            tipo_magia: tipo_magia ?? null,
            tipo_armadilha: tipo_armadilha ?? null,
            descricao: descricao ?? null,
            imagem: imagem ?? null,
            materiais: materiais ?? null,
            escala_esq: escala_esq ?? null,
            escala_dir: escala_dir ?? null,
            efeito_pendulo: efeito_pendulo ?? null,
            valor_link: valor_link ?? null,
            setas_link: setas_link ?? null,
        });

        if (!atualizada) return res.status(404).json({ error: 'Carta não encontrada' });
        res.json(atualizada);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao atualizar carta.' });
    }
});

// ── DELETE ───────────────────────────────────────────────
app.delete('/api/cartas/:id', async (req, res) => {
    try {
        const ok = await db.delete(req.params.id);
        if (!ok) return res.status(404).json({ error: 'Carta não encontrada' });
        res.json({ message: 'Carta deletada com sucesso' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao deletar carta.' });
    }
});

// Exporta o app para o Vercel (serverless) e também inicia localmente
if (require.main === module) {
    app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
}

module.exports = app;
