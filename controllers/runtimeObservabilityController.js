const observability = require('../services/runtimeObservabilityService');
const { ok, fail } = require('../utils/response');

function componentFor(input = {}) {
  const id = String(input.component_id || '');
  if (!id || !observability.components().some(item => item.id === id)) throw new Error('未注册的运行组件');
  return id;
}

function list(req, res) {
  ok(res, { items: observability.list(req.user.enterprise_id, req.query.limit), components: observability.components() });
}

function get(req, res) {
  const item = observability.list(req.user.enterprise_id, 200).find(run => run.run_id === req.params.id);
  if (!item) return fail(res, 404, '运行记录不存在');
  ok(res, { item });
}

function start(req, res) {
  try {
    const input = req.body || {};
    componentFor(input);
    const item = observability.start({ ...input, enterprise_id: req.user.enterprise_id, user_id: req.user.id });
    ok(res, { item }, '运行记录已创建');
  } catch (error) { fail(res, 400, error.message || '运行记录创建失败'); }
}

function finish(req, res) {
  const existing = observability.list(req.user.enterprise_id, 200).find(run => run.run_id === req.params.id);
  if (!existing) return fail(res, 404, '运行记录不存在');
  const item = observability.finish(existing.run_id, req.body || {});
  ok(res, { item }, '运行记录已更新');
}

module.exports = { list, get, start, finish };
