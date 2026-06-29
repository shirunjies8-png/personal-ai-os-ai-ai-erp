const db = require('./baseModel');

function list(enterpriseId) {
  return db.prepare('SELECT * FROM inventory WHERE enterprise_id = ? ORDER BY updated_at DESC').all(enterpriseId);
}

function create(item) {
  db.prepare(`
    INSERT INTO inventory (id, enterprise_id, product_code, product_name, stock_quantity, safety_stock, location, updated_at)
    VALUES (@id, @enterprise_id, @product_code, @product_name, @stock_quantity, @safety_stock, @location, @updated_at)
  `).run(item);
  return findById(item.id, item.enterprise_id);
}

function findById(id, enterpriseId) {
  return db.prepare('SELECT * FROM inventory WHERE id = ? AND enterprise_id = ?').get(id, enterpriseId);
}

function update(item) {
  db.prepare(`
    UPDATE inventory
    SET product_code = @product_code,
        product_name = @product_name,
        stock_quantity = @stock_quantity,
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
  create,
  findById,
  update,
  remove
};
