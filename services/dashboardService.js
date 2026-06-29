const orderModel = require('../models/orderModel');
const inventoryModel = require('../models/inventoryModel');
const feedbackModel = require('../models/feedbackModel');
const logModel = require('../models/logModel');

function getDashboard(enterpriseId) {
  const orders = orderModel.list(enterpriseId);
  const inventory = inventoryModel.list(enterpriseId);
  const feedback = feedbackModel.list(enterpriseId);
  const delayedOrders = orders.filter(item => item.delivery_date && new Date(item.delivery_date) < new Date() && item.status !== '已完成');
  const lowStock = inventory.filter(item => Number(item.stock_quantity) <= Number(item.safety_stock));
  const todayPlan = orders.filter(item => item.status !== '已完成').slice(0, 10);
  const logs = logModel.list(enterpriseId, 50);

  return {
    todayOrders: orders.length,
    inventoryAlerts: lowStock.length,
    delayedOrders: delayedOrders.length,
    todayPlan: todayPlan.length,
    aiSuggestions: lowStock.length ? ['优先补充低库存物料', '复核延期订单交期'] : ['当前库存风险较低，建议优先处理高优先级订单'],
    agentExecutions: logs.filter(item => item.type === 'agent').length,
    aiLearningTimes: feedback.length,
    systemStatus: '正常'
  };
}

module.exports = {
  getDashboard
};
