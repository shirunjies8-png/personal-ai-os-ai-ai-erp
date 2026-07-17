const service = require('../services/manufacturingService');
const { ok, fail } = require('../utils/response');

function wrap(handler, message = '操作完成') {
  return (req, res) => {
    try {
      const data = handler(req);
      ok(res, data, message);
    } catch (error) {
      fail(res, error.status || 400, error.message || '制造业务操作失败', { code: error.code || 'MANUFACTURING_ERROR' });
    }
  };
}

module.exports = {
  listCustomers: wrap(req => service.listCustomers(req.query || {}, req.user)),
  createCustomer: wrap(req => ({ customer: service.createCustomer(req.body || {}, req.user) }), '客户已创建'),
  getCustomer: wrap(req => ({ customer: service.getCustomer(req.params.id, req.user) })),
  updateCustomer: wrap(req => ({ customer: service.updateCustomer(req.params.id, req.body || {}, req.user) }), '客户已更新'),
  deleteCustomer: wrap(req => ({ deleted: service.deleteCustomer(req.params.id, req.body || {}, req.user) }), '客户已删除'),
  addCustomerContact: wrap(req => ({ contact: service.addCustomerContact(req.params.id, req.body || {}, req.user) }), '联系人已创建'),
  updateCustomerContact: wrap(req => ({ contact: service.updateCustomerContact(req.params.id, req.params.contactId, req.body || {}, req.user) }), '联系人已更新'),
  deleteCustomerContact: wrap(req => ({ deleted: service.deleteCustomerContact(req.params.id, req.params.contactId, req.body || {}, req.user) }), '联系人已删除'),

  listProjects: wrap(req => service.listProjects(req.query || {}, req.user)),
  createProject: wrap(req => ({ project: service.createProject(req.body || {}, req.user) }), '项目已创建'),
  getProject: wrap(req => ({ project: service.getProject(req.params.id, req.user) })),
  updateProject: wrap(req => ({ project: service.updateProject(req.params.id, req.body || {}, req.user) }), '项目已更新'),
  deleteProject: wrap(req => ({ deleted: service.deleteProject(req.params.id, req.body || {}, req.user) }), '项目已删除'),

  listRfqs: wrap(req => service.listRfqs(req.query || {}, req.user)),
  createRfq: wrap(req => ({ rfq: service.createRfq(req.body || {}, req.user) }), 'RFQ 已创建'),
  getRfq: wrap(req => ({ rfq: service.getRfq(req.params.id, req.user) })),
  updateRfq: wrap(req => ({ rfq: service.updateRfq(req.params.id, req.body || {}, req.user) }), 'RFQ 已更新'),
  deleteRfq: wrap(req => ({ deleted: service.deleteRfq(req.params.id, req.body || {}, req.user) }), 'RFQ 已删除'),
  getAssessment: wrap(req => ({ assessment: service.rfqAssessment(req.params.id, req.user) })),
  updateRequirement: wrap(req => ({ rfq: service.updateRequirement(req.params.id, req.params.requirementId, req.body || {}, req.user) }), 'RFQ 需求已更新'),
  createRisk: wrap(req => ({ rfq: service.createRisk(req.params.id, req.body || {}, req.user) }), 'RFQ 风险已创建'),
  updateRisk: wrap(req => ({ rfq: service.updateRisk(req.params.id, req.params.riskId, req.body || {}, req.user) }), 'RFQ 风险已更新'),
  addFollowup: wrap(req => ({ rfq: service.addFollowup(req.params.id, req.body || {}, req.user) }), 'RFQ 跟进已记录'),
  submitReview: wrap(req => ({ rfq: service.submitReview(req.params.id, req.body || {}, req.user) }), 'RFQ 评审状态已更新'),
  transitionRfq: wrap(req => ({ rfq: service.transitionRfq(req.params.id, req.body || {}, req.user) }), 'RFQ 状态已更新'),
  convertToQuotation: wrap(req => service.convertToQuotation(req.params.id, req.body || {}, req.user), 'RFQ 已转入报价工作区'),
  getHistory: wrap(req => ({ items: service.getRfq(req.params.id, req.user).history })),
  importLegacyRfqs: wrap(req => service.importLegacyRfqs(req.user), '旧询盘导入完成')
};
