const dashboardService = require('../services/dashboardService');
const { ok } = require('../utils/response');

function getDashboard(req, res) {
  ok(res, {
    dashboard: dashboardService.getDashboard(req.user.enterprise_id)
  });
}

module.exports = {
  getDashboard
};
