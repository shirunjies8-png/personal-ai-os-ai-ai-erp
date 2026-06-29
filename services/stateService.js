const appStateModel = require('../models/appStateModel');

function mergeServerState(serverPayload = {}, incomingPayload = {}) {
  return {
    ...serverPayload,
    ...incomingPayload,
    settings: {
      ...(serverPayload.settings || {}),
      ...(incomingPayload.settings || {})
    }
  };
}

function getState(enterpriseId) {
  return appStateModel.getByEnterpriseId(enterpriseId)?.payload || null;
}

function saveState(enterpriseId, payload) {
  const current = getState(enterpriseId) || {};
  return appStateModel.upsert(enterpriseId, mergeServerState(current, payload)).payload;
}

module.exports = {
  getState,
  saveState
};
