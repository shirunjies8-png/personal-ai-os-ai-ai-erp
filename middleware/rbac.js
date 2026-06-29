const { fail } = require('../utils/response');

function permit(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 401, '请先登录');
    if (!roles.includes(req.user.role)) return fail(res, 403, '没有权限访问此资源');
    next();
  };
}

module.exports = {
  permit
};
