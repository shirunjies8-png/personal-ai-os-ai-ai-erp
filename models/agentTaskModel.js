const db = require('./baseModel');

function parseRow(row) {
  if (!row) return null;
  return {
    ...row,
    input_payload: row.input_payload ? JSON.parse(row.input_payload) : {},
    output_payload: row.output_payload ? JSON.parse(row.output_payload) : {}
  };
}

function create(entry) {
  db.prepare(`
    INSERT INTO agent_tasks (
      id, enterprise_id, user_id, agent_name, title, goal, status, current_step, total_steps,
      input_payload, output_payload, error_code, error_message, retry_count, confidence,
      needs_approval, created_at, updated_at
    ) VALUES (
      @id, @enterprise_id, @user_id, @agent_name, @title, @goal, @status, @current_step, @total_steps,
      @input_payload, @output_payload, @error_code, @error_message, @retry_count, @confidence,
      @needs_approval, @created_at, @updated_at
    )
  `).run({
    ...entry,
    input_payload: JSON.stringify(entry.input_payload || {}),
    output_payload: JSON.stringify(entry.output_payload || {})
  });
  return findById(entry.id);
}

function update(id, patch = {}) {
  const current = findById(id);
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    input_payload: patch.input_payload ?? current.input_payload,
    output_payload: patch.output_payload ?? current.output_payload,
    updated_at: patch.updated_at || new Date().toISOString()
  };
  db.prepare(`
    UPDATE agent_tasks SET
      status = @status,
      current_step = @current_step,
      total_steps = @total_steps,
      input_payload = @input_payload,
      output_payload = @output_payload,
      error_code = @error_code,
      error_message = @error_message,
      retry_count = @retry_count,
      confidence = @confidence,
      needs_approval = @needs_approval,
      updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    status: next.status,
    current_step: next.current_step,
    total_steps: next.total_steps,
    input_payload: JSON.stringify(next.input_payload || {}),
    output_payload: JSON.stringify(next.output_payload || {}),
    error_code: next.error_code || '',
    error_message: next.error_message || '',
    retry_count: next.retry_count || 0,
    confidence: Number(next.confidence || 0),
    needs_approval: next.needs_approval ? 1 : 0,
    updated_at: next.updated_at
  });
  return findById(id);
}

function findById(id) {
  return parseRow(db.prepare('SELECT * FROM agent_tasks WHERE id = ?').get(id));
}

function listByEnterprise(enterpriseId, limit = 100) {
  return db.prepare('SELECT * FROM agent_tasks WHERE enterprise_id = ? ORDER BY updated_at DESC LIMIT ?')
    .all(enterpriseId, limit)
    .map(parseRow);
}

module.exports = {
  create,
  update,
  findById,
  listByEnterprise
};
