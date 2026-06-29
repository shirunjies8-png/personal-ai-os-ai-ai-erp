const { verifyToken } = require('../utils/jwt');
const userModel = require('../models/userModel');
const { fail } = require('../utils/response');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return fail(res, 401, '请先登录');
  try {
    const decoded = verifyToken(token);
    const user = userModel.findById(decoded.userId);
    if (!user) return fail(res, 401, '用户不存在');
    req.user = user;
    next();
  } catch (error) {
    return fail(res, 401, '登录已失效', error.message);
  }
}

function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next();
  try {
    const decoded = verifyToken(token);
    req.user = userModel.findById(decoded.userId) || null;
  } catch {
    req.user = null;
  }
  next();
}

module.exports = {
  authRequired,
  optionalAuth
};
