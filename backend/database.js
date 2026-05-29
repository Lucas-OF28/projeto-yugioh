const fs   = require('fs');
const path = require('path');

const mongodb = require('mongodb');
const { MongoClient } = mongodb;

// ── Adaptador JSON — desenvolvimento local ──────────────
function createJsonDB() {
    const DB_FILE = path.join(__dirname, '..', 'yugioh.json');
    let state = { nextId: 1, cartas: [], userNextId: 1, users: [] };

    if (fs.existsSync(DB_FILE)) {
        try {
            const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            state = { userNextId: 1, users: [], ...loaded };
        } catch {}
    }

    function save() { fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2)); }

    return {
        async all(username)   {
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

    async function nextId(db) {
        const result = await db.collection('counters').findOneAndUpdate(
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
            const id    = await nextId(db);
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
    };
}

module.exports = process.env.MONGODB_URI ? createMongoDB() : createJsonDB();
