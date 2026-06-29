const enterpriseModel = require('../models/enterpriseModel');
const userModel = require('../models/userModel');
const { ok } = require('../utils/response');

function getEnterprise(req, res) {
  ok(res, {
    enterprise: enterpriseModel.findById(req.user.enterprise_id),
    users: userModel.listByEnterprise(req.user.enterprise_id)
  });
}

function updateEnterprise(req, res) {
  const enterprise = enterpriseModel.updateById(req.user.enterprise_id, req.body);
  ok(res, { enterprise }, '企业信息已更新');
}

module.exports = {
  getEnterprise,
  updateEnterprise
};
