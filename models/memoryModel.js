const db = require('./baseModel');

function parseRow(row) {
  if (!row) return null;
  return {
    ...row,
    payload: row.payload ? JSON.parse(row.payload) : {}
  };
}

function upsert(entry) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO memory_entries (
      id, enterprise_id, user_id, memory_type, memory_key, payload, created_at, updated_at
    ) VALUES (
      @id, @enterprise_id, @user_id, @memory_type, @memory_key, @payload, @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).run({
    ...entry,
    payload: JSON.stringify(entry.payload || {}),
    created_at: entry.created_at || now,
    updated_at: now
  });
}

function listByEnterprise(enterpriseId, limit = 100) {
  return db.prepare('SELECT * FROM memory_entries WHERE enterprise_id = ? ORDER BY updated_at DESC LIMIT ?')
    .all(enterpriseId, limit)
    .map(parseRow);
}

function removeByEnterprise(enterpriseId, memoryType = '') {
  if (memoryType) {
    db.prepare('DELETE FROM memory_entries WHERE enterprise_id = ? AND memory_type = ?').run(enterpriseId, memoryType);
    return;
  }
  db.prepare('DELETE FROM memory_entries WHERE enterprise_id = ?').run(enterpriseId);
}

module.exports = {
  upsert,
  listByEnterprise,
  removeByEnterprise
};
