const governedDashboardService = require('../services/governedDashboardService');
const { ok, fail } = require('../utils/response');

function getDashboard(req, res) {
  try {
    const result = governedDashboardService.getGovernedDashboard({
      user: req.user,
      method: req.method
    });
    if (result.realityos?.run_id) res.set('X-RealityOS-Run-Id', result.realityos.run_id);
    ok(res, {
      dashboard: result.dashboard,
      realityos: result.realityos
    });
  } catch (error) {
    fail(res, error.status || 500, error.message || 'Dashboard governance failed', {
      code: error.code || 'GOVERNED_DASHBOARD_FAILED',
      realityos: error.realityos || null
    });
  }
}

module.exports = {
  getDashboard
};
