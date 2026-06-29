const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const env = require('../config/env');

fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });

const db = new Database(env.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
