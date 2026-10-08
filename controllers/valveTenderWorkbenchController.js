'use strict';
const workbench = require('../services/valveTenderWorkbenchService');
const { ok, fail } = require('../utils/response');
async function get(req, res, next) {
  try {
    const data = await workbench.readWorkbench({ user: req.user });
    res.set('X-RealityOS-Capability', workbench.CAPABILITY_ID);
    ok(res, data);
  } catch (error) {
    if (error.status) return fail(res, error.status, error.message, error.code);
    return next(error);
  }
}
module.exports = { get };
