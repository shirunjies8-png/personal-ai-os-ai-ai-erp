const logModel = require('../models/logModel');
const { ok } = require('../utils/response');

function listLogs(req, res) {
  ok(res, { items: logModel.list(req.user.enterprise_id, Number(req.query.limit || 200)) });
}

module.exports = {
  listLogs
};
