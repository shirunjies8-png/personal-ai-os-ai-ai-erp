'use strict';

const readModel = require('../services/realityosControlPlaneReadModel');
const { ok, fail } = require('../utils/response');

function list(req, res, next) {
  try {
    const data = readModel.getControlPlane({
      enterpriseId: req.user?.enterprise_id,
      limit: req.query.limit,
    });
    ok(res, data);
  } catch (error) {
    next(error);
  }
}

function getRun(req, res, next) {
  try {
    const data = readModel.loadRun(null, req.params.id, req.user?.enterprise_id);
    if (!data) return fail(res, 404, 'RealityOS run not found');
    ok(res, data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  getRun,
};
