const fs   = require('fs');
const path = require('path');

const mongodb = require('mongodb');
const { MongoClient } = mongodb;

// ── Adaptador JSON — desenvolvimento local ──────────────
function createJsonDB() {
    const DB_FILE = path.join(__dirname, '..', 'yugioh.json');
    let state = {
        nextId: 1, cartas: [],
        userNextId: 1, users: [],
        deckNextId: 1, decks: [],
        histNextId: 1, historico: [],
    };

    if (fs.existsSync(DB_FILE)) {
        try {
            const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            state = {
                userNextId: 1, users: [],
                deckNextId: 1, decks: [],
                histNextId: 1, historico: [],
                ...loaded,
            };
        } catch {}
    }

    function save() { fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2)); }

    return {
        // ── Cartas ──
        async all(username) {
            return [...state.cartas]
                .filter(c => c.username === username)
                .sort((a, b) => b.id - a.id);
        },
        async get(id, username) {
            return state.cartas.find(c => c.id === Number(id) && c.username === username) || null;
        },
        async insert(fields) {
            const id    = state.nextId++;
            const carta = { id, ...fields, criado_em: new Date().toISOString() };
            state.cartas.push(carta);
            save();
            return carta;
        },
        async update(id, username, fields) {
            const idx = state.cartas.findIndex(c => c.id === Number(id) && c.username === username);
            if (idx === -1) return null;
            state.cartas[idx] = { ...state.cartas[idx], ...fields };
            save();
            return state.cartas[idx];
        },
        async delete(id, username) {
            const idx = state.cartas.findIndex(c => c.id === Number(id) && c.username === username);
            if (idx === -1) return false;
            state.cartas.splice(idx, 1);
            save();
            return true;
        },

        // ── Usuários ──
        async findUserByUsername(username) {
            return state.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
        },
        async createUser(username, passwordHash) {
            const id   = state.userNextId++;
            const user = { id, username, password: passwordHash, criado_em: new Date().toISOString() };
            state.users.push(user);
            save();
            return { id, username };
        },

        // ── Decks ──
        async allDecks(username) {
            return [...state.decks]
                .filter(d => d.username === username)
                .sort((a, b) => b.id - a.id);
        },
        async getDeck(id, username) {
            return state.decks.find(d => d.id === Number(id) && d.username === username) || null;
        },
        async insertDeck(fields) {
            const id   = state.deckNextId++;
            const deck = { id, ...fields, criado_em: new Date().toISOString() };
            state.decks.push(deck);
            save();
            return deck;
        },
        async updateDeck(id, username, fields) {
            const idx = state.decks.findIndex(d => d.id === Number(id) && d.username === username);
            if (idx === -1) return null;
            state.decks[idx] = { ...state.decks[idx], ...fields };
            save();
            return state.decks[idx];
        },
        async deleteDeck(id, username) {
            const idx = state.decks.findIndex(d => d.id === Number(id) && d.username === username);
            if (idx === -1) return false;
            state.decks.splice(idx, 1);
            save();
            return true;
        },

        // ── Histórico ──
        async addHistorico(cardId, username, dados) {
            const id    = state.histNextId++;
            const entry = { id, cardId, username, dados, criado_em: new Date().toISOString() };
            state.historico.push(entry);
            // Manter no máximo 20 snapshots por carta
            const snapshots = state.historico.filter(h => h.cardId === cardId && h.username === username);
            if (snapshots.length > 20) {
                const oldest = snapshots.sort((a, b) => a.id - b.id)[0];
                state.historico = state.historico.filter(h => h.id !== oldest.id);
            }
            save();
            return entry;
        },
        async getHistorico(cardId, username) {
            return state.historico
                .filter(h => h.cardId === cardId && h.username === username)
                .sort((a, b) => b.id - a.id)
                .slice(0, 20);
        },
        async getHistoricoEntry(hid, cardId, username) {
            return state.historico.find(
                h => h.id === Number(hid) && h.cardId === cardId && h.username === username
            ) || null;
        },
    };
}

