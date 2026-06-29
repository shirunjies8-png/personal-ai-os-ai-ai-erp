const db = require('./baseModel');

function create(user) {
  const stmt = db.prepare(`
    INSERT INTO users (id, enterprise_id, email, password_hash, name, role, status, department, team, created_at, updated_at)
    VALUES (@id, @enterprise_id, @email, @password_hash, @name, @role, @status, @department, @team, @created_at, @updated_at)
  `);
  stmt.run(user);
  return findById(user.id);
}

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function updatePassword(id, passwordHash) {
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(passwordHash, new Date().toISOString(), id);
  return findById(id);
}

function listByEnterprise(enterpriseId) {
  return db.prepare('SELECT id, enterprise_id, email, name, role, status, department, team, created_at, updated_at FROM users WHERE enterprise_id = ? ORDER BY created_at DESC').all(enterpriseId);
}

module.exports = {
  create,
  findByEmail,
  findById,
  updatePassword,
  listByEnterprise
};
