const { v4: uuidv4 } = require('uuid');
const inventoryModel = require('../models/inventoryModel');
const inventoryRepository = require('../repositories/inventoryRepository');
const { ok, fail } = require('../utils/response');

function listInventory(req, res) {
  ok(res, { items: inventoryModel.list(req.user.enterprise_id) });
}

function createInventory(req, res) {
  const timestamp = new Date().toISOString();
  const id = uuidv4();
  const stockQuantity = Number(req.body.stockQuantity || 0);
  const item = inventoryRepository.createWithOpening({
    id,
    enterprise_id: req.user.enterprise_id,
    product_code: req.body.productCode || '',
    product_name: req.body.productName,
    stock_quantity: stockQuantity,
    safety_stock: Number(req.body.safetyStock || 0),
    location: req.body.location || '',
    created_at: timestamp,
    updated_at: timestamp
  }, {
    id: uuidv4(), enterprise_id: req.user.enterprise_id, inventory_id: id,
    business_operation_id: `OPENING:${id}`, transaction_id: uuidv4(), transaction_type: 'OPENING_BALANCE',
    quantity_delta: stockQuantity, stock_before: 0, stock_after: stockQuantity,
    reference_type: 'inventory_create', reference_id: id, created_by: req.user.id, created_at: timestamp,
    note: 'Opening balance recorded when inventory was created'
  });
  ok(res, { item }, '库存已创建');
}

function updateInventory(req, res) {
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'stock_quantity') || Object.prototype.hasOwnProperty.call(req.body || {}, 'stockQuantity')) {
    return fail(res, 409, 'INVENTORY_QUANTITY_REQUIRES_TRANSACTION: 库存数量只能通过受控事务修改');
  }
  const existing = inventoryModel.findById(req.params.id, req.user.enterprise_id);
  if (!existing) return fail(res, 404, '库存记录不存在或无权访问');
  const item = inventoryModel.update({
    id: req.params.id,
    enterprise_id: req.user.enterprise_id,
    product_code: req.body.productCode ?? existing.product_code,
    product_name: req.body.productName ?? existing.product_name,
    safety_stock: req.body.safetyStock ?? existing.safety_stock,
    location: req.body.location ?? existing.location,
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
