const { v4: uuidv4 } = require('uuid');
const agentTaskModel = require('../models/agentTaskModel');
const agentTaskLogModel = require('../models/agentTaskLogModel');
const agentApprovalModel = require('../models/agentApprovalModel');
const { executeTool, listTools, detectTool, mapRole, classifyFailure } = require('./toolRegistry');
const { chat: gatewayChat } = require('./aiGateway');
const memoryService = require('./memoryService');
const permissionService = require('./permissionService');
const approvalService = require('./approvalService');
const { recoveryPlan } = require('./taskRecoveryService');
const { sanitize } = require('../utils/logger');
const workflowService = require('./agentWorkflowService');
const logService = require('./logService');

const ACTIVE_RUNS = new Map();
const TASK_STATES = ['pending', 'running', 'waiting_human', 'success', 'failed', 'timeout', 'cancelled'];

function taskTitle(goal = '') {
  return String(goal || 'Agent 任务').slice(0, 60);
}

function friendlyToolError(error = '') {
  const text = String(error || '');
  if (/参数缺失/.test(text)) return text;
  if (/类型错误/.test(text)) return text;
  if (/文件过大/.test(text)) return text;
  if (/格式不支持/.test(text)) return text;
  if (/权限不足/.test(text)) return text;
  if (/超时|TIMEOUT/.test(text)) return '执行超时';
  if (/工具不可用/.test(text)) return text;
  if (/AI/.test(text)) return text;
  return text || '工具执行失败';
}

function addTaskLog(task, entry = {}) {
  agentTaskLogModel.add({
    id: uuidv4(),
    task_id: task.id,
    enterprise_id: task.enterprise_id,
    user_id: task.user_id,
    request_id: entry.requestId || '',
    agent_name: entry.agentName || task.agent_name,
    tool_name: entry.toolName || '',
    status: entry.status || 'running',
    duration_ms: Number(entry.durationMs || 0),
    retry_count: Number(entry.retryCount || 0),
    error_code: entry.errorCode || '',
    error_message: entry.errorMessage || '',
    detail: entry.detail || '',
    created_at: new Date().toISOString()
  });
}

function buildPlan(goal = '', role = 'operator', input = {}) {
  if (input.workflowType === '8d') {
    return [
      { key: 'analyze_goal', label: '确认 8D 问题范围', type: 'agent' },
      { key: 'run_8d', label: '执行 8D 闭环检查', type: 'workflow', workflowName: '8d' },
      { key: 'close_8d', label: '确认 8D 结案', type: 'approval', toolName: '8d_closure', actionLabel: '8D 结案确认' },
      { key: 'summarize', label: '汇总 8D 报告', type: 'ai' }
    ];
  }
  const text = String(goal || '');
  const plan = [];
  const toolName = detectTool(text);
  plan.push({ key: 'analyze_goal', label: '理解任务目标', type: 'agent' });
  if (toolName) {
    plan.push({ key: 'execute_tool', label: `调用工具 ${toolName}`, type: 'tool', toolName });
  } else {
    plan.push({ key: 'execute_tool', label: '调用工具 status-query', type: 'tool', toolName: 'human_approval_tool' });
  }
  plan.push({ key: 'summarize', label: '汇总结果', type: 'ai' });
  return plan;
}

async function createTask({ enterpriseId, userId, role, goal, input = {} }) {
  permissionService.authorizeAgent({ role });
  const plan = buildPlan(goal, role, input);
  const now = new Date().toISOString();
  const task = agentTaskModel.create({
    id: uuidv4(),
    enterprise_id: enterpriseId,
    user_id: userId,
    agent_name: 'EnterpriseAgentRuntimeV1',
    title: taskTitle(goal),
    goal,
    status: 'pending',
    current_step: 0,
    total_steps: plan.length,
    input_payload: { ...input, plan, role: mapRole(role) },
    output_payload: { steps: plan, result: '', summary: '', logs: [] },
    error_code: '',
    error_message: '',
    retry_count: 0,
    confidence: 0,
    needs_approval: 0,
    created_at: now,
    updated_at: now
  });
  addTaskLog(task, { status: 'pending', detail: '任务已创建' });
  logService.add({ enterpriseId, userId, type: input.workflowType === '8d' ? '8d_workflow_created' : 'agent_task_created', title: task.title, detail: `任务 ${task.id} 已创建` });
  runTask(task.id).catch(() => {});
  return getTask(task.id);
}

