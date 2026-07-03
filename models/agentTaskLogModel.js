const db = require('./baseModel');

function add(entry) {
  db.prepare(`
    INSERT INTO agent_task_logs (
      id, task_id, enterprise_id, user_id, request_id, agent_name, tool_name, status,
      duration_ms, retry_count, error_code, error_message, detail, created_at
    ) VALUES (
      @id, @task_id, @enterprise_id, @user_id, @request_id, @agent_name, @tool_name, @status,
      @duration_ms, @retry_count, @error_code, @error_message, @detail, @created_at
    )
  `).run(entry);
}

function listByTask(taskId) {
  return db.prepare('SELECT * FROM agent_task_logs WHERE task_id = ? ORDER BY created_at ASC').all(taskId);
}

function listRecentByEnterprise(enterpriseId, limit = 20) {
  return db.prepare('SELECT * FROM agent_task_logs WHERE enterprise_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(enterpriseId, limit);
}

module.exports = {
  add,
  listByTask,
  listRecentByEnterprise
};
