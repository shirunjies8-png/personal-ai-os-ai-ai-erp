const agentRuntimeService = require('../services/agentRuntimeService');
const memoryService = require('../services/memoryService');
const { executeTool } = require('../services/toolRegistry');
const { ok, fail } = require('../utils/response');

async function createTask(req, res) {
  try {
    const task = await agentRuntimeService.createTask({
      enterpriseId: req.user.enterprise_id,
      userId: req.user.id,
      role: req.user.role,
      goal: String(req.body.goal || '').trim(),
      input: req.body.input || {}
    });
    ok(res, { task }, 'Agent 任务已创建并开始执行');
  } catch (error) {
    fail(res, 400, error.message || 'Agent 任务创建失败');
  }
}

function listTasks(req, res) {
  ok(res, {
    items: agentRuntimeService.listTasks(req.user.enterprise_id)
  });
}

function getTask(req, res) {
  const task = agentRuntimeService.getTask(req.params.id);
  if (!task || task.enterprise_id !== req.user.enterprise_id) return fail(res, 404, '任务不存在');
  ok(res, { task });
}

async function approveTask(req, res) {
  try {
    const task = await agentRuntimeService.approveTask(
      req.params.id,
      { enterpriseId: req.user.enterprise_id, userId: req.user.id, name: req.user.name || req.user.email || req.user.id, role: req.user.role },
      Boolean(req.body.approved),
      String(req.body.reason || '')
    );
    ok(res, { task }, req.body.approved ? '审批已通过，任务继续执行' : '审批已拒绝，任务已终止');
  } catch (error) {
    fail(res, 400, error.message || '审批失败');
  }
}

function cancelTask(req, res) {
  try {
    const task = agentRuntimeService.cancelTask(req.params.id, '用户主动取消');
    ok(res, { task }, '任务已取消');
  } catch (error) {
    fail(res, 400, error.message || '取消失败');
  }
}

async function retryTask(req, res) {
  try {
    const task = await agentRuntimeService.retryTask(req.params.id);
    ok(res, { task }, '任务已重新执行');
  } catch (error) {
    fail(res, 400, error.message || '重试失败');
  }
}

function listTools(_req, res) {
  ok(res, { items: agentRuntimeService.listTools() });
}

async function executeRuntimeTool(req, res) {
  try {
    const result = await executeTool(req.params.name, req.body.input || {}, {
      requestId: req.body.requestId || '',
      module: 'tool-center',
      role: req.user.role,
      requireApproval: true
    });
    ok(res, { result }, result.status === 'waiting_human' ? '高风险操作等待人工确认' : (result.ok ? '工具执行完成' : '工具执行失败'));
  } catch (error) {
    fail(res, 400, error.message || '工具执行失败');
  }
}

function monitor(req, res) {
  ok(res, {
    monitor: agentRuntimeService.getMonitorStats(req.user.enterprise_id)
  });
}

function listMemory(req, res) {
  ok(res, {
    items: memoryService.list(req.user.enterprise_id)
  });
}

function clearMemory(req, res) {
  memoryService.clear(req.user.enterprise_id, String(req.body.type || ''));
  ok(res, {}, 'Memory 已清空');
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  approveTask,
  cancelTask,
  retryTask,
  listTools,
  executeRuntimeTool,
  monitor,
  listMemory,
  clearMemory
};