function getTask(taskId) {
  const task = agentTaskModel.findById(taskId);
  if (!task) return null;
  return decorateTask({
    ...task,
    logs: agentTaskLogModel.listByTask(taskId),
    approval: agentApprovalModel.findPendingByTask(taskId)
  });
}

function listTasks(enterpriseId) {
  return agentTaskModel.listByEnterprise(enterpriseId, 100).map(task => ({
    ...task,
    logs: agentTaskLogModel.listByTask(task.id),
    approval: agentApprovalModel.findPendingByTask(task.id)
  })).map(decorateTask);
}

function decorateTask(task = {}) {
  const logs = Array.isArray(task.logs) ? task.logs : [];
  const startedAt = task.created_at ? new Date(task.created_at).getTime() : 0;
  const updatedAt = task.updated_at ? new Date(task.updated_at).getTime() : startedAt;
  const terminal = ['success', 'failed', 'timeout', 'cancelled'].includes(task.status);
  const failedLog = logs.slice().reverse().find(log => log.error_message || ['failed', 'timeout', 'cancelled'].includes(log.status));
  const tools = listTools();
  const openCircuitTools = tools.filter(tool => tool.circuitState === 'open');
  return {
    ...task,
    durationMs: startedAt && updatedAt ? Math.max(0, updatedAt - startedAt) : 0,
    finishedAt: terminal ? updatedAt : 0,
    retryCount: Number(task.retry_count || 0),
    failureType: classifyFailure(task.error_message || failedLog?.error_message || task.error_code || ''),
    circuitState: openCircuitTools.length ? 'open' : 'closed',
    circuitSummary: {
      openTools: openCircuitTools.map(tool => tool.toolName),
      totalOpen: openCircuitTools.length
    }
  };
}

async function requestApproval(task, step) {
  const approval = approvalService.request({
    taskId: task.id, enterpriseId: task.enterprise_id, userId: task.user_id,
    toolName: step.toolName || 'human_approval_tool', actionLabel: step.actionLabel || '高风险动作审批',
    reason: '检测到高风险动作，需要人工确认后继续执行', payload: { step }
  });
  agentTaskModel.update(task.id, { status: 'waiting_human', needs_approval: 1 });
  addTaskLog(task, {
    status: 'waiting_human',
    toolName: step.toolName || 'human_approval_tool',
    detail: `等待审批：${approval.action_label}`
  });
  return approval;
}

