const fs   = require('fs');
const path = require('path');

// ── Adaptador JSON — desenvolvimento local ──────────────
function createJsonDB() {
    const DB_FILE = path.join(__dirname, 'yugioh.json');
    let state = { nextId: 1, cartas: [] };

    if (fs.existsSync(DB_FILE)) {
        try { state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch {}
    }

    function save() { fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2)); }

    return {
        async all()         { return [...state.cartas].sort((a, b) => b.id - a.id); },
        async get(id)       { return state.cartas.find(c => c.id === Number(id)) || null; },
        async insert(fields) {
            const id = state.nextId++;
            const carta = { id, ...fields, criado_em: new Date().toISOString() };
            state.cartas.push(carta);
            save();
            return carta;
        },
        async update(id, fields) {
            const idx = state.cartas.findIndex(c => c.id === Number(id));
            if (idx === -1) return null;
            state.cartas[idx] = { ...state.cartas[idx], ...fields };
            save();
            return state.cartas[idx];
        },
        async delete(id) {
            const idx = state.cartas.findIndex(c => c.id === Number(id));
            if (idx === -1) return false;
            state.cartas.splice(idx, 1);
            save();
            return true;
        }
    };
}

// ── Adaptador MongoDB — produção (Vercel + Atlas) ───────
// Reutiliza a conexão entre invocações serverless quentes (warm)
function createMongoDB() {
    const { MongoClient } = require('mongodb');

    // Cacheado no objeto global para sobreviver ao warm-start
    if (!global._mongoClient) {
        global._mongoClient = new MongoClient(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS:         5000,
            socketTimeoutMS:          10000,
        });
    }

    const client = global._mongoClient;

    async function getDB() {
        if (!client.topology || !client.topology.isConnected()) {
            await client.connect();
        }
        return client.db('yugioh');
    }

    async function nextId(database) {
        const result = await database.collection('counters').findOneAndUpdate(
            { _id: 'cartaId' },
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
        async all() {
            const db   = await getDB();
            const docs = await db.collection('cartas').find({}).sort({ id: -1 }).toArray();
            return docs.map(strip);
        },
        async get(id) {
            const db = await getDB();
            return strip(await db.collection('cartas').findOne({ id: Number(id) }));
        },
        async insert(fields) {
            const db    = await getDB();
            const id    = await nextId(db);
            const carta = { id, ...fields, criado_em: new Date().toISOString() };
            await db.collection('cartas').insertOne(carta);
            return strip(carta);
        },
        async update(id, fields) {
            const db  = await getDB();
            const doc = await db.collection('cartas').findOneAndUpdate(
                { id: Number(id) },
                { $set: fields },
                { returnDocument: 'after' }
            );
            return strip(doc);
        },
        async delete(id) {
            const db  = await getDB();
            const res = await db.collection('cartas').deleteOne({ id: Number(id) });
            return res.deletedCount > 0;
        }
    };
}

module.exports = process.env.MONGODB_URI ? createMongoDB() : createJsonDB();
