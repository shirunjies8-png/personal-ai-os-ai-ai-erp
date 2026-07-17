const router = require('express').Router();
const controller = require('../controllers/manufacturingController');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

router.get('/customers', controller.listCustomers);
router.post('/customers', controller.createCustomer);
router.get('/customers/:id', controller.getCustomer);
router.patch('/customers/:id', controller.updateCustomer);
router.delete('/customers/:id', controller.deleteCustomer);
router.post('/customers/:id/contacts', controller.addCustomerContact);
router.patch('/customers/:id/contacts/:contactId', controller.updateCustomerContact);
router.delete('/customers/:id/contacts/:contactId', controller.deleteCustomerContact);

router.get('/projects', controller.listProjects);
router.post('/projects', controller.createProject);
router.get('/projects/:id', controller.getProject);
router.patch('/projects/:id', controller.updateProject);
router.delete('/projects/:id', controller.deleteProject);

router.get('/rfqs', controller.listRfqs);
router.post('/rfqs', controller.createRfq);
router.post('/rfqs/import-legacy', controller.importLegacyRfqs);
router.get('/rfqs/:id', controller.getRfq);
router.patch('/rfqs/:id', controller.updateRfq);
router.delete('/rfqs/:id', controller.deleteRfq);
router.get('/rfqs/:id/assessment', controller.getAssessment);
router.patch('/rfqs/:id/requirements/:requirementId', controller.updateRequirement);
router.post('/rfqs/:id/risks', controller.createRisk);
router.patch('/rfqs/:id/risks/:riskId', controller.updateRisk);
router.post('/rfqs/:id/followups', controller.addFollowup);
router.post('/rfqs/:id/submit-review', controller.submitReview);
router.post('/rfqs/:id/transition', controller.transitionRfq);
router.post('/rfqs/:id/convert-to-quotation', controller.convertToQuotation);
router.get('/rfqs/:id/history', controller.getHistory);

module.exports = router;
