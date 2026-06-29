const express = require('express');
const controller = require('../controllers/inventoryController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.get('/', authRequired, controller.listInventory);
router.post('/', authRequired, controller.createInventory);
router.put('/:id', authRequired, controller.updateInventory);
router.delete('/:id', authRequired, controller.deleteInventory);

module.exports = router;
