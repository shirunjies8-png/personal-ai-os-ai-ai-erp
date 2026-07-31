# Material Issue Real Execution Flow

本文件仅描述当前代码和 SQLite schema 已实现的真实领料证据链。它不是 ERP、仓库主数据或生产订单流程设计。

## Step 1 — Authenticated request enters the workflow

### Source of Truth

- JWT `Authorization` 头解析后的 `req.user`
- API 输入：`business_operation_id`、`inventory_id`、`quantity`

### Code/Table Evidence

- `middleware/auth.js`，`authRequired()`：`verifyToken()` 后通过 `userModel.findById(decoded.userId)` 写入 `req.user`。
- `routes/transactionSafetyRoutes.js`：所有领料路由先经过 `authRequired`。
- `controllers/transactionSafetyController.js`，`prepare()`：将 `req.user.enterprise_id`、`req.user.id`、`req.user.role` 与 `req.body` 传给服务。
- `services/transactionSafetyService.js`，`prepare()`：校验 `business_operation_id`、`inventory_id`、正数 `quantity`。

### Implementation Status

IMPLEMENTED

### Runtime Impact

YES。`enterpriseId`、`userId`、角色和请求字段直接进入真实预检查和后续事务。

## Step 2 — Inventory snapshot and deterministic preparation

### Source of Truth

- `inventory` 表：`id`、`enterprise_id`、`stock_quantity`、`safety_stock`、`version`
- `services/transactionSafetyService.js` 的 `snapshot` 和 `validator`

### Code/Table Evidence

- `repositories/inventoryRepository.js`，`readSnapshot(enterpriseId, inventoryId)` 按 `id + enterprise_id` 读取库存。
- `services/transactionSafetyService.js`，`prepare()`：保存 `inventory_id`、`stock_quantity`、`safety_stock`、`expected_version`、`read_at`。
- `database/init.js`，`transaction_preparations`：`snapshot_data`、`validation_result`、`expected_version`、`expired_at`、`status`。

### Implementation Status

IMPLEMENTED

### Runtime Impact

YES。快照和乐观锁版本是 Execution 重新验证的输入；快照本身不扣减库存。

## Step 3 — Persist approval-bound business context

### Source of Truth

- SQLite 表：`transaction_preparations`、`material_reservations`、`material_requisitions`、`business_operations`、`business_transactions`、`runtime_approvals`
- `approvalService.request()` 返回的审批记录

### Code/Table Evidence

- `services/transactionSafetyService.js`，`prepare()`：在 `BEGIN IMMEDIATE … COMMIT` 中写入上述记录。
- `database/init.js`：
  - `material_requisitions(enterprise_id, business_operation_id, inventory_id, quantity, requested_by, status, preparation_id)`
  - `material_reservations(enterprise_id, inventory_id, business_operation_id, reserved_quantity, status, expired_at)`
  - `business_transactions(preparation_id, status, execution_attempt, lock_version, audit_status)`。

### Implementation Status

IMPLEMENTED

### Runtime Impact

YES。Reservation 不扣库存，但限制同库存的活动领料意向；申请、审批和后续执行以 `preparation_id` 关联。

## Step 4 — Human approval or rejection

### Source of Truth

- `runtime_approvals.status`、`reason`、`decided_by`、`override_context`
- JWT 的申请人/审批人身份和角色

### Code/Table Evidence

- `controllers/transactionSafetyController.js`，`approve()`：将认证用户作为 actor 传入。
- `services/transactionSafetyService.js`，`decide()`：读取 `runtime_approvals`，拒绝申请人自批，写入 APPROVED/REJECTED、覆盖上下文，并同步申请/业务操作状态。
- `database/init.js`，`runtime_approvals` 与 `material_requisitions` schema。

### Implementation Status

IMPLEMENTED

### Runtime Impact

YES。未获批准或 Preparation/Reservation 过期时，Execution 不可继续。

## Step 5 — Short business transaction executes real deduction

### Source of Truth

- Execution 时重新读取的 `inventory` 行
- `transaction_preparations.expected_version` 与 `material_reservations.status/expired_at`
- `business_transactions.status`

### Code/Table Evidence

- `services/transactionSafetyService.js`，`execute()`：在短 SQLite 事务内重新检查审批、Reservation、业务操作和覆盖范围。
- `repositories/inventoryRepository.js`，`conditionalDeduct()`：仅当 `id`、`enterprise_id`、`version` 匹配且 `stock_quantity - quantity >= 0` 时扣减；非覆盖场景同时要求不低于 `safety_stock`。
- `database/init.js`，`inventory.version`、`business_transactions.lock_version`。

### Implementation Status

IMPLEMENTED

### Runtime Impact

YES。此处才改变真实 `inventory.stock_quantity` 与 `inventory.version`。

## Step 6 — Commit business facts and preserve audit evidence

### Source of Truth

- `inventory.stock_quantity`、`inventory.version`
- `stock_transactions`
- `business_transactions`、`material_requisitions`、`transaction_preparations`、`business_operations`
- 独立审计表：`runtime_attempts`、`runtime_validations`、`runtime_runs`

### Code/Table Evidence

- `services/transactionSafetyService.js`，`execute()`：成功时通过 `inventoryRepository.appendStockTransaction()` 写入 `stock_transactions`，并把申请、业务事务、Preparation 和业务操作更新为 COMMITTED。
- `repositories/inventoryRepository.js`，`appendStockTransaction()`：保存 `quantity_delta`、`stock_before`、`stock_after`、`transaction_id`、`business_operation_id`。
- `services/transactionAuditService.js`，`withAudit()`：使用独立 SQLite 连接写运行审计；失败时 `transactionSafetyService.safeAudit()` 进入 `audit_retry_queue`。

### Implementation Status

