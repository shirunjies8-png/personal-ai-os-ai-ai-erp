const orderModel = require('../models/orderModel');
const inventoryModel = require('../models/inventoryModel');
const { runWorkflow } = require('../services/agentWorkflowService');
const { ok } = require('../utils/response');
const logService = require('../services/logService');

function run(req, res) {
  const orders = orderModel.list(req.user.enterprise_id);
  const inventory = inventoryModel.list(req.user.enterprise_id);
  const result = runWorkflow({ rows: req.body.rows || [], orders, inventory });
  logService.add({
    enterpriseId: req.user.enterprise_id,
    userId: req.user.id,
    type: 'agent',
    title: '执行 Agentic Workflow',
    detail: JSON.stringify({ stepCount: result.workflow.length })
  });
  ok(res, result, 'Agent 工作流执行完成，等待人工确认');
}

module.exports = {
  run
};
