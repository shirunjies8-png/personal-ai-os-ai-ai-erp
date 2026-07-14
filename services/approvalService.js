const { v4: uuidv4 } = require('uuid');
const approvalModel = require('../models/agentApprovalModel');
const permissionService = require('./permissionService');

function request({ taskId = '', enterpriseId, userId, toolName, actionLabel, reason, payload = {} }) {
  return approvalModel.create({
    id: uuidv4(), task_id: taskId, enterprise_id: enterpriseId, user_id: userId,
    tool_name: toolName, action_label: actionLabel, status: 'pending', reason,
    payload, approved_by: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  });
}

function decide({ approvalId, actor, approved, reason = '' }) {
  permissionService.authorizeApproval(actor);
  const pending = approvalModel.findById(approvalId);
  if (!pending || pending.status !== 'pending') throw new Error('审批请求不存在或已处理');
  if (pending.enterprise_id !== actor.enterpriseId) throw new Error('无权审批此请求');
  return approvalModel.update(approvalId, {
    status: approved ? 'approved' : 'rejected', reason: reason || pending.reason,
    approved_by: actor.name || actor.userId
  });
}

module.exports = { request, decide };
