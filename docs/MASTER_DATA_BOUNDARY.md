# Real Business Master Data Boundary

本文件只记录当前代码和 SQLite schema 已经证明的事实。它不创建主数据模型，也不将未来对象描述为当前能力。

## Current Reality Audit

### Employee

| 项目 | 事实 |
| --- | --- |
| 当前来源 | `users` 表及 JWT 认证后的 `req.user`。 |
| 证据位置 | `database/init.js`：`users(id, enterprise_id, name, role, department, team)`；`middleware/auth.js`：`authRequired()` 通过 `userModel.findById(decoded.userId)` 注入 `req.user`；`controllers/transactionSafetyController.js`：`prepare()` 将 `req.user.id` 作为 `userId` 传给事务服务。 |
| 真实事务链路 | **YES，限身份职责。** `services/transactionSafetyService.js` 的 `prepare()` 将 `userId` 写入 `material_requisitions.requested_by`，审批使用 `req.user.role` 与 `req.user.id`。 |
| 当前结论 | `users/JWT` 是当前申请人、审批人、角色与企业归属来源；不是 Employee Master。 |

### Warehouse

| 项目 | 事实 |
| --- | --- |
| 当前来源 | `inventory.location` 自由文本字段。 |
| 证据位置 | `database/init.js`：`inventory.location TEXT DEFAULT ''`；`repositories/inventoryRepository.js`：库存读写仅使用 `inventory.id`、`enterprise_id`、数量与版本；未发现 `warehouses` 表或 Warehouse service。 |
| 真实事务链路 | **NO。** `transactionSafetyService.prepare()` 和 `inventoryRepository.conditionalDeduct()` 均不读取或校验仓库对象。 |
| 当前结论 | Warehouse 为 **Future Extension**，本轮不落地。 |

### Material

| 项目 | 事实 |
| --- | --- |
| 当前来源 | `inventory.product_code`、`inventory.product_name` 与 `inventory.id`。 |
| 证据位置 | `database/init.js`：`inventory(product_code, product_name, stock_quantity, safety_stock, version)`；`services/transactionSafetyService.js`：`prepare()` 接收并持久化 `inventory_id`；`repositories/inventoryRepository.js`：`readSnapshot()` 与 `conditionalDeduct()` 只针对 `inventory`。 |
| 真实事务链路 | **YES，限库存对象。** 领料、预检查、Reservation、`stock_transactions` 和 `material_requisitions` 均以 `inventory_id` 为真实关联。 |
| 当前结论 | `inventory` 是当前真实库存来源。未来 Material Master 只能补充标准化物料属性，不能替换或平行复制当前库存模型。 |

### Production Order

| 项目 | 事实 |
| --- | --- |
| 当前来源 | `orders` 表存在通用订单字段；没有 `production_orders` 表或 Production Order service。 |
| 证据位置 | `database/init.js`：`orders(order_no, customer, product, quantity, delivery_date, status)`；`services/transactionSafetyService.js`：`prepare()` 仅要求 `business_operation_id`、`inventory_id`、`quantity`，未查询 `orders`。 |
| 真实事务链路 | **NO。** 当前真实领料不要求、也不验证生产订单。 |
| 当前结论 | Production Order 是未来业务来源扩展，不是当前领料必需条件。 |

## As-Is

- 当前租户标识为 `enterprise_id`，由 JWT 解出的 `req.user.enterprise_id` 进入控制器并传入所有领料查询。
- 当前库存真源是 `inventory`；库存扣减使用 `inventory.id + enterprise_id + version`。
- 当前身份真源是 `users` 与 JWT；没有独立 Employee Master。
- `orders` 是现有通用订单数据，不等同 Production Order，且未进入领料链路。
- `location` 是库存记录上的文本，不等同 Warehouse Master。

## To-Be Minimal

未来若完整业务确实需要，才以独立、可迁移的方式定义：

- Employee Master：人员主档与岗位/组织关系，不能覆盖现有认证用户身份。
- Warehouse Master：库存位置可引用的仓库实体与库位模型。
- Material Master：标准物料属性、单位与状态；库存余额继续保留在 `inventory`。
- Production Order：作为领料业务来源的可选关联，而不是强制替换 `business_operation_id`。

以上均为边界定义，**预留，不本轮落地**。

## Future Extension

仓库/库位、物料规格与单位、员工组织结构、生产订单与工序关系，均属于未来业务阶段；当前没有证据表明它们已经进入真实事务链路。

## Data Reality Rules

- `enterprise_id` 是当前唯一租户标识；本阶段不得引入 `tenant_id`。
- `status` 表示业务或流程状态；`version` 只表示乐观锁版本；历史版本应由不可覆盖的流水/Attempt 记录表示，三者不得混用。
- 不根据现有 `stock_quantity` 倒推伪造历史库存流水。
- `inventory` 是当前库存来源，不因未来 Material Master 而被替换。

## Recovery Boundary

```text
Business Workflow
        ↓ Execution Context
Recovery Runtime
```

Recovery Runtime 只治理状态、重试、幂等、审计和恢复尝试。它不理解 Employee、Warehouse、Material 或 Production Order 的业务语义。证据：`services/auditRecoveryService.js` 的输入仅包含 `handler_type`、payload、状态、Situation Fingerprint、Lease 与 Idempotency；领料业务判断仍位于 `services/transactionSafetyService.js`。
