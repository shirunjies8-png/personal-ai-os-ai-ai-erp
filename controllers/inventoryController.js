const { v4: uuidv4 } = require('uuid');
const inventoryModel = require('../models/inventoryModel');
const { ok } = require('../utils/response');

function listInventory(req, res) {
  ok(res, { items: inventoryModel.list(req.user.enterprise_id) });
}

function createInventory(req, res) {
  const item = inventoryModel.create({
    id: uuidv4(),
    enterprise_id: req.user.enterprise_id,
    product_code: req.body.productCode || '',
    product_name: req.body.productName,
    stock_quantity: Number(req.body.stockQuantity || 0),
    safety_stock: Number(req.body.safetyStock || 0),
    location: req.body.location || '',
    updated_at: new Date().toISOString()
  });
  ok(res, { item }, '库存已创建');
}

function updateInventory(req, res) {
  const item = inventoryModel.update({
    id: req.params.id,
    enterprise_id: req.user.enterprise_id,
    product_code: req.body.productCode || '',
    product_name: req.body.productName,
    stock_quantity: Number(req.body.stockQuantity || 0),
    safety_stock: Number(req.body.safetyStock || 0),
    location: req.body.location || '',
    updated_at: new Date().toISOString()
  });
  ok(res, { item }, '库存已更新');
}

function deleteInventory(req, res) {
  inventoryModel.remove(req.params.id, req.user.enterprise_id);
  ok(res, {}, '库存已删除');
}

module.exports = {
  listInventory,
  createInventory,
  updateInventory,
  deleteInventory
};
