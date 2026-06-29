const db = require('./baseModel');

function add(entry) {
  db.prepare(`
    INSERT INTO logs (id, enterprise_id, user_id, type, title, detail, created_at)
    VALUES (@id, @enterprise_id, @user_id, @type, @title, @detail, @created_at)
  `).run(entry);
}

function list(enterpriseId, limit = 200) {
  return db.prepare('SELECT * FROM logs WHERE enterprise_id = ? ORDER BY created_at DESC LIMIT ?').all(enterpriseId, limit);
}

module.exports = {
  add,
  list
};
