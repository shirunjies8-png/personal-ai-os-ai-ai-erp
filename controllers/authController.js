const authService = require('../services/authService');
const enterpriseModel = require('../models/enterpriseModel');
const { ok } = require('../utils/response');

async function register(req, res, next) {
  try {
    const data = await authService.register(req.body);
    ok(res, data, '注册成功');
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const data = await authService.login(req.body);
    ok(res, data, '登录成功');
  } catch (error) {
    next(error);
  }
}

async function me(req, res) {
  ok(res, {
    user: {
      id: req.user.id,
      enterpriseId: req.user.enterprise_id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      status: req.user.status
    },
    enterprise: enterpriseModel.findById(req.user.enterprise_id)
  });
}

async function changePassword(req, res, next) {
  try {
    await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    ok(res, {}, '密码已修改');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  me,
  changePassword
};
