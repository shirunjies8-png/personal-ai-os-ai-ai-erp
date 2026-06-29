const db = require('./baseModel');

function list(enterpriseId) {
  return db.prepare('SELECT * FROM orders WHERE enterprise_id = ? ORDER BY created_at DESC').all(enterpriseId);
}

function create(order) {
  db.prepare(`
    INSERT INTO orders (id, enterprise_id, order_no, customer, product, quantity, delivery_date, status, priority, created_at, updated_at)
    VALUES (@id, @enterprise_id, @order_no, @customer, @product, @quantity, @delivery_date, @status, @priority, @created_at, @updated_at)
  `).run(order);
  return findById(order.id, order.enterprise_id);
}

function findById(id, enterpriseId) {
  return db.prepare('SELECT * FROM orders WHERE id = ? AND enterprise_id = ?').get(id, enterpriseId);
}

function update(order) {
  db.prepare(`
    UPDATE orders
    SET order_no = @order_no,
        customer = @customer,
        product = @product,
        quantity = @quantity,
        delivery_date = @delivery_date,
        status = @status,
        priority = @priority,
        updated_at = @updated_at
    WHERE id = @id AND enterprise_id = @enterprise_id
  `).run(order);
  return findById(order.id, order.enterprise_id);
}

function remove(id, enterpriseId) {
  return db.prepare('DELETE FROM orders WHERE id = ? AND enterprise_id = ?').run(id, enterpriseId);
}

module.exports = {
  list,
  create,
  findById,
  update,
  remove
};
