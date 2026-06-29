const { v4: uuidv4 } = require('uuid');
const userModel = require('../models/userModel');
const enterpriseModel = require('../models/enterpriseModel');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');

async function register({ enterpriseName, email, password, name, role = '企业管理员' }) {
  if (userModel.findByEmail(email)) {
    const error = new Error('邮箱已存在');
    error.status = 409;
    throw error;
  }
  const now = new Date().toISOString();
  const enterpriseId = uuidv4();
  enterpriseModel.create({
    id: enterpriseId,
    name: enterpriseName,
    logo_url: '',
    contact_name: name,
    contact_phone: '',
    created_at: now,
    updated_at: now
  });
  const user = userModel.create({
    id: uuidv4(),
    enterprise_id: enterpriseId,
    email,
    password_hash: await hashPassword(password),
    name,
    role,
    status: '启用',
    department: '管理部',
    team: '默认班组',
    created_at: now,
    updated_at: now
  });
  return login({ email, password }).then(result => ({ ...result, enterprise: enterpriseModel.findById(enterpriseId), user }));
}

async function login({ email, password }) {
  const user = userModel.findByEmail(email);
  if (!user) {
    const error = new Error('账号或密码错误');
    error.status = 401;
    throw error;
  }
  const ok = await comparePassword(password, user.password_hash);
  if (!ok) {
    const error = new Error('账号或密码错误');
    error.status = 401;
    throw error;
  }
  const token = signToken({ userId: user.id, enterpriseId: user.enterprise_id, role: user.role });
  return {
    token,
    user: {
      id: user.id,
      enterpriseId: user.enterprise_id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status
    },
    enterprise: enterpriseModel.findById(user.enterprise_id)
  };
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = userModel.findById(userId);
  const ok = await comparePassword(currentPassword, user.password_hash);
  if (!ok) {
    const error = new Error('当前密码错误');
    error.status = 400;
    throw error;
  }
  return userModel.updatePassword(userId, await hashPassword(newPassword));
}

module.exports = {
  register,
  login,
  changePassword
};
