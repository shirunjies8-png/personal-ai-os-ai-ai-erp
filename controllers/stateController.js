const stateService = require('../services/stateService');
const { ok } = require('../utils/response');

function getState(req, res) {
  ok(res, {
    state: stateService.getState(req.user.enterprise_id)
  });
}

function saveState(req, res) {
  const state = stateService.saveState(req.user.enterprise_id, req.body.state || {});
  ok(res, { state }, '状态已同步到后端');
}

module.exports = {
  getState,
  saveState
};