async function runTask(taskId) {
  if (ACTIVE_RUNS.has(taskId)) return getTask(taskId);
  const runner = (async () => {
    let task = agentTaskModel.findById(taskId);
    if (!task) throw new Error('任务不存在');
    if (task.status === 'cancelled') return getTask(taskId);
    const steps = Array.isArray(task.input_payload?.plan) ? task.input_payload.plan : [];
    agentTaskModel.update(task.id, { status: 'running', needs_approval: 0 });
    for (let index = Number(task.current_step || 0); index < steps.length; index += 1) {
      task = agentTaskModel.findById(task.id);
      if (!task || task.status === 'cancelled') break;
      const step = steps[index];
      const started = Date.now();
      if (step.type === 'approval') {
        await requestApproval(task, step);
        return getTask(task.id);
      }
      if (step.type === 'tool') {
        const highRisk = /file_generate_tool|web_api_tool|human_approval_tool/.test(step.toolName || '');
        const result = await executeTool(step.toolName, buildToolInput(task, step), {
          requestId: uuidv4().slice(0, 8),
          module: 'agent-runtime',
          role: task.input_payload?.role || 'operator',
          requireApproval: highRisk && task.input_payload?.approvedToolName !== step.toolName,
          actionLabel: step.label
        });
        if (result.status === 'waiting_human') {
          await requestApproval(task, { ...step, toolName: step.toolName, actionLabel: step.label });
          return getTask(task.id);
        }
        if (!result.ok) {
          const recovery = recoveryPlan(result.error, result.retryCount || 0);
          const failureType = result.failureType || recovery.failureType;
          agentTaskModel.update(task.id, {
            status: result.status === 'timeout' ? 'timeout' : 'failed',
            current_step: index,
            error_code: failureType || result.status || 'failed',
            error_message: friendlyToolError(result.error),
            retry_count: result.retryCount || 0
          });
          addTaskLog(task, {
            status: result.status || 'failed',
            toolName: result.toolName,
            requestId: result.requestId,
            durationMs: result.durationMs,
            retryCount: result.retryCount,
            errorCode: failureType || result.status || 'failed',
            errorMessage: friendlyToolError(result.error),
            detail: safeString(result.error)
          });
          return getTask(task.id);
        }
        const output = task.output_payload || {};
        output[`tool_${step.toolName}`] = result.data;
        output.logs = output.logs || [];
        output.logs.push({
          step: step.label,
          toolName: result.toolName,
          requestId: result.requestId,
          status: result.status,
          durationMs: result.durationMs,
          retryCount: result.retryCount || 0,
          failureType: result.failureType || '',
          circuitState: result.circuitState || 'closed'
        });
        agentTaskModel.update(task.id, {
          current_step: index + 1,
          output_payload: output,
          confidence: Math.max(Number(task.confidence || 0), Number(result.confidence || 0))
        });
        addTaskLog(task, {
          status: 'success',
          toolName: result.toolName,
          requestId: result.requestId,
          durationMs: result.durationMs,
          retryCount: result.retryCount,
          detail: JSON.stringify(result.data).slice(0, 2000)
        });
        continue;
      }
      if (step.type === 'workflow' && step.workflowName === '8d') {
        const output = task.output_payload || {};
        const report = workflowService.run8DWorkflow(task.input_payload?.eightD || task.input_payload || {});
        output.eightD = report;
        output.logs = output.logs || [];
        output.logs.push({ step: step.label, status: 'success', durationMs: Date.now() - started, completionRate: report.completionRate });
        agentTaskModel.update(task.id, { current_step: index + 1, output_payload: output, confidence: report.canRequestClosure ? 0.9 : 0.7 });
        addTaskLog(task, { status: 'success', durationMs: Date.now() - started, detail: sanitize(report.auditSummary) });
        logService.add({ enterpriseId: task.enterprise_id, userId: task.user_id, type: '8d_workflow_checked', title: '8D 闭环检查', detail: report.auditSummary });
        if (!report.canRequestClosure) {
          agentTaskModel.update(task.id, { status: 'waiting_human', needs_approval: 0, error_code: '8d_evidence_required', error_message: report.nextAction });
          addTaskLog(task, { status: 'waiting_human', detail: report.nextAction });
          return getTask(task.id);
        }
        continue;
      }
      if (step.type === 'agent') {
        const output = task.output_payload || {};
        output.logs = output.logs || [];
        output.logs.push({
          step: step.label,
          status: 'success',
          durationMs: Date.now() - started
        });
        agentTaskModel.update(task.id, { current_step: index + 1, output_payload: output });
        addTaskLog(task, { status: 'success', durationMs: Date.now() - started, detail: step.label });
        continue;
      }
      if (step.type === 'ai') {
        const output = task.output_payload || {};
        const toolResults = Object.entries(output)
          .filter(([key]) => key.startsWith('tool_'))
          .map(([key, value]) => `${key}:\n${JSON.stringify(value, null, 2)}`)
          .join('\n\n');
        const ai = await gatewayChat({
          module: 'agent-runtime',
          enterpriseId: task.enterprise_id,
          messages: [{
            role: 'user',
            content: `请基于以下任务与工具结果生成中文汇总。\n任务：${task.goal}\n\n工具结果：\n${toolResults || '未引用来源'}\n\n要求：1. 如果没有来源，明确写“未引用来源”。2. 不确定时写“无法确认”。3. 输出 confidence 字段。`
          }],
          allowMockFallback: false,
          demoMode: false,
          timeout: 30000
        });
        output.result = ai.content;
        output.summary = ai.content.slice(0, 800);
        output.confidence = toolResults ? 0.82 : 0.4;
        agentTaskModel.update(task.id, {
          current_step: index + 1,
          output_payload: output,
          confidence: output.confidence
        });
        addTaskLog(task, {
          status: 'success',
          requestId: ai.requestId,
          durationMs: ai.latencyMs,
          detail: 'AI 汇总完成'
        });
      }
    }
    task = agentTaskModel.findById(taskId);
    if (task && !['waiting_human', 'failed', 'timeout', 'cancelled'].includes(task.status)) {
      agentTaskModel.update(task.id, { status: 'success', current_step: task.total_steps, needs_approval: 0 });
      memoryService.remember({
        enterpriseId: task.enterprise_id,
        userId: task.user_id,
        type: 'task_memory',
        key: task.id,
        payload: {
          goal: task.goal,
          summary: task.output_payload?.summary || '',
          confidence: task.output_payload?.confidence || task.confidence || 0
        }
      });
    }
    return getTask(taskId);
  })();
  ACTIVE_RUNS.set(taskId, runner);
  try {
    return await runner;
  } finally {
    ACTIVE_RUNS.delete(taskId);
  }
}