IMPLEMENTED

### Runtime Impact

YES。库存扣减、库存流水、申请状态和业务事务状态在同一业务事务中提交；审计重试不回滚已提交业务事实。

## State Consistency Authority

当前成功执行的权威顺序是：

```text
inventory.stock_quantity + inventory.version
  = stock_transactions（同一业务 SQLite 事务）
  > business_transactions.status
  > material_requisitions.status
  > transaction_preparations.status / business_operations.final_status
  > runtime_runs / runtime_attempts / runtime_validations
```

第一层与库存流水是原子业务事实：`execute()` 在同一事务中调用 `conditionalDeduct()`、`appendStockTransaction()` 并更新事务/申请状态。运行审计使用独立连接，可能进入 `audit_retry_queue`，因此不高于已提交业务事实。

异常组合包括：

- `business_transactions.status = COMMITTED` 但不存在同一 `transaction_id` 的 `stock_transactions`。
- `material_requisitions.status = COMMITTED` 但 `inventory.stock_quantity/version` 未体现该次 `quantity` 扣减。
- `inventory.version` 与 Preparation 的 `expected_version` 不同却仍出现新的 COMMITTED 事务。
- `runtime_runs` 显示成功但业务事务不是 COMMITTED；运行审计不是业务成功的权威来源。

## Actual State Sets

以下是当前代码实际声明或写入的状态，不是简化后的目标模型。

| 对象 | 代码/schema 证据 | 实际状态 |
| --- | --- | --- |
| 事务状态机 | `transactionSafetyService.TX_STATUSES` | `PREPARING`、`VALIDATING`、`WAITING_APPROVAL`、`APPROVED`、`EXECUTING`、`COMMITTED`、`ISSUED`、`REJECTED`、`ROLLED_BACK`、`CONCURRENCY_ABORT`、`FAILED`、`EXPIRED`、`UNKNOWN` |
| `material_requisitions.status` | `prepare()`、`decide()`、`executionFailure()`、`execute()` | `WAITING_APPROVAL`、`APPROVED`、`REJECTED`、`EXPIRED`、`FAILED`、`CONCURRENCY_ABORT`、`COMMITTED` |
| `business_transactions.status` | `prepare()`、`executionFailure()`、`execute()` | `WAITING_APPROVAL`、`EXECUTING`、`COMMITTED`、`ROLLED_BACK`、`CONCURRENCY_ABORT`、`FAILED`、`EXPIRED` |
| `transaction_preparations.status` | `prepare()`、`decide()`、`execute()` | `WAITING_APPROVAL`、`APPROVED`、`REJECTED`、`EXPIRED`、`COMMITTED` |
| Recovery Runtime | `auditRecoveryService.STATES` | `PENDING_RETRY`、`CLAIMED`、`RUNNING`、`SUCCEEDED`、`RETRY_SCHEDULED`、`DEAD`、`CANCELLED`、`UNKNOWN` |

## Business Invariants

| Invariant | Evidence | Current Test Status |
| --- | --- | --- |
| 库存不会扣为负数 | `inventoryRepository.conditionalDeduct()` 使用 `stock_quantity - quantity >= 0`。 | Verified：`scripts/transaction-safety-test.mjs` 库存不足/并发场景。 |
| 非覆盖场景不能低于安全库存 | `conditionalDeduct()` 添加 `stock_quantity - quantity >= safety_stock`。 | Verified：`scripts/transaction-safety-test.mjs` CASE 36。 |
| 申请人不能审批自己的高风险领料 | `transactionSafetyService.decide()` 使用 actor 与 `requested_by` 判断。 | Verified：`scripts/transaction-safety-test.mjs`、`scripts/material-issue-api-test.mjs`。 |
| 同一企业外的库存不能进入领料 | `readSnapshot()`、控制器和所有关键查询带 `enterprise_id`。 | Verified：两份领料专项测试的跨企业断言。 |
| 直接 PUT 不得修改库存数量 | 现有 inventory controller 拒绝 `stock_quantity/stockQuantity`，数量变更只经受控事务。 | Verified：`scripts/transaction-safety-test.mjs`。 |
| 提交成功必须产生库存流水 | `execute()` 在业务事务内调用 `appendStockTransaction()`。 | Verified：`scripts/transaction-safety-test.mjs`、`scripts/material-issue-api-test.mjs`。 |
| 流水写入失败时库存回滚 | `execute()` 的业务事务捕获失败后 ROLLBACK。 | Verified：`scripts/transaction-safety-test.mjs` 的 rollback 场景。 |
| 已 COMMITTED 的业务操作不得再次扣减 | `prepare()` 返回 `COMMITTED_HISTORY`。 | Verified：两份领料专项测试。 |

## Scenarios

| Scenario | 分类 | 证据 |
| --- | --- | --- |
| 正常领料并生成流水 | Verified | `transaction-safety-test.mjs`、`material-issue-api-test.mjs`。 |
| 库存版本在审批期间变化 | Verified | `transaction-safety-test.mjs`，结果 `CONCURRENCY_ABORT`。 |
| 业务事务流水写入失败 | Verified | `transaction-safety-test.mjs`，库存回滚且 Run Trace 保留。 |
| 安全库存人工覆盖 | Verified | `transaction-safety-test.mjs`，结构化 override 审计。 |
| Preparation / Reservation TTL 过期 | Verified | `transaction-safety-test.mjs`，结果 `EXPIRED`。 |
| 跨企业库存访问 | Verified | `transaction-safety-test.mjs`、`material-issue-api-test.mjs`。 |
| Production Order 作为领料来源 | Documented | 当前没有表、服务或真实链路。 |
| Warehouse 主数据校验 | Documented | 当前没有 Warehouse 实体，只有 `inventory.location`。 |
