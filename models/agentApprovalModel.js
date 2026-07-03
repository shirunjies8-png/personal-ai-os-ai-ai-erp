const db = require('./baseModel');

function parseRow(row) {
  if (!row) return null;
  return {
    ...row,
    payload: row.payload ? JSON.parse(row.payload) : {}
  };
}

function create(entry) {
  db.prepare(`
    INSERT INTO agent_approvals (
      id, task_id, enterprise_id, user_id, tool_name, action_label, status, reason,
      payload, approved_by, created_at, updated_at
    ) VALUES (
      @id, @task_id, @enterprise_id, @user_id, @tool_name, @action_label, @status, @reason,
      @payload, @approved_by, @created_at, @updated_at
    )
  `).run({
    ...entry,
    payload: JSON.stringify(entry.payload || {})
  });
  return findById(entry.id);
}

function update(id, patch = {}) {
  const current = findById(id);
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    payload: patch.payload ?? current.payload,
    updated_at: patch.updated_at || new Date().toISOString()
  };
  db.prepare(`
    UPDATE agent_approvals SET
      status = @status,
      reason = @reason,
      payload = @payload,
      approved_by = @approved_by,
      updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    status: next.status,
    reason: next.reason || '',
    payload: JSON.stringify(next.payload || {}),
    approved_by: next.approved_by || '',
    updated_at: next.updated_at
  });
  return findById(id);
}

function findById(id) {
  return parseRow(db.prepare('SELECT * FROM agent_approvals WHERE id = ?').get(id));
}

function findPendingByTask(taskId) {
  return parseRow(db.prepare('SELECT * FROM agent_approvals WHERE task_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1')
    .get(taskId, 'pending'));
}

function listPendingByEnterprise(enterpriseId) {
  return db.prepare('SELECT * FROM agent_approvals WHERE enterprise_id = ? AND status = ? ORDER BY created_at DESC')
    .all(enterpriseId, 'pending')
    .map(parseRow);
}

module.exports = {
  create,
  update,
  findById,
  findPendingByTask,
  listPendingByEnterprise
};
