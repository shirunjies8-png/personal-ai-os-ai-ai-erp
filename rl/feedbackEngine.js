const feedbackModel = require('../models/feedbackModel');

function summarize(feedbackItems = []) {
  const rules = {
    customerRules: [],
    inventoryRules: [],
    planningRules: []
  };
  feedbackItems.forEach(item => {
    const reason = `${item.reason} ${item.modified_content}`.trim();
    if (/客户|报价|邮件/.test(reason)) rules.customerRules.push(reason);
    if (/库存|缺料|安全库存/.test(reason)) rules.inventoryRules.push(reason);
    if (/计划|排产|交期|设备/.test(reason)) rules.planningRules.push(reason);
  });
  return {
    customerRules: rules.customerRules.slice(0, 10),
    inventoryRules: rules.inventoryRules.slice(0, 10),
    planningRules: rules.planningRules.slice(0, 10)
  };
}

function saveFeedback(payload) {
  return feedbackModel.create(payload);
}

module.exports = {
  summarize,
  saveFeedback
};
