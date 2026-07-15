const apqp = require('../services/apqpService');
const { ok, fail } = require('../utils/response');

function wrap(fn) {
  return (req, res) => {
    try { ok(res, fn(req), 'APQP 操作完成'); }
    catch (error) { fail(res, error.status || 400, error.message); }
  };
}

module.exports = {
  list: wrap(req => ({ items: apqp.list(req.user) })),
  create: wrap(req => ({ project: apqp.create(req.body || {}, req.user) })),
  get: wrap(req => ({ project: apqp.detail(req.params.id, req.user) })),
  updateProject: wrap(req => ({ project: apqp.updateProject(req.params.id, req.body || {}, req.user) })),
  submit: wrap(req => ({ project: apqp.submit(req.params.id, req.params.stageId, req.user) })),
  approve: wrap(req => ({ project: apqp.decide(req.params.id, req.params.stageId, req.user, true, String(req.body.reason || '')) })),
  reject: wrap(req => ({ project: apqp.decide(req.params.id, req.params.stageId, req.user, false, String(req.body.reason || '')) })),
  evidence: wrap(req => ({ project: apqp.evidence(req.params.id, req.body || {}, req.user) })),
  risk: wrap(req => ({ project: apqp.risk(req.params.id, req.body || {}, req.user) })),
  task: wrap(req => ({ project: apqp.task(req.params.id, req.body || {}, req.user) })),
  close: wrap(req => ({ project: apqp.close(req.params.id, req.user, String(req.body.reason || '')) })),
  history: wrap(req => ({ items: apqp.history(req.params.id, req.user) })),
  deliverables: wrap(req => ({ items: apqp.records(req.params.id, req.user, 'deliverables'), assessment: apqp.assessment(req.params.id, req.user) })),
  evidenceRecords: wrap(req => ({ items: apqp.records(req.params.id, req.user, 'evidence'), assessment: apqp.assessment(req.params.id, req.user) })),
  risks: wrap(req => ({ items: apqp.records(req.params.id, req.user, 'risks'), assessment: apqp.assessment(req.params.id, req.user) })),
  tasks: wrap(req => ({ items: apqp.records(req.params.id, req.user, 'tasks'), assessment: apqp.assessment(req.params.id, req.user) })),
  updateDeliverable: wrap(req => ({ project: apqp.update(req.params.id, 'deliverables', req.params.recordId, req.body || {}, req.user) })),
  updateRisk: wrap(req => ({ project: apqp.update(req.params.id, 'risks', req.params.recordId, req.body || {}, req.user) })),
  updateTask: wrap(req => ({ project: apqp.update(req.params.id, 'tasks', req.params.recordId, req.body || {}, req.user) })),
  removeEvidence: wrap(req => ({ project: apqp.removeEvidence(req.params.id, req.params.evidenceId, req.body || {}, req.user) }))
};