// ── Adaptador MongoDB — produção (Vercel + Atlas) ───────
function createMongoDB() {
    if (!global._mongoClientPromise) {
        const client = new MongoClient(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS:         5000,
            socketTimeoutMS:          10000,
        });
        global._mongoClientPromise = client.connect().then(() => client);
    }

    async function getDB() {
        const client = await global._mongoClientPromise;
        return client.db('yugioh');
    }

    async function seqNext(db, key) {
        const result = await db.collection('counters').findOneAndUpdate(
            { _id: key },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: 'after' }
        );
        return result.seq;
    }

    function strip(doc) {
        if (!doc) return null;
        const { _id, ...rest } = doc;
        return rest;
    }

    return {
        // ── Cartas ──
        async all(username) {
            const db   = await getDB();
            const docs = await db.collection('cartas').find({ username }).sort({ id: -1 }).toArray();
            return docs.map(strip);
        },
        async get(id, username) {
            const db = await getDB();
            return strip(await db.collection('cartas').findOne({ id: Number(id), username }));
        },
        async insert(fields) {
            const db    = await getDB();
            const id    = await seqNext(db, 'cartaId');
            const carta = { id, ...fields, criado_em: new Date().toISOString() };
            await db.collection('cartas').insertOne(carta);
            return strip(carta);
        },
        async update(id, username, fields) {
            const db  = await getDB();
            const doc = await db.collection('cartas').findOneAndUpdate(
                { id: Number(id), username },
                { $set: fields },
                { returnDocument: 'after' }
            );
            return strip(doc);
        },
        async delete(id, username) {
            const db  = await getDB();
            const res = await db.collection('cartas').deleteOne({ id: Number(id), username });
            return res.deletedCount > 0;
        },

        // ── Usuários ──
        async findUserByUsername(username) {
            const db = await getDB();
            return await db.collection('users').findOne(
                { username: { $regex: new RegExp(`^${username}$`, 'i') } }
            );
        },
        async createUser(username, passwordHash) {
            const db  = await getDB();
            const doc = { username, password: passwordHash, criado_em: new Date().toISOString() };
            const res = await db.collection('users').insertOne(doc);
            return { id: res.insertedId.toString(), username };
        },

        // ── Decks ──
        async allDecks(username) {
            const db   = await getDB();
            const docs = await db.collection('decks').find({ username }).sort({ id: -1 }).toArray();
            return docs.map(strip);
        },
        async getDeck(id, username) {
            const db = await getDB();
            return strip(await db.collection('decks').findOne({ id: Number(id), username }));
        },
        async insertDeck(fields) {
            const db   = await getDB();
            const id   = await seqNext(db, 'deckId');
            const deck = { id, ...fields, criado_em: new Date().toISOString() };
            await db.collection('decks').insertOne(deck);
            return strip(deck);
        },
        async updateDeck(id, username, fields) {
            const db  = await getDB();
            const doc = await db.collection('decks').findOneAndUpdate(
                { id: Number(id), username },
                { $set: fields },
                { returnDocument: 'after' }
            );
            return strip(doc);
        },
        async deleteDeck(id, username) {
            const db  = await getDB();
            const res = await db.collection('decks').deleteOne({ id: Number(id), username });
            return res.deletedCount > 0;
        },

        // ── Histórico ──
        async addHistorico(cardId, username, dados) {
            const db  = await getDB();
            const id  = await seqNext(db, 'histId');
            const entry = { id, cardId, username, dados, criado_em: new Date().toISOString() };
            await db.collection('historico').insertOne(entry);
            // Manter no máximo 20 por carta
            const count = await db.collection('historico').countDocuments({ cardId, username });
            if (count > 20) {
                const oldest = await db.collection('historico')
                    .find({ cardId, username }).sort({ id: 1 }).limit(count - 20).toArray();
                const ids = oldest.map(h => h._id);
                await db.collection('historico').deleteMany({ _id: { $in: ids } });
            }
            return strip(entry);
        },
        async getHistorico(cardId, username) {
            const db   = await getDB();
            const docs = await db.collection('historico')
                .find({ cardId, username }).sort({ id: -1 }).limit(20).toArray();
            return docs.map(strip);
        },
        async getHistoricoEntry(hid, cardId, username) {
            const db = await getDB();
            return strip(await db.collection('historico').findOne({ id: Number(hid), cardId, username }));
        },
    };
}

module.exports = process.env.MONGODB_URI ? createMongoDB() : createJsonDB();
