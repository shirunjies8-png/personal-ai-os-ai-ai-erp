const db = require('./baseModel');

function getByEnterpriseId(enterpriseId) {
  const row = db.prepare('SELECT * FROM app_states WHERE enterprise_id = ?').get(enterpriseId);
  if (!row) return null;
  return {
    ...row,
    payload: row.payload ? JSON.parse(row.payload) : {}
  };
}

function upsert(enterpriseId, payload) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO app_states (enterprise_id, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(enterprise_id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).run(enterpriseId, JSON.stringify(payload), now);
  return getByEnterpriseId(enterpriseId);
}

module.exports = {
  getByEnterpriseId,
  upsert
};
