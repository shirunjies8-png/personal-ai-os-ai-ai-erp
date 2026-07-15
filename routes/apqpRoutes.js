const router = require('express').Router();
const controller = require('../controllers/apqpController');
const { authRequired } = require('../middleware/auth');

router.get('/projects', authRequired, controller.list);
router.post('/projects', authRequired, controller.create);
router.get('/projects/:id', authRequired, controller.get);
router.patch('/projects/:id', authRequired, controller.updateProject);
router.get('/projects/:id/:kind(deliverables|evidence|risks|tasks)', authRequired, controller.records);
router.patch('/projects/:id/:kind(deliverables|risks|tasks)/:recordId', authRequired, controller.update);
router.delete('/projects/:id/evidence/:evidenceId', authRequired, controller.removeEvidence);
router.post('/projects/:id/stages/:stageId/submit', authRequired, controller.submit);
router.post('/projects/:id/stages/:stageId/approve', authRequired, controller.approve);
router.post('/projects/:id/stages/:stageId/reject', authRequired, controller.reject);
router.post('/projects/:id/evidence', authRequired, controller.evidence);
router.post('/projects/:id/risks', authRequired, controller.risk);
router.post('/projects/:id/tasks', authRequired, controller.task);
router.post('/projects/:id/close', authRequired, controller.close);
router.get('/projects/:id/history', authRequired, controller.history);

module.exports = router;
