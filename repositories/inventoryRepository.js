const db = require('../database/client');

function readByEnterprise(enterpriseId, inventoryId) {
  return db.prepare('SELECT * FROM inventory WHERE id=? AND enterprise_id=?').get(inventoryId, enterpriseId);
}

function readSnapshot(enterpriseId, inventoryId) {
  return readByEnterprise(enterpriseId, inventoryId);
}

function conditionalDeduct({ enterpriseId, inventoryId, expectedVersion, quantity, allowSafetyOverride = false, updatedAt }) {
  const safetyClause = allowSafetyOverride ? '' : ' AND stock_quantity - @quantity >= safety_stock';
  return db.prepare(`UPDATE inventory
    SET stock_quantity=stock_quantity-@quantity, version=version+1, updated_at=@updatedAt
    WHERE id=@inventoryId AND enterprise_id=@enterpriseId AND version=@expectedVersion
      AND stock_quantity-@quantity >= 0${safetyClause}`).run({ enterpriseId, inventoryId, expectedVersion, quantity, updatedAt });
}

function conditionalAdjust({ enterpriseId, inventoryId, expectedVersion, quantityDelta, allowSafetyOverride = false, updatedAt }) {
  const safetyClause = allowSafetyOverride ? '' : ' AND stock_quantity + @quantityDelta >= safety_stock';
  return db.prepare(`UPDATE inventory
    SET stock_quantity=stock_quantity+@quantityDelta, version=version+1, updated_at=@updatedAt
    WHERE id=@inventoryId AND enterprise_id=@enterpriseId AND version=@expectedVersion
      AND stock_quantity+@quantityDelta >= 0${safetyClause}`).run({ enterpriseId, inventoryId, expectedVersion, quantityDelta, updatedAt });
}

function appendStockTransaction(record) {
  db.prepare(`INSERT INTO stock_transactions
    (id,enterprise_id,inventory_id,business_operation_id,transaction_id,transaction_type,quantity_delta,stock_before,stock_after,reference_type,reference_id,created_by,created_at,note)
    VALUES (@id,@enterprise_id,@inventory_id,@business_operation_id,@transaction_id,@transaction_type,@quantity_delta,@stock_before,@stock_after,@reference_type,@reference_id,@created_by,@created_at,@note)`).run(record);
}

function createWithOpening(item, openingTransaction) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO inventory (id,enterprise_id,product_code,product_name,stock_quantity,safety_stock,location,version,created_at,updated_at)
      VALUES (@id,@enterprise_id,@product_code,@product_name,@stock_quantity,@safety_stock,@location,0,@created_at,@updated_at)`).run(item);
    if (Number(item.stock_quantity) !== 0) appendStockTransaction(openingTransaction);
    db.exec('COMMIT');
    return readByEnterprise(item.enterprise_id, item.id);
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}

module.exports = { readByEnterprise, readSnapshot, conditionalDeduct, conditionalAdjust, appendStockTransaction, createWithOpening };