function safeString(value) {
  return String(sanitize(String(value || ''))).slice(0, 2000);
}

function buildToolInput(task, step) {
  const payload = task.input_payload || {};
  const sourceText = payload.text || payload.prompt || payload.goal || task.goal;
  switch (step.toolName) {
    case 'excel_tool':
      return { filename: payload.filename || 'agent.xlsx', rows: payload.rows, text: sourceText };
    case 'csv_tool':
      return { filename: payload.filename || 'agent.csv', text: sourceText };
    case 'pdf_tool':
      return { filename: payload.filename || 'agent.pdf', text: sourceText };
    case 'ocr_tool':
      return { filename: payload.filename || 'agent.png', text: sourceText };
    case 'sqlite_query_tool':
      return { sql: payload.sql || 'SELECT name FROM sqlite_master WHERE type = "table"' };
    case 'file_generate_tool':
      return { filename: payload.outputName || 'agent-report.txt', content: payload.outputText || sourceText };
    case 'web_api_tool':
      return { url: payload.url || 'https://example.com' };
    case 'human_approval_tool':
      return { actionLabel: step.label, reason: '高风险动作需要人工确认' };
    default:
      return { text: sourceText, filename: payload.filename || 'agent.txt' };
  }
}

async function approveTask(taskId, actor, approved, reason = '') {
  const task = agentTaskModel.findById(taskId);
  if (!task) throw new Error('任务不存在');
  const pending = agentApprovalModel.findPendingByTask(taskId);
  if (!pending) throw new Error('当前任务没有待审批动作');
  approvalService.decide({ approvalId: pending.id, actor, approved, reason });
  addTaskLog(task, {
    status: approved ? 'success' : 'cancelled',
    toolName: pending.tool_name,
    detail: approved ? '审批通过，继续执行' : '审批拒绝，任务终止'
  });
  if (!approved) {
    agentTaskModel.update(task.id, { status: 'cancelled', error_code: 'approval_rejected', error_message: '审批已拒绝', needs_approval: 0 });
    return getTask(taskId);
  }
  agentTaskModel.update(task.id, {
    status: 'running', needs_approval: 0,
    input_payload: { ...(task.input_payload || {}), approvedToolName: pending.tool_name }
  });
  runTask(taskId).catch(() => {});
  return getTask(taskId);
}

