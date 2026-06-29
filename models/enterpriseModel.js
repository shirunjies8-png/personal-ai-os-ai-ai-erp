const db = require('./baseModel');

function create(enterprise) {
  db.prepare(`
    INSERT INTO enterprises (id, name, logo_url, contact_name, contact_phone, created_at, updated_at)
    VALUES (@id, @name, @logo_url, @contact_name, @contact_phone, @created_at, @updated_at)
  `).run(enterprise);
  return findById(enterprise.id);
}

function findById(id) {
  return db.prepare('SELECT * FROM enterprises WHERE id = ?').get(id);
}

function updateById(id, payload) {
  const current = findById(id);
  const next = { ...current, ...payload, updated_at: new Date().toISOString() };
  db.prepare(`
    UPDATE enterprises
    SET name = @name,
        logo_url = @logo_url,
        contact_name = @contact_name,
        contact_phone = @contact_phone,
        updated_at = @updated_at
    WHERE id = @id
  `).run(next);
  return findById(id);
}

module.exports = {
  create,
  findById,
  updateById
};
