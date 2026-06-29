const db = require('./baseModel');

function create(record) {
  db.prepare(`
    INSERT INTO mail_records (id, enterprise_id, user_id, recipient, subject, mail_type, attachments, status, failure_reason, created_at)
    VALUES (@id, @enterprise_id, @user_id, @recipient, @subject, @mail_type, @attachments, @status, @failure_reason, @created_at)
  `).run({
    ...record,
    attachments: JSON.stringify(record.attachments || [])
  });
  return record;
}

function list(enterpriseId, limit = 100) {
  return db.prepare('SELECT * FROM mail_records WHERE enterprise_id = ? ORDER BY created_at DESC LIMIT ?').all(enterpriseId, limit)
    .map(item => ({ ...item, attachments: item.attachments ? JSON.parse(item.attachments) : [] }));
}

module.exports = {
  create,
  list
};
