const db = require('./baseModel');

function create(feedback) {
  db.prepare(`
    INSERT INTO feedback (id, enterprise_id, user_id, category, rating, reason, modified_content, created_at)
    VALUES (@id, @enterprise_id, @user_id, @category, @rating, @reason, @modified_content, @created_at)
  `).run(feedback);
  return feedback;
}

function list(enterpriseId) {
  return db.prepare('SELECT * FROM feedback WHERE enterprise_id = ? ORDER BY created_at DESC').all(enterpriseId);
}

module.exports = {
  create,
  list
};