function cancelTask(taskId, reason = '用户取消') {
  const task = agentTaskModel.findById(taskId);
  if (!task) throw new Error('任务不存在');
  agentTaskModel.update(taskId, { status: 'cancelled', error_code: 'cancelled', error_message: reason, needs_approval: 0 });
  addTaskLog(task, { status: 'cancelled', detail: reason });
  return getTask(taskId);
}

async function retryTask(taskId) {
  const task = agentTaskModel.findById(taskId);
  if (!task) throw new Error('任务不存在');
  agentTaskModel.update(taskId, {
    status: 'pending',
    current_step: 0,
    error_code: '',
    error_message: '',
    retry_count: Number(task.retry_count || 0) + 1,
    output_payload: { steps: task.input_payload?.plan || [], result: '', summary: '', logs: [] },
    needs_approval: 0
  });
  return createDetachedRun(taskId);
}

function createDetachedRun(taskId) {
  runTask(taskId).catch(() => {});
  return getTask(taskId);
}

function getMonitorStats(enterpriseId) {
  const items = listTasks(enterpriseId);
  const logs = items.flatMap(item => item.logs || []);
  const tools = listTools();
  const toolStats = tools.map(tool => {
    const own = logs.filter(log => log.tool_name === tool.toolName);
    const total = own.length;
    const success = own.filter(log => log.status === 'success').length;
    const failed = own.filter(log => ['failed', 'timeout', 'cancelled'].includes(log.status)).length;
    const avg = total ? Math.round(own.reduce((sum, log) => sum + Number(log.duration_ms || 0), 0) / total) : 0;
    const lastFailure = own.slice().reverse().find(log => log.error_message || ['failed', 'timeout', 'cancelled'].includes(log.status));
    return {
      toolName: tool.toolName,
      total,
      successRate: total ? Number((success / total).toFixed(2)) : 0,
      failureRate: total ? Number((failed / total).toFixed(2)) : 0,
      avgDurationMs: avg,
      retryPolicy: tool.retryPolicy,
      circuitState: tool.circuitState || 'closed',
      circuit: tool.circuit || {},
      lastFailureAt: tool.lastFailureAt || (lastFailure?.created_at ? new Date(lastFailure.created_at).getTime() : 0),
      lastFailureType: tool.lastFailureType || classifyFailure(lastFailure?.error_message || lastFailure?.error_code || ''),
      lastFailureMessage: lastFailure?.error_message || ''
    };
  });
  const failedItems = items.filter(item => ['failed', 'timeout', 'cancelled'].includes(item.status));
  return {
    totalTasks: items.length,
    successTasks: items.filter(item => item.status === 'success').length,
    failedTasks: items.filter(item => item.status === 'failed').length,
    timeoutTasks: items.filter(item => item.status === 'timeout').length,
    waitingHumanTasks: items.filter(item => item.status === 'waiting_human').length,
    retryingTasks: items.filter(item => Number(item.retry_count || item.retryCount || 0) > 0 && ['pending', 'running'].includes(item.status)).length,
    failureSummary: failedItems.reduce((acc, item) => {
      const key = item.failureType || classifyFailure(item.error_message || item.error_code || '');
      acc[key || 'runtime'] = (acc[key || 'runtime'] || 0) + 1;
      return acc;
    }, {}),
    circuitSummary: {
      openTools: toolStats.filter(tool => tool.circuitState === 'open').map(tool => tool.toolName),
      halfOpenTools: toolStats.filter(tool => tool.circuitState === 'half_open').map(tool => tool.toolName)
    },
    toolCallCount: logs.filter(log => log.tool_name).length,
    toolStats,
    recentLogs: logs.slice(-20).reverse()
  };
}

module.exports = {
  TASK_STATES,
  createTask,
  getTask,
  listTasks,
  approveTask,
  cancelTask,
  retryTask,
  getMonitorStats,
  listTools
};
