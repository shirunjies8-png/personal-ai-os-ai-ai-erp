const express = require('express');
const controller = require('../controllers/orderController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.get('/', authRequired, controller.listOrders);
router.post('/', authRequired, controller.createOrder);
router.put('/:id', authRequired, controller.updateOrder);
router.delete('/:id', authRequired, controller.deleteOrder);

module.exports = router;
