const db = require('./baseModel');

function list(enterpriseId) {
  return db.prepare('SELECT * FROM inventory WHERE enterprise_id = ? ORDER BY updated_at DESC').all(enterpriseId);
}

function findById(id, enterpriseId) {
  return db.prepare('SELECT * FROM inventory WHERE id = ? AND enterprise_id = ?').get(id, enterpriseId);
}

function update(item) {
  db.prepare(`
    UPDATE inventory
    SET product_code = @product_code,
        product_name = @product_name,
        safety_stock = @safety_stock,
        location = @location,
        updated_at = @updated_at
    WHERE id = @id AND enterprise_id = @enterprise_id
  `).run(item);
  return findById(item.id, item.enterprise_id);
}

function remove(id, enterpriseId) {
  return db.prepare('DELETE FROM inventory WHERE id = ? AND enterprise_id = ?').run(id, enterpriseId);
}

module.exports = {
  list,
  findById,
  update,
  remove
};
