const { v4: uuidv4 } = require('uuid');
const orderModel = require('../models/orderModel');
const { ok } = require('../utils/response');

function listOrders(req, res) {
  ok(res, { items: orderModel.list(req.user.enterprise_id) });
}

function createOrder(req, res) {
  const now = new Date().toISOString();
  const order = orderModel.create({
    id: uuidv4(),
    enterprise_id: req.user.enterprise_id,
    order_no: req.body.orderNo,
    customer: req.body.customer,
    product: req.body.product,
    quantity: Number(req.body.quantity || 0),
    delivery_date: req.body.deliveryDate || '',
    status: req.body.status || '待处理',
    priority: req.body.priority || '中',
    created_at: now,
    updated_at: now
  });
  ok(res, { item: order }, '订单已创建');
}

function updateOrder(req, res) {
  const order = orderModel.update({
    id: req.params.id,
    enterprise_id: req.user.enterprise_id,
    order_no: req.body.orderNo,
    customer: req.body.customer,
    product: req.body.product,
    quantity: Number(req.body.quantity || 0),
    delivery_date: req.body.deliveryDate || '',
    status: req.body.status || '待处理',
    priority: req.body.priority || '中',
    updated_at: new Date().toISOString()
  });
  ok(res, { item: order }, '订单已更新');
}

function deleteOrder(req, res) {
  orderModel.remove(req.params.id, req.user.enterprise_id);
  ok(res, {}, '订单已删除');
}

module.exports = {
  listOrders,
  createOrder,
  updateOrder,
  deleteOrder
};
